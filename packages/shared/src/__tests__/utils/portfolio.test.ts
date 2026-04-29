import {
  applyPortfolioFilters,
  classifyPortfolioRender,
  classifyRetentionRisk,
  computePortfolioDelta,
  formatPortfolioPremium,
  isPortfolioRenderWithinBudget,
  perilLabel,
  retentionRiskAtLeast,
  retentionRiskCopy,
  summarizePortfolio,
  type PolicySnapshot,
} from '../../utils/portfolio'
import {
  type PortfolioFilters,
  type PortfolioPolicy,
  DEFAULT_PORTFOLIO_FILTERS,
  MATERIAL_SCORE_DELTA,
  PORTFOLIO_LOAD_BUDGET_MS,
} from '../../types/portfolio'

const NOW = '2026-04-29T12:00:00Z'

function policy(overrides: Partial<PortfolioPolicy> = {}): PortfolioPolicy {
  return {
    id: 'AGENCY_ZOOM:p1',
    provider: 'AGENCY_ZOOM',
    policyNumber: 'POL-001',
    property: {
      addressLine1: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
    producerId: 'producer-1',
    carrierName: 'Pacific Mutual',
    insurabilityScore: 70,
    dominantPeril: 'WILDFIRE',
    retentionRisk: 'LOW',
    lastSyncAt: NOW,
    annualPremiumUsd: 2400,
    ...overrides,
  }
}

function filters(overrides: Partial<PortfolioFilters> = {}): PortfolioFilters {
  return { ...DEFAULT_PORTFOLIO_FILTERS, ...overrides }
}

describe('classifyRetentionRisk', () => {
  it('returns CRITICAL when carrier is withdrawing, regardless of score', () => {
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: true,
        scoreDelta30d: 0,
        monthsSinceRenewal: 3,
      }),
    ).toBe('CRITICAL')
  })

  it('returns HIGH when score dropped 15+ in 30d', () => {
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: -15,
        monthsSinceRenewal: 1,
      }),
    ).toBe('HIGH')
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: -30,
        monthsSinceRenewal: 1,
      }),
    ).toBe('HIGH')
  })

  it('returns MEDIUM when score dropped 5-14 in 30d', () => {
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: -MATERIAL_SCORE_DELTA,
        monthsSinceRenewal: 1,
      }),
    ).toBe('MEDIUM')
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: -10,
        monthsSinceRenewal: 1,
      }),
    ).toBe('MEDIUM')
  })

  it('returns MEDIUM when approaching renewal with any negative delta', () => {
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: -1,
        monthsSinceRenewal: 11,
      }),
    ).toBe('MEDIUM')
  })

  it('returns LOW for the happy path', () => {
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: 0,
        monthsSinceRenewal: 3,
      }),
    ).toBe('LOW')
    expect(
      classifyRetentionRisk({
        carrierWithdrawing: false,
        scoreDelta30d: 5,
        monthsSinceRenewal: 11,
      }),
    ).toBe('LOW')
  })
})

describe('retentionRiskAtLeast', () => {
  it('honors the LOW < MEDIUM < HIGH < CRITICAL ordering', () => {
    expect(retentionRiskAtLeast('CRITICAL', 'HIGH')).toBe(true)
    expect(retentionRiskAtLeast('MEDIUM', 'HIGH')).toBe(false)
    expect(retentionRiskAtLeast('LOW', 'LOW')).toBe(true)
  })
})

describe('retentionRiskCopy', () => {
  it('returns the right variant per level', () => {
    expect(retentionRiskCopy('LOW').variant).toBe('success')
    expect(retentionRiskCopy('MEDIUM').variant).toBe('neutral')
    expect(retentionRiskCopy('HIGH').variant).toBe('warning')
    expect(retentionRiskCopy('CRITICAL').variant).toBe('danger')
  })
})

