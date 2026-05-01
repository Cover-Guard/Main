import {
  evaluateThreshold,
  evaluateAnomaly,
  evaluateMilestone,
} from '../../utils/insightEvaluators'

describe('evaluateThreshold', () => {
  it('fires when gt comparison is satisfied', () => {
    const r = evaluateThreshold(11, 10, 'gt')
    expect(r.fired).toBe(true)
    expect(r.value).toBe(11)
    expect(r.threshold).toBe(10)
    expect(r.comparison).toBe('gt')
  })
  it("doesn't fire when gt is equal", () => {
    expect(evaluateThreshold(10, 10, 'gt').fired).toBe(false)
  })
  it('fires when gte is equal', () => {
    expect(evaluateThreshold(10, 10, 'gte').fired).toBe(true)
  })
  it('fires when lt is satisfied', () => {
    expect(evaluateThreshold(9, 10, 'lt').fired).toBe(true)
  })
  it('fires when lte is equal', () => {
    expect(evaluateThreshold(10, 10, 'lte').fired).toBe(true)
  })
  it('fires when eq matches exactly', () => {
    expect(evaluateThreshold(7, 7, 'eq').fired).toBe(true)
  })
  it("doesn't fire when eq differs", () => {
    expect(evaluateThreshold(7, 8, 'eq').fired).toBe(false)
  })
})

describe('evaluateAnomaly', () => {
  it("doesn't fire on tiny baseline (<3 samples)", () => {
    expect(evaluateAnomaly([1, 2], 100, 2).fired).toBe(false)
    expect(evaluateAnomaly([], 100, 2).fired).toBe(false)
  })

  it("doesn't fire when baseline has zero variance", () => {
    // All same values — std dev = 0, so any current is "infinite" sigma.
    // The implementation explicitly guards against this to avoid false positives.
    expect(evaluateAnomaly([5, 5, 5, 5], 100, 2).fired).toBe(false)
  })

  it('fires when current is more than 2σ above baseline', () => {
    // baseline mean=10, stdev~=1.41, current=20 → z ~ 7
    const r = evaluateAnomaly([8, 9, 10, 11, 12], 20, 2)
    expect(r.fired).toBe(true)
    expect(r.zScore).toBeGreaterThan(2)
    expect(r.mean).toBe(10)
  })

  it('fires when current is more than 2σ below baseline', () => {
    const r = evaluateAnomaly([8, 9, 10, 11, 12], 0, 2)
    expect(r.fired).toBe(true)
    expect(r.zScore).toBeLessThan(-2)
  })

  it("doesn't fire for current within 1σ", () => {
    expect(evaluateAnomaly([8, 9, 10, 11, 12], 11, 2).fired).toBe(false)
  })

  it('respects custom sigmaMultiple', () => {
    // current is ~2σ — fires at default 2σ but not at 3σ.
    const baseline = [8, 9, 10, 11, 12]
    expect(evaluateAnomaly(baseline, 13, 2).fired).toBe(true)
    expect(evaluateAnomaly(baseline, 13, 3).fired).toBe(false)
  })
})

describe('evaluateMilestone', () => {
  const MILESTONES = [1, 5, 10, 25, 100] as const

  it('fires on first crossing', () => {
    const r = evaluateMilestone(0, 1, MILESTONES)
    expect(r.fired).toBe(true)
    expect(r.milestoneHit).toBe(1)
  })

  it("doesn't fire when count stays below all milestones", () => {
    const r = evaluateMilestone(0, 0, MILESTONES)
    expect(r.fired).toBe(false)
    expect(r.milestoneHit).toBe(null)
  })

  it("doesn't fire when count was already past the milestone", () => {
    // We crossed 5 last time; now at 7, no new milestone.
    const r = evaluateMilestone(5, 7, MILESTONES)
    expect(r.fired).toBe(false)
    expect(r.milestoneHit).toBe(null)
  })

  it('reports the highest milestone crossed in a multi-step jump', () => {
    // User went from 0 → 27 in one evaluation: should fire once with 25.
    const r = evaluateMilestone(0, 27, MILESTONES)
    expect(r.fired).toBe(true)
    expect(r.milestoneHit).toBe(25)
  })

  it('handles an empty milestones list', () => {
    const r = evaluateMilestone(0, 100, [])
    expect(r.fired).toBe(false)
    expect(r.milestoneHit).toBe(null)
  })
})
