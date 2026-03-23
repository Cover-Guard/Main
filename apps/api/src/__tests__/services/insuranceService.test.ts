/**
 * insuranceService tests
 *
 * Tests getOrComputeInsuranceEstimate including:
 *  - L1 cache hit
 *  - DB-cached estimate (valid expiresAt)
 *  - Full computation with homeowners, flood, and wind premiums
 *  - No flood/wind coverage when risk is below threshold
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findUniqueOrThrow: jest.fn() },
    insuranceEstimate: { upsert: jest.fn() },
  },
}))
jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    insuranceCache: new LRUCache(100, 60_000),
    insuranceDeduplicator: new RequestDeduplicator(),
    riskCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    propertyCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    tokenCache: new LRUCache(100, 60_000),
    carriersDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
  }
})

import { prisma } from '../../utils/prisma'
import { insuranceCache } from '../../utils/cache'
import { getOrComputeInsuranceEstimate } from '../../services/insuranceService'

const mockFindProperty = prisma.property.findUniqueOrThrow as jest.Mock
const mockUpsertEstimate = prisma.insuranceEstimate.upsert as jest.Mock

const PROP_ID = 'prop-ins'

function baseProperty(riskOverrides: Record<string, unknown> = {}, propOverrides: Record<string, unknown> = {}) {
  return {
    id: PROP_ID,
    state: 'CA',
    estimatedValue: 500_000,
    yearBuilt: 2000,
    squareFeet: 2000,
    insuranceEstimate: null,
    riskProfile: {
      floodRiskScore: 20,
      fireRiskScore: 20,
      windRiskScore: 20,
      earthquakeRiskScore: 10,
      hurricaneRisk: false,
      inSFHA: false,
      ...riskOverrides,
    },
    ...propOverrides,
  }
}

function mockEstimate(overrides: Record<string, unknown> = {}) {
  return {
    propertyId: PROP_ID,
    estimatedAnnualTotal: 3_000,
    estimatedMonthlyTotal: 250,
    confidenceLevel: 'MEDIUM',
    homeownersLow: 1_500,
    homeownersHigh: 3_500,
    homeownersAvg: 2_200,
    floodRequired: false,
    floodLow: null,
    floodHigh: null,
    floodAvg: null,
    windRequired: false,
    windLow: null,
    windHigh: null,
    windAvg: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    generatedAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  insuranceCache.delete(PROP_ID)
})

describe('getOrComputeInsuranceEstimate', () => {
  it('returns L1 cached value without DB call', async () => {
    const cached = { propertyId: PROP_ID } as any
    insuranceCache.set(PROP_ID, cached, 60_000)

    const result = await getOrComputeInsuranceEstimate(PROP_ID)

    expect(result).toBe(cached)
    expect(mockFindProperty).not.toHaveBeenCalled()
  })

  it('uses DB-cached estimate when expiresAt is in the future', async () => {
    const estimate = mockEstimate()
    mockFindProperty.mockResolvedValue({
      ...baseProperty(),
      insuranceEstimate: estimate,
    } as any)

    const result = await getOrComputeInsuranceEstimate(PROP_ID)

    expect(mockUpsertEstimate).not.toHaveBeenCalled()
    expect(result.propertyId).toBe(PROP_ID)
    expect(result.estimatedAnnualTotal).toBe(3_000)
  })

  it('skips flood and wind coverage when risk is below thresholds', async () => {
    mockFindProperty.mockResolvedValue(baseProperty() as any)
    const upserted = mockEstimate({ floodRequired: false, windRequired: false })
    mockUpsertEstimate.mockResolvedValue(upserted as any)

    const result = await getOrComputeInsuranceEstimate(PROP_ID)

    expect(result.coverages.find((c) => c.type === 'FLOOD')).toBeUndefined()
    expect(result.coverages.find((c) => c.type === 'WIND_HURRICANE')).toBeUndefined()
    expect(result.coverages.find((c) => c.type === 'HOMEOWNERS')).toBeDefined()
  })

  it('includes FLOOD coverage when property is in SFHA', async () => {
    mockFindProperty.mockResolvedValue(
      baseProperty({ inSFHA: true, floodRiskScore: 80 }) as any,
    )
    const upserted = mockEstimate({
      floodRequired: true,
      floodAvg: 1_200,
      floodLow: 700,
      floodHigh: 2_200,
    })
    mockUpsertEstimate.mockResolvedValue(upserted as any)

    const result = await getOrComputeInsuranceEstimate(PROP_ID)
    const flood = result.coverages.find((c) => c.type === 'FLOOD')
    expect(flood).toBeDefined()
    expect(flood?.required).toBe(true)
  })

  it('includes WIND_HURRICANE coverage when hurricaneRisk=true', async () => {
    mockFindProperty.mockResolvedValue(
      baseProperty({ hurricaneRisk: true, windRiskScore: 75 }) as any,
    )
    const upserted = mockEstimate({
      windRequired: true,
      windAvg: 3_000,
      windLow: 2_100,
      windHigh: 4_200,
    })
    mockUpsertEstimate.mockResolvedValue(upserted as any)

    const result = await getOrComputeInsuranceEstimate(PROP_ID)
    const wind = result.coverages.find((c) => c.type === 'WIND_HURRICANE')
    expect(wind).toBeDefined()
    expect(wind?.required).toBe(true)
  })

  it('computes higher homeowners premium for FL compared to CA', async () => {
    // Two sequential calls for different states
    const flProp = { ...baseProperty({}, { state: 'FL' }), insuranceEstimate: null }
    const caProp = { ...baseProperty({}, { state: 'CA' }), insuranceEstimate: null }

    // Both DB queries return no existing estimate
    mockFindProperty
      .mockResolvedValueOnce(flProp as any)
      .mockResolvedValueOnce(caProp as any)

    // FL upsert — just return something plausible
    const flEstimate = mockEstimate({ homeownersAvg: 8_000, estimatedAnnualTotal: 8_000 })
    const caEstimate = mockEstimate({ homeownersAvg: 2_400, estimatedAnnualTotal: 2_400 })

    mockUpsertEstimate
      .mockResolvedValueOnce(flEstimate as any)
      .mockResolvedValueOnce(caEstimate as any)

    const flResult = await getOrComputeInsuranceEstimate('prop-fl')
    insuranceCache.delete('prop-fl')
    const caResult = await getOrComputeInsuranceEstimate('prop-ca')

    const flHO = flResult.coverages.find((c) => c.type === 'HOMEOWNERS')!
    const caHO = caResult.coverages.find((c) => c.type === 'HOMEOWNERS')!

    // FL multiplier (3.1) >> CA (1.0), so FL premium should be higher
    expect(flHO.averageAnnualPremium).toBeGreaterThan(caHO.averageAnnualPremium)
  })

  it('includes non-empty disclaimers in result', async () => {
    mockFindProperty.mockResolvedValue(baseProperty() as any)
    mockUpsertEstimate.mockResolvedValue(mockEstimate() as any)

    const result = await getOrComputeInsuranceEstimate(PROP_ID)
    expect(result.disclaimers.length).toBeGreaterThan(0)
  })

  it('caches result in L1 cache after computation', async () => {
    mockFindProperty.mockResolvedValue(baseProperty() as any)
    mockUpsertEstimate.mockResolvedValue(mockEstimate() as any)

    await getOrComputeInsuranceEstimate(PROP_ID)
    expect(insuranceCache.has(PROP_ID)).toBe(true)
  })
})
