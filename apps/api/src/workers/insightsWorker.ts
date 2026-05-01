/**
 * Insights worker entrypoint (PR 7, observability added in PR 9).
 *
 * Runs `ALL_DETECTORS` against every active user in batches. Designed to be
 * invoked by a cron / scheduled job (Railway, Vercel cron, Supabase
 * scheduled function â any of them). Idempotent thanks to the runner's
 * dedupe layer; safe to run on a 5-minute or 1-hour schedule depending on
 * how fresh insights need to be.
 *
 * PR 9: writes a batch-level summary row to `detector_runs` at the end of
 * each invocation so the ops view can show "last run" status and totals at
 * a glance.
 *
 * Run with:
 *   tsx apps/api/src/workers/insightsWorker.ts
 *
 * Production toggles:
 *   INSIGHTS_WORKER_BATCH_SIZE   (default 100) â users per batch
 *   INSIGHTS_WORKER_MAX_USERS    (default 0=unlimited) â cap for canaries
 *   INSIGHTS_SMOKE_DETECTOR=true â enable the smoke detector
 */

import { ALL_DETECTORS, runDetectorsForUser } from '../detectors'
import { recordBatchSummary } from '../detectors/runLog'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { logger } from '../utils/logger'

async function main(): Promise<void> {
  const batchSize = Number(process.env.INSIGHTS_WORKER_BATCH_SIZE ?? '100')
  const maxUsers = Number(process.env.INSIGHTS_WORKER_MAX_USERS ?? '0')
  const startedAt = new Date()

  logger.info('Insights worker starting', {
    detectors: ALL_DETECTORS.map((d) => d.name),
    batchSize,
    maxUsers,
  })

  let offset = 0
  let processed = 0
  let totalInserted = 0
  let totalSkipped = 0
  let errors = 0

  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (error) {
      logger.error('Insights worker: user fetch failed', { error: error.message })
      process.exit(1)
    }
    if (!data || data.length === 0) break

    for (const user of data) {
      if (maxUsers > 0 && processed >= maxUsers) break
      const results = await runDetectorsForUser(ALL_DETECTORS, user.id, startedAt)
      for (const r of results) {
        totalInserted += r.inserted
        totalSkipped += r.skipped
        if (r.status === 'error') errors++
      }
      processed++
    }

    if (data.length < batchSize) break
    if (maxUsers > 0 && processed >= maxUsers) break
    offset += batchSize
  }

  const finishedAt = new Date()
  await recordBatchSummary({
    startedAt,
    finishedAt,
    usersProcessed: processed,
    totalInserted,
    totalSkipped,
    errors,
  })

  logger.info('Insights worker complete', {
    processed,
    inserted: totalInserted,
    skipped: totalSkipped,
    errors,
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
  })
}

const invokedDirectly = process.argv[1]?.endsWith('insightsWorker.ts')
if (invokedDirectly) {
  main().catch((err) => {
    logger.error('Insights worker crashed', {
      error: err instanceof Error ? err.message : String(err),
    })
    process.exit(1)
  })
}

export { main as runInsightsWorker }
