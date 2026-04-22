import { computeBindPath } from '../../utils/bindPath'
import type { CarriersResult, InsurabilityStatus, Carrier } from '../../types/insurance'

function carrier(status: Carrier['writingStatus'], id = 'c'): Carrier {
  return {
    id,
    name: `Carrier ${id}`,
    amBestRating: 'A',
    writingStatus: status,
    coverageTypes: ['HOMEOWNERS'],
    avgPremiumModifier: 1,
    statesLicensed: ['CA'],
    specialties: [],
    notes: null,
  }
}

function carriersResult(statuses: Carrier['writingStatus'][]): CarriersResult {
  return {
    propertyId: 'p1',
    carriers: statuses.map((s, i) => carrier(s, `c${i}`)),
    marketCondition: 'MODERATE',
    lastUpdated: '2026-04-22T00:00:00Z',
  }
}

function insurability(
  perilLevels: Partial<Record<'flood' | 'fire' | 'wind' | 'earthquake' | 'crime', InsurabilityStatus['difficultyLevel']>>,
): InsurabilityStatus {
  const make = (level: InsurabilityStatus['difficultyLevel']) => ({
    score: 40,
    level,
    activeCarrierCount: 4,
  })
  return {
    propertyId: 'p1',
    isInsurable: true,
    difficultyLevel: 'MODERATE',
    potentialIssues: [],
    recommendedActions: [],
    overallInsurabilityScore: 40,
    categoryScores: {
      flood: make(perilLevels.flood ?? 'LOW'),
      fire: make(perilLevels.fire ?? 'LOW'),
      wind: make(perilLevels.wind ?? 'LOW'),
      earthquake: make(perilLevels.earthquake ?? 'LOW'),
      crime: make(perilLevels.crime ?? 'LOW'),
    },
  }
}

describe('computeBindPath', () => {
  it('returns GREEN when 5+ carriers are open and no peril is elevated', () => {
    const result = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING']),
      insurability({}),
    )
    expect(result.level).toBe('GREEN')
    expect(result.openCarrierCount).toBe(5)
    expect(result.highRiskPerils).toEqual([])
  })

  it('returns RED when only one carrier is actively writing', () => {
    const result = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'NOT_WRITING', 'NOT_WRITING']),
      insurability({}),
    )
    expect(result.level).toBe('RED')
    expect(result.openCarrierCount).toBe(1)
  })

  it('returns RED when two or more perils are elevated', () => {
    const result = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING']),
      insurability({ fire: 'HIGH', flood: 'VERY_HIGH' }),
    )
    expect(result.level).toBe('RED')
    expect(result.highRiskPerils).toEqual(expect.arrayContaining(['Flood', 'Fire']))
  })

  it('returns YELLOW when 2-4 carriers are open or exactly one peril is elevated', () => {
    const twoOpen = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'NOT_WRITING']),
      insurability({}),
    )
    expect(twoOpen.level).toBe('YELLOW')

    const oneHighPeril = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING']),
      insurability({ fire: 'HIGH' }),
    )
    expect(oneHighPeril.level).toBe('YELLOW')
  })

  it('ignores non-writing carriers when counting', () => {
    const result = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'LIMITED', 'SURPLUS_LINES', 'NOT_WRITING']),
      insurability({}),
    )
    expect(result.openCarrierCount).toBe(1)
    expect(result.level).toBe('RED')
  })

  it('produces a human-readable reason string', () => {
    const result = computeBindPath(
      carriersResult(['ACTIVELY_WRITING', 'ACTIVELY_WRITING', 'ACTIVELY_WRITING']),
      insurability({ wind: 'HIGH' }),
    )
    expect(result.reason).toMatch(/carrier/i)
    expect(result.reason).toMatch(/Wind/)
  })
})
