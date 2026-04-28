import {
  COMPARISON_PERILS,
  buildComparisonRows,
  comparisonHeadline,
  pickOverallWinnerIndex,
  pickWinnerIndex,
  summarizeComparison,
  validateComparisonSize,
} from '../../utils/comparison'
import type {
  ComparedProperty,
  CrimeRisk,
  EarthquakeRisk,
  FireRisk,
  FloodRisk,
  PropertyRiskProfile,
  Property,
  WindRisk,
} from '../../index'
import {
  MAX_COMPARED_PROPERTIES,
  MIN_COMPARED_PROPERTIES,
} from '../../types/comparison'

const NOW = '2026-04-28T12:00:00Z'

function factor(score: number) {
  return {
    level: 'MODERATE' as const,
    score,
    trend: 'STABLE' as const,
    description: '',
    details: [],
    dataSource: 'test',
    lastUpdated: NOW,
  }
}

function makeProfile(
  propertyId: string,
  scores: { flood: number; fire: number; wind: number; eq: number; crime: number },
): PropertyRiskProfile {
  return {
    propertyId,
    overallRiskLevel: 'MODERATE',
    overallRiskScore: 50,
    flood: { ...factor(scores.flood), floodZone: 'X', firmPanelId: null, baseFloodElevation: null, inSpecialFloodHazardArea: false, annualChanceOfFlooding: null } satisfies FloodRisk,
    fire: { ...factor(scores.fire), fireHazardSeverityZone: null, wildlandUrbanInterface: false, nearestFireStation: null, vegetationDensity: null } satisfies FireRisk,
    wind: { ...factor(scores.wind), designWindSpeed: 110, hurricaneRisk: false, tornadoRisk: false, hailRisk: false } satisfies WindRisk,
    earthquake: { ...factor(scores.eq), seismicZone: null, nearestFaultLine: null, soilType: null, liquefactionPotential: null } satisfies EarthquakeRisk,
    crime: { ...factor(scores.crime), violentCrimeIndex: 100, propertyCrimeIndex: 200, nationalAverageDiff: 0 } satisfies CrimeRisk,
    generatedAt: NOW,
    cacheTtlSeconds: 3600,
  }
}

function makeEntry(
  propertyId: string,
  address: string,
  scores: Parameters<typeof makeProfile>[1],
): ComparedProperty {
  return {
    property: {
      id: propertyId,
      address,
      city: 'Springfield',
      state: 'IL',
      zip: '62704',
      latitude: 0,
      longitude: 0,
    } as unknown as Property,
    profile: makeProfile(propertyId, scores),
  }
}

describe('validateComparisonSize', () => {
  it('rejects fewer than the minimum', () => {
    expect(validateComparisonSize(1)).toEqual({ ok: false, reason: 'TOO_FEW' })
    expect(validateComparisonSize(0)).toEqual({ ok: false, reason: 'TOO_FEW' })
  })

  it('rejects more than the maximum', () => {
    expect(validateComparisonSize(4)).toEqual({ ok: false, reason: 'TOO_MANY' })
    expect(validateComparisonSize(99)).toEqual({ ok: false, reason: 'TOO_MANY' })
  })

  it('accepts the spec range (2-3)', () => {
    expect(validateComparisonSize(MIN_COMPARED_PROPERTIES)).toEqual({ ok: true })
    expect(validateComparisonSize(MAX_COMPARED_PROPERTIES)).toEqual({ ok: true })
  })
})

describe('pickWinnerIndex', () => {
  it('returns the index of the unique lowest score', () => {
    expect(pickWinnerIndex([60, 30, 90])).toBe(1)
  })

  it('returns null on a tie at the lowest', () => {
    expect(pickWinnerIndex([30, 30, 90])).toBeNull()
  })

  it('skips null scores', () => {
    expect(pickWinnerIndex([null, 50, null, 30])).toBe(3)
  })

  it('returns null when every score is null', () => {
    expect(pickWinnerIndex([null, null])).toBeNull()
  })

  it('returns null on an empty input', () => {
    expect(pickWinnerIndex([])).toBeNull()
  })
})

