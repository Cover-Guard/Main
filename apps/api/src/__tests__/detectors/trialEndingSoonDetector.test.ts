import { trialEndingSoonDetector } from '../../detectors/trialEndingSoonDetector'
import { makeFakeSupabase } from './fakeSupabase'
import type { DetectorContext } from '../../detectors/types'

const NOW = new Date('2026-04-30T12:00:00Z')

function ctx(subs: unknown[]): DetectorContext {
  return {
    userId: 'u',
    now: NOW,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: makeFakeSupabase({ subscriptions: { data: subs, error: null } }) as any,
  }
}

describe('trialEndingSoonDetector', () => {
  it("doesn't fire for trials with more than 3 days left", async () => {
    const insights = await trialEndingSoonDetector.evaluate(
      ctx([
        {
          id: 's1',
          status: 'TRIALING',
          currentPeriodEnd: new Date(NOW.getTime() + 5 * 86_400_000).toISOString(),
        },
      ]),
    )
    expect(insights).toHaveLength(0)
  })

  it('fires for a trial ending in 2 days', async () => {
    const insights = await trialEndingSoonDetector.evaluate(
      ctx([
        {
          id: 's1',
          status: 'TRIALING',
          currentPeriodEnd: new Date(NOW.getTime() + 2 * 86_400_000).toISOString(),
        },
      ]),
    )
    expect(insights).toHaveLength(1)
    expect(insights[0].severity).toBe('actionable')
    expect(insights[0].entityId).toBe('s1')
    expect(insights[0].dedupeKey).toBe('trial-ending-soon:s1')
  })

  it('fires once with "ends today" copy when within 24h', async () => {
    const insights = await trialEndingSoonDetector.evaluate(
      ctx([
        {
          id: 's1',
          status: 'TRIALING',
          currentPeriodEnd: new Date(NOW.getTime() + 6 * 3_600_000).toISOString(),
        },
      ]),
    )
    expect(insights).toHaveLength(1)
    expect(insights[0].title.toLowerCase()).toContain('today')
  })

  it("doesn't fire for trials that already ended", async () => {
    const insights = await trialEndingSoonDetector.evaluate(
      ctx([
        {
          id: 's1',
          status: 'TRIALING',
          currentPeriodEnd: new Date(NOW.getTime() - 86_400_000).toISOString(),
        },
      ]),
    )
    expect(insights).toHaveLength(0)
  })
})
