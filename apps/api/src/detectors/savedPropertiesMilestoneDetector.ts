/**
 * Detector: saved-properties-milestone (PR 8).
 *
 * Celebratory insight that fires when the user crosses a saved-properties
 * milestone (1, 5, 10, 25, 100). Uses the shared `evaluateMilestone`
 * primitive — the dedupe key includes the milestone, so each one fires
 * exactly once even if the user un-saves and re-saves around the threshold.
 *
 * Severity: info.
 */

import { type Detector, type DetectorContext, type Insight } from './types'
import { evaluateMilestone } from './evaluators'

const MILESTONES = [1, 5, 10, 25, 100] as const

export const savedPropertiesMilestoneDetector: Detector = {
  name: 'saved-properties-milestone',

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    const { count, error } = await ctx.supabase
      .from('saved_properties')
      .select('id', { count: 'exact', head: true })
      .eq('userId', ctx.userId)

    if (error || count === null) return []

    // We don't track "previous count" anywhere, so each milestone is checked
    // independently with a synthetic previous=0 — the dedupe key prevents
    // re-firing once the milestone insight has already been emitted.
    // evaluateMilestone returns the *highest* crossed; we want all crossed
    // (capped by milestones), so iterate.
    const insights: Insight[] = []
    for (const m of MILESTONES) {
      const result = evaluateMilestone(0, count, [m] as unknown as readonly number[])
      if (!result.fired) continue
      insights.push({
        category: 'insight',
        severity: 'info',
        title:
          m === 1
            ? 'You saved your first property 🎉'
            : `You've saved ${m} properties`,
        body:
          m === 1
            ? 'Save more to compare estimates side-by-side.'
            : 'Use the Watchlist to compare and rank them.',
        linkUrl: '/dashboard?tab=saved',
        payload: { milestone: m, currentCount: count },
        entityType: 'user',
        entityId: ctx.userId,
        dedupeKey: `saved-properties-milestone:${m}`,
      })
    }
    return insights
  },
}
