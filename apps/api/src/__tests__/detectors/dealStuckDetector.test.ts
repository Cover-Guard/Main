import { dealStuckDetector } from '../../detectors/dealStuckDetector'
import { makeFakeSupabase } from './fakeSupabase'
import type { DetectorContext } from '../../detectors/types'

const NOW = new Date('2026-04-30T12:00:00Z')

function ctx(deals: unknown[]): DetectorContext {
  return {
    userId: 'user-1',
    now: NOW,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: makeFakeSupabase({ deals: { data: deals, error: null } }) as any,
  }
}

describe('dealStuckDetector', () => {
  it('does not fire for deals updated within the threshold', async () => {
    const insights = await dealStuckDetector.evaluate(
      ctx([
        {
          id: 'd1',
          title: 'Recent deal',
          stage: 'IN_PROGRESS',
          updatedAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
        },
      ]),
    )
    expect(insights).toHaveLength(0)
  })

  it('fires for an active deal stalled past 7 days', async () => {
    const insights = await dealStuckDetector.evaluate(
      ctx([
        {
          id: 'd1',
          title: 'The Anderson Place',
          stage: 'IN_PROGRESS',
          updatedAt: new Date(NOW.getTime() - 9 * 86_400_000).toISOString(),
        },
      ]),
    )
    expect(insights).toHaveLength(1)
    expect(insights[0].severity).toBe('actionable')
    expect(insights[0].entityType).toBe('deal')
    expect(insights[0].entityId).toBe('d1')
    expect(insights[0].dedupeKey).toBe('deal-stuck:d1')
    expect(insights[0].title).toContain('Anderson')
  })

  it('emits one insight per stuck deal across many', async () => {
    const stale = new Date(NOW.getTime() - 14 * 86_400_000).toISOString()
    const insights = await dealStuckDetector.evaluate(
      ctx([
        { id: 'a', title: 'A', stage: 'PROSPECT', updatedAt: stale },
        { id: 'b', title: 'B', stage: 'UNDER_CONTRACT', updatedAt: stale },
      ]),
    )
    expect(insights).toHaveLength(2)
    expect(insights.map((i) => i.entityId).sort()).toEqual(['a', 'b'])
  })

  it('returns empty on supabase error', async () => {
    const errCtx: DetectorContext = {
      userId: 'u',
      now: NOW,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: makeFakeSupabase({ deals: { error: { message: 'bad' } } }) as any,
    }
    const insights = await dealStuckDetector.evaluate(errCtx)
    expect(insights).toEqual([])
  })
})
