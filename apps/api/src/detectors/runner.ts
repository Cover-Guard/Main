/**
 * Detector runner (PR 7).
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
 * The runner is intentionally synchronous-ish per user — detectors run in
 * a Promise.all, then inserts run sequentially per insight to keep the
 * dedupe check race-free. For the PR 7 single-detector case this is fine;
 * PR 8's larger set will still complete in <1s per user against typical
 * row counts.
 */

import { logger } from '../utils/logger'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import type { Detector, DetectorContext, Insight } from './types'

const DEDUPE_LOOKBACK_DAYS = 30

export interface RunResult {
  detector: string
  emitted: number
  inserted: number
  skipped: number
}

/**
 * Run a list of detectors against a single user. Returns one result per
 * detector for logging/metrics; failures of individual detectors don't
 * abort the others.
 */
export async function runDetectorsForUser(
  detectors: ReadonlyArray<Detector>,
  userId: string,
  now: Date = new Date(),
): Promise<RunResult[]> {
  const ctx: DetectorContext = { userId, supabase: supabaseAdmin, now }
  const results: RunResult[] = []

  for (const detector of detectors) {
    try {
      if (detector.enabled) {
        const ok = await detector.enabled(ctx)
        if (!ok) {
          results.push({ detector: detector.name, emitted: 0, inserted: 0, skipped: 0 })
          continue
        }
      }
      const insights = await detector.evaluate(ctx)
      let inserted = 0
      let skipped = 0
      for (const insight of insights) {
        const wasInserted = await tryInsertInsight(userId, insight, now)
        if (wasInserted) inserted++
        else skipped++
      }
      results.push({
        detector: detector.name,
        emitted: insights.length,
        inserted,
        skipped,
      })
    } catch (err) {
      logger.error('Detector failed', {
        detector: detector.name,
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
      results.push({ detector: detector.name, emitted: 0, inserted: 0, skipped: 0 })
    }
  }

  return results
}

/**
 * Insert one insight into `notifications` if no row with the same dedupeKey
 * exists for this user in the last DEDUPE_LOOKBACK_DAYS. Returns whether a
 * row was actually inserted.
 */
async function tryInsertInsight(
  userId: string,
  insight: Insight,
  now: Date,
): Promise<boolean> {
  const since = new Date(now.getTime() - DEDUPE_LOOKBACK_DAYS * 86400_000).toISOString()

  // Filter on payload->>dedupeKey using PostgREST's jsonb syntax.
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
