/**
 * Detector: deal-stuck (PR 8).
 *
 * Fires when a non-terminal deal hasn't moved stage in 7+ days. The signal
 * is meaningful for users actively managing pipelines — a stalled deal is
 * usually waiting on a follow-up or a missing artifact, not on an impossible
 * problem. Surfacing it as an Insight prompts the small action that
 * unsticks it.
 *
 * Severity: actionable (the user has something concrete to do).
 * Dedupe: per-deal — the same stuck deal won't re-emit within 30 days.
 */

import { evaluateThreshold } from './evaluators'
import type { Detector, DetectorContext, Insight } from './types'

const STUCK_THRESHOLD_DAYS = 7

// Stages where stickiness still represents action a user can take.
// Excludes CLOSED_WON (done) and FELL_OUT (already resolved).
const ACTIVE_STAGES = ['PROSPECT', 'IN_PROGRESS', 'UNDER_CONTRACT'] as const

interface DealRow {
  id: string
  title: string
  stage: string
  updatedAt: string
}

export const dealStuckDetector: Detector = {
  name: 'deal-stuck',

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    const { data, error } = await ctx.supabase
      .from('deals')
      .select('id,title,stage,updatedAt')
      .eq('userId', ctx.userId)
      .in('stage', ACTIVE_STAGES as unknown as string[])

    if (error || !data) return []

    const insights: Insight[] = []
    for (const row of data as DealRow[]) {
      const ageDays =
        (ctx.now.getTime() - new Date(row.updatedAt).getTime()) / 86_400_000
      const result = evaluateThreshold(ageDays, STUCK_THRESHOLD_DAYS, 'gte')
      if (!result.fired) continue
      insights.push({
        category: 'insight',
        severity: 'actionable',
        title: `${row.title} hasn't moved in ${Math.floor(ageDays)} days`,
        body: `This deal has been in ${row.stage.replace('_', ' ').toLowerCase()} since ${new Date(row.updatedAt).toLocaleDateString()}. A quick check-in usually unsticks it.`,
        linkUrl: `/dashboard?deal=${row.id}`,
        payload: {
          dealId: row.id,
          stage: row.stage,
          stuckSinceDays: Math.floor(ageDays),
        },
        entityType: 'deal',
        entityId: row.id,
        dedupeKey: `deal-stuck:${row.id}`,
      })
    }
    return insights
  },
}