describe('buildComparisonRows', () => {
  it('emits one row per peril in stable order', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 80, fire: 30, wind: 50, eq: 20, crime: 60 }),
      makeEntry('b', '456 B', { flood: 40, fire: 70, wind: 50, eq: 10, crime: 90 }),
    ]
    const rows = buildComparisonRows(entries)
    expect(rows.map((r) => r.peril)).toEqual(COMPARISON_PERILS)
  })

  it('marks the per-peril winner on each row', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 80, fire: 30, wind: 50, eq: 20, crime: 60 }),
      makeEntry('b', '456 B', { flood: 40, fire: 70, wind: 50, eq: 10, crime: 90 }),
    ]
    const byPeril = Object.fromEntries(
      buildComparisonRows(entries).map((r) => [r.peril, r]),
    )
    expect(byPeril.flood.winnerIndex).toBe(1) // 40 < 80
    expect(byPeril.fire.winnerIndex).toBe(0) // 30 < 70
    expect(byPeril.wind.winnerIndex).toBeNull() // tie at 50
    expect(byPeril.earthquake.winnerIndex).toBe(1) // 10 < 20
    expect(byPeril.crime.winnerIndex).toBe(0) // 60 < 90
  })
})

describe('pickOverallWinnerIndex', () => {
  it('picks the property with the lowest sum of scores', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 80, fire: 30, wind: 50, eq: 20, crime: 60 }), // 240
      makeEntry('b', '456 B', { flood: 10, fire: 10, wind: 10, eq: 10, crime: 10 }), // 50
    ]
    expect(pickOverallWinnerIndex(entries)).toBe(1)
  })

  it('returns null when the totals tie', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 50, fire: 50, wind: 50, eq: 50, crime: 50 }),
      makeEntry('b', '456 B', { flood: 50, fire: 50, wind: 50, eq: 50, crime: 50 }),
    ]
    expect(pickOverallWinnerIndex(entries)).toBeNull()
  })

  it('returns null on empty input', () => {
    expect(pickOverallWinnerIndex([])).toBeNull()
  })
})

describe('comparisonHeadline', () => {
  it('describes the overall winner when one exists', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 80, fire: 80, wind: 80, eq: 80, crime: 80 }),
      makeEntry('b', '456 B', { flood: 10, fire: 10, wind: 10, eq: 10, crime: 10 }),
    ]
    expect(comparisonHeadline(entries)).toMatch(/best overall: 456 B/)
  })

  it('flags a tied overall comparison', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 50, fire: 50, wind: 50, eq: 50, crime: 50 }),
      makeEntry('b', '456 B', { flood: 50, fire: 50, wind: 50, eq: 50, crime: 50 }),
    ]
    expect(comparisonHeadline(entries)).toMatch(/tied on overall risk/)
  })

  it('handles 1-property and 0-property edge cases', () => {
    expect(comparisonHeadline([])).toBe('No properties compared')
    expect(
      comparisonHeadline([
        makeEntry('a', '123 A', { flood: 50, fire: 50, wind: 50, eq: 50, crime: 50 }),
      ]),
    ).toMatch(/need at least 2/)
  })
})

describe('summarizeComparison', () => {
  it('returns headline + rows + overallWinnerIndex together', () => {
    const entries: ComparedProperty[] = [
      makeEntry('a', '123 A', { flood: 80, fire: 80, wind: 80, eq: 80, crime: 80 }),
      makeEntry('b', '456 B', { flood: 10, fire: 10, wind: 10, eq: 10, crime: 10 }),
    ]
    const out = summarizeComparison(entries)
    expect(out.headline).toMatch(/best overall: 456 B/)
    expect(out.rows.map((r) => r.peril)).toEqual(COMPARISON_PERILS)
    expect(out.overallWinnerIndex).toBe(1)
  })
})
