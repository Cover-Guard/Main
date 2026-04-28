import {
  buildReportNarratives,
  perilScoreFromProfile,
} from '../../utils/buildReportNarratives'
import type {
  CrimeRisk,
  EarthquakeRisk,
  FireRisk,
  FloodRisk,
  HeatRisk,
  PropertyRiskProfile,
  WindRisk,
} from '../../types/risk'

const NOW = new Date('2026-04-28T12:00:00Z')

function makeProfile(
  overrides: Partial<PropertyRiskProfile> = {},
): PropertyRiskProfile {
  const factor = (score: number) => ({
    level: 'MODERATE' as const,
    score,
    trend: 'STABLE' as const,
    description: '',
    details: [],
    dataSource: 'test',
    lastUpdated: NOW.toISOString(),
  })
  return {
    propertyId: 'p-1',
    overallRiskLevel: 'MODERATE',
    overallRiskScore: 50,
    flood: {
      ...factor(80),
      floodZone: 'AE',
      firmPanelId: null,
      baseFloodElevation: null,
      inSpecialFloodHazardArea: true,
      annualChanceOfFlooding: null,
    } satisfies FloodRisk,
    fire: {
      ...factor(30),
      fireHazardSeverityZone: null,
      wildlandUrbanInterface: false,
      nearestFireStation: null,
      vegetationDensity: null,
    } satisfies FireRisk,
    wind: {
      ...factor(45),
      designWindSpeed: 110,
      hurricaneRisk: false,
      tornadoRisk: false,
      hailRisk: false,
    } satisfies WindRisk,
    earthquake: {
      ...factor(20),
      seismicZone: null,
      nearestFaultLine: null,
      soilType: null,
      liquefactionPotential: null,
    } satisfies EarthquakeRisk,
    crime: {
      ...factor(60),
      violentCrimeIndex: 200,
      propertyCrimeIndex: 250,
      nationalAverageDiff: 10,
    } satisfies CrimeRisk,
    generatedAt: NOW.toISOString(),
    cacheTtlSeconds: 3600,
    ...overrides,
  }
}

describe('perilScoreFromProfile', () => {
  it('returns the score for each always-present peril', () => {
    const p = makeProfile()
    expect(perilScoreFromProfile(p, 'flood')).toBe(80)
    expect(perilScoreFromProfile(p, 'fire')).toBe(30)
    expect(perilScoreFromProfile(p, 'wind')).toBe(45)
    expect(perilScoreFromProfile(p, 'earthquake')).toBe(20)
    expect(perilScoreFromProfile(p, 'crime')).toBe(60)
  })

  it('returns null for heat when missing', () => {
    expect(perilScoreFromProfile(makeProfile(), 'heat')).toBeNull()
  })

  it('returns the heat score when populated', () => {
    const p = makeProfile({
      heat: {
        level: 'HIGH',
        score: 70,
        trend: 'WORSENING',
        description: '',
        details: [],
        dataSource: 'test',
        lastUpdated: NOW.toISOString(),
        extremeHeatDays: 30,
        projectedHeatDays2050: 50,
        urbanHeatIslandEffect: 3,
        coolingInfrastructureDeficit: false,
      } satisfies HeatRisk,
    })
    expect(perilScoreFromProfile(p, 'heat')).toBe(70)
  })
})

describe('buildReportNarratives', () => {
  it('emits one TEMPLATE narrative per always-present peril', () => {
    const out = buildReportNarratives(makeProfile(), NOW)
    expect(out.map((n) => n.peril)).toEqual([
      'flood',
      'fire',
      'wind',
      'earthquake',
      'crime',
    ])
    for (const n of out) {
      expect(n.source).toBe('TEMPLATE')
      expect(n.confidence).toBe(1)
      expect(n.propertyId).toBe('p-1')
      expect(n.generatedAt).toBe(NOW.toISOString())
      expect(n.body.length).toBeGreaterThan(10)
    }
  })

  it('appends a heat narrative when the profile has heat data', () => {
    const p = makeProfile({
      heat: {
        level: 'HIGH',
        score: 75,
        trend: 'WORSENING',
        description: '',
        details: [],
        dataSource: 'test',
        lastUpdated: NOW.toISOString(),
        extremeHeatDays: 35,
        projectedHeatDays2050: 60,
        urbanHeatIslandEffect: 4,
        coolingInfrastructureDeficit: true,
      } satisfies HeatRisk,
    })
    const out = buildReportNarratives(p, NOW)
    expect(out.map((n) => n.peril)).toEqual([
      'flood',
      'fire',
      'wind',
      'earthquake',
      'crime',
      'heat',
    ])
  })

  it('uses property-id-prefixed ids so the array is keyable', () => {
    const out = buildReportNarratives(makeProfile(), NOW)
    expect(out.map((n) => n.id)).toEqual([
      'p-1::flood',
      'p-1::fire',
      'p-1::wind',
      'p-1::earthquake',
      'p-1::crime',
    ])
  })

  it('produces band-appropriate template copy (extreme flood)', () => {
    const p = makeProfile()
    const flood = buildReportNarratives(p, NOW).find((n) => n.peril === 'flood')!
    expect(flood.score).toBe(80)
    expect(flood.body).toMatch(/flood/i)
    expect(flood.body.length).toBeGreaterThan(20)
  })
})
