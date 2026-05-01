import { savedPropertiesMilestoneDetector } from '../../detectors/savedPropertiesMilestoneDetector'
import { makeFakeSupabase } from './fakeSupabase'
import type { DetectorContext } from '../../detectors/types'

const NOW = new Date('2026-04-30T12:00:00Z')

function ctx(count: number | null): DetectorContext {
  return {
    userId: 'u',
    now: NOW,
    supabase: makeFakeSupabase({
      saved_properties: { data: [], error: null, count },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  }
}

describe('savedPropertiesMilestoneDetector', () => {
  it("doesn't fire when count is zero", async () => {
    const insights = await savedPropertiesMilestoneDetector.evaluate(ctx(0))
    expect(insights).toHaveLength(0)
  })

  it('fires the first-property milestone when count is 1', async () => {
    const insights = await savedPropertiesMilestoneDetector.evaluate(ctx(1))
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toContain('first property')
    expect(insights[0].dedupeKey).toBe('saved-properties-milestone:1')
  })

  it('fires every milestone the user has crossed (dedupe handles per-fire uniqueness)', async () => {
    const insights = await savedPropertiesMilestoneDetector.evaluate(ctx(27))
    // 1, 5, 10, 25 are crossed; 100 is not.
    const milestones = insights.map((i) => i.payload.milestone).sort((a, b) => Number(a) - Number(b))
    expect(milestones).toEqual([1, 5, 10, 25])
  })

  it('returns empty on supabase error', async () => {
    const errCtx: DetectorContext = {
      userId: 'u',
      now: NOW,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: makeFakeSupabase({ saved_properties: { error: { message: 'oops' }, count: null } }) as any,
    }
    const insights = await savedPropertiesMilestoneDetector.evaluate(errCtx)
    expect(insights).toEqual([])
  })
})
