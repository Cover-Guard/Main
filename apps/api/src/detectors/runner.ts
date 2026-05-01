/**
 * Detector runner (PR 7, observability added in PR 9).
 *
 * Iterates a registered detector list per user, persists emitted insights as
 * `notifications` rows with category='insight', and dedupes on the
 * detector-supplied `dedupeKey`.
 *
 * Dedupe strategy: store `dedupeKey` inside the notification's `payload`
 * JSONB. When evaluating, query the user's recent insights for matching
 * keys and skip the insert if found. Cheap per-user (`userId` index +
 * jsonb access), and avoids a separate dedupe table.
 *
 * PR 9 wraps each detector evaluation with a run-logging layer that writes
 * to `detector_runs`. Logging never throws â if the log insert fails, we
 * warn and keep going. The detector's own success/failure isn't affected.
 */

import { logger } from '../utils/logger'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { recordDetectorRun } from './runLog'
import type { Detector, DetectorContext, Insight } from './types'

const DEDUPE_LOOKBACK_DAYS = 30

export interface RunResult {
  detector: string
  emitted: number
  inserted: number
  skipped: number
  status: 'success' | 'error' | 'skipped'
  durationMs: number
  errorMessage?: string
}

export async function runDetectorsForUser(
  detectors: ReadonlyArray<Detector>,
  userId: string,
  now: Date = new Date(),
): Promise<RunResult[]> {
  const ctx: DetectorContext = { userId, supabase: supabaseAdmin, now }
  const results: RunResult[] = []

  for (const detector of detectors) {
    const startedAt = new Date()
    let emitted = 0
    let inserted = 0
    let skipped = 0
    let status: 'success' | 'error' | 'skipped' = 'success'
    let errorMessage: string | undefined

    try {
      if (detector.enabled) {
        const ok = await detector.enabled(ctx)
        if (!ok) {
          status = 'skipped'
          await recordDetectorRun({
            detectorName: detector.name,
            userId,
            status,
            startedAt,
            finishedAt: new Date(),
            emitted: 0,
            inserted: 0,
            skipped: 0,
          })
          results.push({
            detector: detector.name,
            emitted: 0,
            inserted: 0,
            skipped: 0,
            status,
            durationMs: Date.now() - startedAt.getTime(),
          })
          continue
        }
      }

      const insights = await detector.evaluate(ctx)
      emitted = insights.length
      for (const insight of insights) {
        const wasInserted = await tryInsertInsight(userId, insight, now)
        if (wasInserted) inserted++
        else skipped++
      }
    } catch (err) {
      status = 'error'
      errorMessage = err instanceof Error ? err.message : String(err)
      logger.error('Detector failed', {
        detector: detector.name,
        userId,
        error: errorMessage,
      })
    }

    const finishedAt = new Date()
    await recordDetectorRun({
      detectorName: detector.name,
      userId,
      status,
      startedAt,
      finishedAt,
      emitted,
      inserted,
      skipped,
      errorMessage,
    })

    results.push({
      detector: detector.name,
      emitted,
      inserted,
      skipped,
      status,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      errorMessage,
    })
  }

  return results
}

async function tryInsertInsight(
  userId: string,
  insight: Insight,
  now: Date,
): Promise<boolean> {
  const since = new Date(now.getTime() - DEDUPE_LOOKBACK_DAYS * 86400_000).toISOString()
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('userId', userId)
    .eq('category', 'insight')
    .gte('createdAt', since)
    .filter('payload->>dedupeKey', 'eq', insight.dedupeKey)
    .limit(1)

  if (lookupErr) {
    logger.warn('Dedupe lookup failed; inserting insight anyway', {
      userId,
      dedupeKey: insight.dedupeKey,
      error: lookupErr.message,
    })
  } else if (existing && existing.length > 0) {
    return false
  }

  const payload = { ...insight.payload, dedupeKey: insight.dedupeKey }
  const { error: insertErr } = await supabaseAdmin.from('notifications').insert({
    userId,
    type: 'INSIGHT',
    severity: insight.severity,
    category: insight.category,
    entityType: insight.entityType,
    entityId: insight.entityId,
    title: insight.title,
    body: insight.body,
    linkUrl: insight.linkUrl,
    payload,
  })
  if (insertErr) {
    logger.error('Insight insert failed', {
      userId,
      dedupeKey: insight.dedupeKey,
      error: insertErr.message,
    })
    return false
  }
  return true
}
