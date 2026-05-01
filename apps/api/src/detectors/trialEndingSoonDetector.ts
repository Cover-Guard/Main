/**
 * Detector: trial-ending-soon (PR 8).
 *
 * Fires once when a TRIALING subscription has 3 or fewer days left. The
 * dedupe key includes the subscription id but not the day count, so the
 * insight surfaces exactly once per trial — not every day until conversion.
 *
 * Severity: actionable (the user typically wants to either renew or
 * downgrade before auto-conversion).
 */

import { type Detector, type DetectorContext, type Insight } from './types'

const WARN_DAYS = 3

interface SubRow {
  id: string
  status: string
  currentPeriodEnd: string
}

export const trialEndingSoonDetector: Detector = {
  name: 'trial-ending-soon',

  async evaluate(ctx: DetectorContext): Promise<Insight[]> {
    const { data, error } = await ctx.supabase
      .from('subscriptions')
      .select('id,status,currentPeriodEnd')
      .eq('userId', ctx.userId)
      .eq('status', 'TRIALING')

    if (error || !data) return []

    const insights: Insight[] = []
    for (const row of data as SubRow[]) {
      const endsInDays =
        (new Date(row.currentPeriodEnd).getTime() - ctx.now.getTime()) /
        86_400_000
      if (endsInDays > WARN_DAYS || endsInDays < 0) continue
      const daysRounded = Math.max(0, Math.floor(endsInDays))
      insights.push({
        category: 'insight',
        severity: 'actionable',
        title:
          daysRounded === 0
            ? 'Your trial ends today'
            : `Your trial ends in ${daysRounded} day${daysRounded === 1 ? '' : 's'}`,
        body: 'Pick a plan to keep working without interruption, or downgrade to free.',
        linkUrl: '/account?tab=subscription',
        payload: {
          subscriptionId: row.id,
          endsAt: row.currentPeriodEnd,
        },
        entityType: 'subscription',
        entityId: row.id,
        // No day in the key — fires once per trial, not once per day.
        dedupeKey: `trial-ending-soon:${row.id}`,
      })
    }
    return insights
  },
}
