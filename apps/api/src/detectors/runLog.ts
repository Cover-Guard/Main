/**
 * Detector run logging (PR 9).
 *
 * Persists one row to `detector_runs` per (detector Ã user) evaluation, plus
 * an end-of-batch summary row keyed by detectorName='__batch__'.
 *
 * Design notes:
 *   â¢ Logging never throws. A failure here is logged at WARN â we don't want
 *     a transient detector_runs insert blip to abort the worker mid-batch.
 *   â¢ All inserts go through the service-role client. RLS on `detector_runs`
 *     restricts SELECT to admins; nobody else writes.
 *   â¢ Duration is computed here (not in SQL) so we don't have clock skew
 *     between Postgres and the worker pod.
 */

import { logger } from '../utils/logger'
import { supabaseAdmin } from '../utils/supabaseAdmin'

export type DetectorRunStatus = 'success' | 'error' | 'skipped'

export interface DetectorRunRecord {
  detectorName: string
  userId: string | null
  status: DetectorRunStatus
  startedAt: Date
  finishedAt: Date
  emitted: number
  inserted: number
  skipped: number
  errorMessage?: string
}

export async function recordDetectorRun(record: DetectorRunRecord): Promise<void> {
  const durationMs = record.finishedAt.getTime() - record.startedAt.getTime()
  const row = {
    detectorName: record.detectorName,
    userId: record.userId,
    status: record.status,
    startedAt: record.startedAt.toISOString(),
    finishedAt: record.finishedAt.toISOString(),
    durationMs,
    emitted: record.emitted,
    inserted: record.inserted,
    skipped: record.skipped,
    errorMessage: record.errorMessage ?? null,
  }
  const { error } = await supabaseAdmin.from('detector_runs').insert(row)
  if (error) {
    logger.warn('Failed to record detector run', {
      detector: record.detectorName,
      userId: record.userId,
      status: record.status,
      error: error.message,
    })
  }
}

export interface BatchSummary {
  startedAt: Date
  finishedAt: Date
  usersProcessed: number
  totalInserted: number
  totalSkipped: number
  errors: number
}

export async function recordBatchSummary(summary: BatchSummary): Promise<void> {
  await recordDetectorRun({
    detectorName: '__batch__',
    userId: null,
    status: summary.errors > 0 ? 'error' : 'success',
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    emitted: summary.usersProcessed,
    inserted: summary.totalInserted,
    skipped: summary.totalSkipped,
    errorMessage:
      summary.errors > 0 ? `${summary.errors} detector errors during batch` : undefined,
  })
}
