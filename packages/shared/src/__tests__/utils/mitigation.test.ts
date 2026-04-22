import { computeMitigationPlan } from '../../utils/mitigation'
import { MITIGATION_CATALOG } from '../../utils/mitigationCatalog'
import type { InsurabilityStatus, MitigationAction } from '../../types/insurance'

function insurability(
  perilLevels: Partial<Record<'flood' | 'fire' | 'wind' | 'earthquake' | 'crime', InsurabilityStatus['difficultyLevel']>>,
): InsurabilityStatus {
  const make = (level: InsurabilityStatus['difficultyLevel']) => ({
    score: 50,
    level,
    activeCarrierCount: 4,
  })
  return {
    propertyId: 'p1',
    isInsurable: true,
    difficultyLevel: 'MODERATE',
    potentialIssues: [],
    recommendedActions: [],
    overallInsurabilityScore: 50,
    categoryScores: {
      flood: make(perilLevels.flood ?? 'LOW'),
      fire: make(perilLevels.fire ?? 'LOW'),
      wind: make(perilLevels.wind ?? 'LOW'),
      earthquake: make(perilLevels.earthquake ?? 'LOW'),
      crime: make(perilLevels.crime ?? 'LOW'),
    },
  }
}

describe('computeMitigationPlan', () => {
  it('returns only general-peril mitigations when no peril is elevated', () => {
    const plan = computeMitigationPlan('p1', insurability({}), 4000)
    expect(plan.suggestions.length).toBeGreaterThan(0)
    for (const s of plan.suggestions) {
      expect(s.action.peril).toBe('general')
    }
  })

  it('recommends fire-targeted mitigations when fire is elevated', () => {
    const plan = computeMitigationPlan('p1', insurability({ fire: 'HIGH' }), 5000)
    const perils = plan.suggestions.map((s) => s.action.peril)
    expect(perils).toEqual(expect.arrayContaining(['fire']))
  })

  it('limits suggestions to the requested limit', () => {
    const plan = computeMitigationPlan(
      'p1',
      insurability({ fire: 'VERY_HIGH', wind: 'HIGH', flood: 'HIGH' }),
      5000,
      { limit: 2 },
    )
    expect(plan.suggestions).toHaveLength(2)
  })

  it('computes annual savings using the mid-point discount band', () => {
    const fireAction: MitigationAction = {
      id: 'test-fire',
      title: 'Test',
      description: 't',
      peril: 'fire',
      estimatedDiscountMin: 0.1,
      estimatedDiscountMax: 0.2,
      investmentCostMin: 1000,
      investmentCostMax: 3000,
    }
    const plan = computeMitigationPlan('p1', insurability({ fire: 'HIGH' }), 4000, {
      catalog: [fireAction],
    })
    expect(plan.suggestions).toHaveLength(1)
    const suggestion = plan.suggestions[0]
    // mid discount = 15%, baseline 4000 → 600
    expect(suggestion.estimatedAnnualSavings).toBe(600)
    // mid investment = 2000; payback = 2000 / 600 ≈ 3.3
    expect(suggestion.estimatedInvestment).toBe(2000)
    expect(suggestion.paybackYears).toBeCloseTo(3.3, 1)
  })

  it('rolls totalPotentialAnnualSavings across all suggestions', () => {
    const plan = computeMitigationPlan(
      'p1',
      insurability({ fire: 'HIGH', wind: 'HIGH', flood: 'HIGH' }),
      6000,
      { limit: 3 },
    )
    const expected = plan.suggestions.reduce((s, x) => s + x.estimatedAnnualSavings, 0)
    expect(plan.totalPotentialAnnualSavings).toBe(expected)
    expect(plan.totalPotentialAnnualSavings).toBeGreaterThan(0)
  })

  it('always includes a disclaimer', () => {
    const plan = computeMitigationPlan('p1', insurability({}), 4000)
    expect(plan.disclaimer.toLowerCase()).toContain('estimate')
  })

  it('uses the default catalog when no override is passed', () => {
    const plan = computeMitigationPlan(
      'p1',
      insurability({ fire: 'HIGH', wind: 'HIGH', earthquake: 'HIGH', flood: 'HIGH' }),
      5000,
      { limit: MITIGATION_CATALOG.length },
    )
    expect(plan.suggestions.length).toBeGreaterThan(0)
  })
})