describe('applyPortfolioFilters', () => {
  const dataset: PortfolioPolicy[] = [
    policy({ id: 'a', property: { ...policy().property, state: 'TX' }, dominantPeril: 'WILDFIRE', carrierName: 'Pacific', retentionRisk: 'LOW', producerId: 'p1' }),
    policy({ id: 'b', property: { ...policy().property, state: 'FL', city: 'Miami' }, dominantPeril: 'HURRICANE', carrierName: 'Atlantic', retentionRisk: 'CRITICAL', producerId: 'p2' }),
    policy({ id: 'c', property: { ...policy().property, state: 'CA' }, dominantPeril: 'EARTHQUAKE', carrierName: 'Pacific', retentionRisk: 'MEDIUM', producerId: 'p1' }),
  ]

  it('returns everything when filters are empty', () => {
    expect(applyPortfolioFilters(dataset, filters()).map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('filters by state', () => {
    expect(applyPortfolioFilters(dataset, filters({ states: ['TX'] })).map(p => p.id)).toEqual(['a'])
  })

  it('filters by peril (multi-select)', () => {
    expect(
      applyPortfolioFilters(dataset, filters({ perils: ['WILDFIRE', 'EARTHQUAKE'] })).map(p => p.id),
    ).toEqual(['a', 'c'])
  })

  it('filters by carrier', () => {
    expect(
      applyPortfolioFilters(dataset, filters({ carriers: ['Pacific'] })).map(p => p.id),
    ).toEqual(['a', 'c'])
  })

  it('filters by producer', () => {
    expect(
      applyPortfolioFilters(dataset, filters({ producers: ['p1'] })).map(p => p.id),
    ).toEqual(['a', 'c'])
  })

  it('filters by minRetentionRisk', () => {
    expect(
      applyPortfolioFilters(dataset, filters({ minRetentionRisk: 'HIGH' })).map(p => p.id),
    ).toEqual(['b'])
  })

  it('fuzzy-matches the search query (case-insensitive)', () => {
    expect(
      applyPortfolioFilters(dataset, filters({ searchQuery: 'miami' })).map(p => p.id),
    ).toEqual(['b'])
    expect(
      applyPortfolioFilters(dataset, filters({ searchQuery: 'PACIFIC' })).map(p => p.id),
    ).toEqual(['a', 'c'])
  })

  it('combines filters with AND semantics', () => {
    expect(
      applyPortfolioFilters(
        dataset,
        filters({ states: ['CA'], minRetentionRisk: 'MEDIUM' }),
      ).map(p => p.id),
    ).toEqual(['c'])
  })
})

describe('summarizePortfolio', () => {
  const dataset: PortfolioPolicy[] = [
    policy({ id: 'a', insurabilityScore: 80, retentionRisk: 'LOW', dominantPeril: 'WILDFIRE', annualPremiumUsd: 2000 }),
    policy({ id: 'b', insurabilityScore: 60, retentionRisk: 'CRITICAL', dominantPeril: 'HURRICANE', annualPremiumUsd: 4500 }),
    policy({ id: 'c', insurabilityScore: 40, retentionRisk: 'HIGH', dominantPeril: 'WILDFIRE', annualPremiumUsd: 3000 }),
  ]

  it('rolls up counts, average score, and premium', () => {
    const sum = summarizePortfolio(dataset.length, dataset)
    expect(sum.totalPolicies).toBe(3)
    expect(sum.filteredPolicies).toBe(3)
    expect(sum.averageScore).toBe(60)
    expect(sum.totalAnnualPremiumUsd).toBe(9500)
  })

  it('breaks down by retention level', () => {
    const sum = summarizePortfolio(dataset.length, dataset)
    expect(sum.retentionBreakdown.LOW).toBe(1)
    expect(sum.retentionBreakdown.HIGH).toBe(1)
    expect(sum.retentionBreakdown.CRITICAL).toBe(1)
    expect(sum.retentionBreakdown.MEDIUM).toBe(0)
  })

  it('breaks down by peril', () => {
    const sum = summarizePortfolio(dataset.length, dataset)
    expect(sum.perilBreakdown.WILDFIRE).toBe(2)
    expect(sum.perilBreakdown.HURRICANE).toBe(1)
    expect(sum.perilBreakdown.NONE).toBe(0)
  })

  it('returns null average for an empty filtered set', () => {
    const sum = summarizePortfolio(10, [])
    expect(sum.averageScore).toBeNull()
    expect(sum.totalPolicies).toBe(10)
    expect(sum.filteredPolicies).toBe(0)
    expect(sum.totalAnnualPremiumUsd).toBe(0)
  })
})

describe('computePortfolioDelta', () => {
  function snap(overrides: Partial<PolicySnapshot>): PolicySnapshot {
    return {
      policyId: 'a',
      insurabilityScore: 70,
      retentionRisk: 'LOW',
      carrierName: 'Pacific Mutual',
      ...overrides,
    }
  }

  it('flags material score moves', () => {
    const prior = new Map<string, PolicySnapshot>([
      ['AGENCY_ZOOM:p1', snap({ policyId: 'AGENCY_ZOOM:p1', insurabilityScore: 80 })],
    ])
    const current: PortfolioPolicy[] = [policy({ insurabilityScore: 70 })]
    const delta = computePortfolioDelta(NOW, prior, current)
    expect(delta.scoreMoves).toBe(1)
    expect(delta.topImpacted[0]?.reason).toMatch(/score moved/i)
  })

  it('does not flag sub-threshold score moves', () => {
    const prior = new Map<string, PolicySnapshot>([
      ['AGENCY_ZOOM:p1', snap({ policyId: 'AGENCY_ZOOM:p1', insurabilityScore: 71 })],
    ])
    const current: PortfolioPolicy[] = [policy({ insurabilityScore: 70 })]
    expect(computePortfolioDelta(NOW, prior, current).scoreMoves).toBe(0)
  })

  it('flags retention-risk changes', () => {
    const prior = new Map<string, PolicySnapshot>([
      ['AGENCY_ZOOM:p1', snap({ policyId: 'AGENCY_ZOOM:p1', retentionRisk: 'LOW' })],
    ])
    const current: PortfolioPolicy[] = [policy({ retentionRisk: 'CRITICAL' })]
    const delta = computePortfolioDelta(NOW, prior, current)
    expect(delta.retentionRiskChanges).toBe(1)
  })

  it('flags carrier drops and ranks them first', () => {
    const prior = new Map<string, PolicySnapshot>([
      ['AGENCY_ZOOM:p1', snap({ policyId: 'AGENCY_ZOOM:p1', carrierName: 'Old Co' })],
    ])
    const current: PortfolioPolicy[] = [policy({ carrierName: 'New Co' })]
    const delta = computePortfolioDelta(NOW, prior, current)
    expect(delta.carrierDrops).toBe(1)
    expect(delta.topImpacted[0]?.reason).toMatch(/carrier changed/i)
  })

  it('caps topImpacted at the limit and dedupes by policy', () => {
    const prior = new Map<string, PolicySnapshot>(
      Array.from({ length: 10 }, (_, i) => [
        `id-${i}`,
        snap({ policyId: `id-${i}`, insurabilityScore: 90 }),
      ]),
    )
    const current: PortfolioPolicy[] = Array.from({ length: 10 }, (_, i) =>
      policy({ id: `id-${i}`, insurabilityScore: 50 }),
    )
    const delta = computePortfolioDelta(NOW, prior, current)
    expect(delta.scoreMoves).toBe(10)
    expect(delta.topImpacted.length).toBe(5)
    const ids = delta.topImpacted.map(e => e.policyId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not count brand-new policies (missing from prior)', () => {
    const delta = computePortfolioDelta(NOW, new Map(), [policy({ id: 'fresh' })])
    expect(delta.scoreMoves).toBe(0)
    expect(delta.retentionRiskChanges).toBe(0)
  })
})

describe('performance helpers', () => {
  it('isPortfolioRenderWithinBudget honors the spec 2s budget', () => {
    expect(isPortfolioRenderWithinBudget(PORTFOLIO_LOAD_BUDGET_MS)).toBe(true)
    expect(isPortfolioRenderWithinBudget(PORTFOLIO_LOAD_BUDGET_MS - 1)).toBe(true)
    expect(isPortfolioRenderWithinBudget(PORTFOLIO_LOAD_BUDGET_MS + 1)).toBe(false)
  })

  it('classifyPortfolioRender buckets correctly', () => {
    expect(classifyPortfolioRender(100)).toBe('FAST')
    expect(classifyPortfolioRender(1500)).toBe('OK')
    expect(classifyPortfolioRender(3000)).toBe('SLOW')
  })
})

describe('display helpers', () => {
  it('perilLabel renders human copy per peril', () => {
    expect(perilLabel('WILDFIRE')).toBe('Wildfire')
    expect(perilLabel('CONVECTIVE_STORM')).toBe('Convective storm')
    expect(perilLabel('NONE')).toBe('No dominant peril')
  })

  it('formatPortfolioPremium picks the right unit', () => {
    expect(formatPortfolioPremium(450)).toBe('$450')
    expect(formatPortfolioPremium(2400)).toBe('$2.4K')
    expect(formatPortfolioPremium(1_500_000)).toBe('$1.5M')
  })
})
