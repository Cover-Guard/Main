import { checklistOverdueDetector } from '../../detectors/checklistOverdueDetector'
import { makeFakeSupabase } from './fakeSupabase'
import type { DetectorContext } from '../../detectors/types'

const NOW = new Date('2026-04-30T12:00:00Z')

function ctx(checklists: unknown[]): DetectorContext {
  return {
    userId: 'u',
    now: NOW,
    supabase: makeFakeSupabase({
      property_checklists: { data: checklists, error: null },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  }
}

describe('checklistOverdueDetector', () => {
  it("doesn't fire when all items are done or not yet due", async () => {
    const insights = await checklistOverdueDetector.evaluate(
      ctx([
        {
          id: 'c1',
          title: 'Inspection',
          propertyId: 'p1',
          items: [
            { id: '1', label: 'Roof', done: true, due: '2026-01-01' },
            { id: '2', label: 'Foundation', done: false, due: '2027-01-01' },
          ],
        },
      ]),
    )
    expect(insights).toHaveLength(0)
  })

  it('fires once per checklist with at least one overdue item', async () => {
    const insights = await checklistOverdueDetector.evaluate(
      ctx([
        {
          id: 'c1',
          title: 'Inspection',
          propertyId: 'p1',
          items: [
            { id: '1', label: 'Roof check', due: '2026-04-01', done: false },
            { id: '2', label: 'Foundation', due: '2026-04-15', done: false },
          ],
        },
      ]),
    )
    expect(insights).toHaveLength(1)
    expect(insights[0].dedupeKey).toBe('checklist-overdue:c1')
    expect(insights[0].title.toLowerCase()).toContain('overdue')
    expect(insights[0].payload.overdueCount).toBe(2)
  })

  it("uses the singular phrasing when exactly one item is overdue", async () => {
    const insights = await checklistOverdueDetector.evaluate(
      ctx([
        {
          id: 'c1',
          title: 'Inspection',
          propertyId: 'p1',
          items: [{ id: '1', label: 'Roof check', due: '2026-04-01', done: false }],
        },
      ]),
    )
    expect(insights).toHaveLength(1)
    expect(insights[0].title).toBe('Overdue: Roof check')
  })

  it('handles malformed items array gracefully', async () => {
    const insights = await checklistOverdueDetector.evaluate(
      ctx([
        { id: 'c1', title: 'X', propertyId: 'p1', items: null },
        { id: 'c2', title: 'Y', propertyId: 'p2', items: 'not-an-array' },
      ]),
    )
    expect(insights).toHaveLength(0)
  })
})
