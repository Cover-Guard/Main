import { estimateReadyDetector } from '../../detectors/estimateReadyDetector'
import { makeFakeSupabase } from './fakeSupabase'
import type { DetectorContext } from '../../detectors/types'

const NOW = new Date('2026-04-30T12:00:00Z')

function ctx(saved: unknown[], estimates: unknown[]): DetectorContext {
  return {
    userId: 'u',
    now: NOW,
    supabase: makeFakeSupabase({
      saved_properties: { data: saved, error: null },
      insurance_estimates: { data: estimates, error: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  }
}

describe('estimateReadyDetector', () => {
  it('returns empty when the user has no saved properties', async () => {
    const insights = await estimateReadyDetector.evaluate(ctx([], []))
    expect(insights).toHaveLength(0)
  })

  it('fires for each saved property with a fresh estimate', async () => {
    const insights = await estimateReadyDetector.evaluate(
      ctx(
        [{ propertyId: 'p1' }, { propertyId: 'p2' }],
        [
          { propertyId: 'p1', estimatedAnnualTotal: 2400 },
          { propertyId: 'p2', estimatedAnnualTotal: 1800 },
        ],
      ),
    )
    expect(insights).toHaveLength(2)
    expect(insights[0].severity).toBe('info')
    expect(insights[0].dedupeKey).toMatch(/^estimate-ready:p[12]$/)
  })

  it('returns empty if no recent estimates', async () => {
    const insights = await estimateReadyDetector.evaluate(
      ctx([{ propertyId: 'p1' }], []),
    )
    expect(insights).toHaveLength(0)
  })
})
