/**
 * Workers barrel export (PR 12).
 *
 * Three cron-driven workers ship in this codebase. Re-exporting them here
 * makes wiring up cron jobs and Vercel scheduled functions a one-import
 * operation rather than three.
 *
 *   import { runInsightsWorker, runDigestWorker, runPushWorker } from '@/workers'
 *
 * Recommended cadences (see docs/notifications/operations.md):
 *   â¢ runPushWorker      â every 1-3 minutes
 *   â¢ runInsightsWorker  â every 5-15 minutes
 *   â¢ runDigestWorker    â every 15 minutes
 *
 * All three are idempotent â concurrent runs and overlapping schedules are
 * safe. Each writes a summary row to `detector_runs` for observability.
 */

export { runInsightsWorker } from './insightsWorker'
export { runDigestWorker } from './digestWorker'
export { runPushWorker } from './pushWorker'
