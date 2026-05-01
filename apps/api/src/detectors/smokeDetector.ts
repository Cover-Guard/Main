/**
 * Smoke detector (PR 7).
 *
 * The simplest detector that exercises the full framework: gated by the
 * INSIGHTS_SMOKE_DETECTOR env var, fires at most once per user (dedup
 * naturally handles re-runs), and emits a single info-severity insight
 * confirming the framework is wired end-to-end.
 *
 * Used to validate the detector pipeline in staging before PR 8's real
 * detectors land. Off in production by default.
 */

import type { Detector, DetectorContext, Insight } from './types'

export const smokeDetector: Detector = {
  name: 'smoke',

  enabled(): boolean {
    return process.env.INSIGHTS_SMOKE_DETECTOR === 'true'
  },

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    return [
      {
        category: 'insight',
        severity: 'info',
        title: 'Insights are wired up',
        body: 'You are seeing this because the smoke detector is enabled. Production detectors land in PR 8.',
        linkUrl: null,
        payload: {
          ranAt: ctx.now.toISOString(),
          source: 'smoke',
        },
        entityType: 'user',
        entityId: ctx.userId,
        // Per-user singleton — second run for same user dedupes.
        dedupeKey: `smoke:${ctx.userId}`,
      },
    ]
  },
}
