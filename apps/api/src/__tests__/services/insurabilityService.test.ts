/**
 * insurabilityService tests
 *
 * Tests the difficulty-level derivation logic and the
 * potentialIssues / recommendedActions generation in getInsurabilityStatus.
 */

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findUniqueOrThrow: jest.fn() },
  },
}))
jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    insurabilityCache: new LRUCache(100, 60_000),
    insurabilityDeduplicator: new RequestDeduplicator(),
    riskCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    propertyCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    tokenCache: new LRUCache(100, 60_000),
    insuranceDeduplicator: new RequestDeduplicator(),
    carriersDeduplicator: new RequestDeduplicator(),
  }
})

import { prisma } from '../../utils/prisma'
import { insurabilityCache } from '../../utils/cache'
import { getInsurabilityStatus } from '../../services/insurabilityService'

const mockPrisma = prisma as jest.Mocked<typeof prisma>

const PROP_ID = 'prop-abc'

function mockProperty(riskOverrides: Record<string, unknown> = {}) {
  return {
    id: PROP_ID,
    riskProfile: {
      overallRiskScore: 20,
      floodRiskScore: 20,
      fireRiskScore: 20,
      windRiskScore: 20,
      earthquakeRiskScore: 10,
      inSFHA: false,
      hurricaneRisk: false,
      wildlandUrbanInterface: false,
      ...riskOverrides,
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  insurabilityCache.delete(PROP_ID)
})

describe('getInsurabilityStatus', () => {
  it('returns L1 cached value without DB call', async () => {
    const cached = { propertyId: PROP_ID, difficultyLevel: 'LOW', isInsurable: true } as any
    insurabilityCache.set(PROP_ID, cached, 60_000)

    const result = await getInsurabilityStatus(PROP_ID)

    expect(result).toBe(cached)
    expect(mockPrisma.property.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('returns LOW difficulty for a low-risk property', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(mockProperty() as any)
    const result = await getInsurabilityStatus(PROP_ID)

    expect(result.difficultyLevel).toBe('LOW')
    expect(result.isInsurable).toBe(true)
    expect(result.potentialIssues).toHaveLength(0)
    expect(result.recommendedActions).toContain(
      'Standard insurance should be readily available. Compare quotes from at least 3 carriers.',
    )
  })

  it('returns MODERATE difficulty for overall score 35-54', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ overallRiskScore: 40 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.difficultyLevel).toBe('MODERATE')
    expect(result.isInsurable).toBe(true)
  })

  it('returns HIGH difficulty when property is in SFHA', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ inSFHA: true, overallRiskScore: 30 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.difficultyLevel).toBe('HIGH')
    expect(result.potentialIssues.some((i) => i.includes('SFHA'))).toBe(true)
    expect(result.recommendedActions.some((a) => a.includes('flood insurance'))).toBe(true)
  })

  it('returns HIGH difficulty when hurricaneRisk is true', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ hurricaneRisk: true, windRiskScore: 65, overallRiskScore: 30 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.difficultyLevel).toBe('HIGH')
  })

  it('flags hurricane wind coverage issue when hurricaneRisk=true and windScore>60', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ hurricaneRisk: true, windRiskScore: 70, overallRiskScore: 50 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.potentialIssues.some((i) => i.includes('Hurricane'))).toBe(true)
    expect(result.recommendedActions.some((a) => a.includes('wind'))).toBe(true)
  })

  it('flags WUI and recommends surplus lines for wildlandUrbanInterface property', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ wildlandUrbanInterface: true, fireRiskScore: 55, overallRiskScore: 40 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.potentialIssues.some((i) => i.includes('Wildland-Urban Interface'))).toBe(true)
    expect(result.recommendedActions.some((a) => a.includes('surplus lines'))).toBe(true)
  })

  it('returns VERY_HIGH difficulty for overall >= 75', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ overallRiskScore: 80 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.difficultyLevel).toBe('VERY_HIGH')
    expect(result.isInsurable).toBe(true)
  })

  it('returns EXTREME difficulty and isInsurable=false for overall >= 90', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ overallRiskScore: 92 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.difficultyLevel).toBe('EXTREME')
    expect(result.isInsurable).toBe(false)
  })

  it('recommends earthquake policy for eq score > 70', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ earthquakeRiskScore: 80, overallRiskScore: 30 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.potentialIssues.some((i) => i.includes('seismic'))).toBe(true)
    expect(result.recommendedActions.some((a) => a.includes('earthquake'))).toBe(true)
  })

  it('flags flood risk when flood score > 50 but not in SFHA', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(
      mockProperty({ floodRiskScore: 60, inSFHA: false, overallRiskScore: 20 }) as any,
    )
    const result = await getInsurabilityStatus(PROP_ID)
    expect(result.potentialIssues.some((i) => i.includes('flood'))).toBe(true)
  })

  it('caches the result in L1 cache', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue(mockProperty() as any)
    await getInsurabilityStatus(PROP_ID)
    expect(insurabilityCache.has(PROP_ID)).toBe(true)
  })

  it('uses defaults when property has no riskProfile', async () => {
    mockPrisma.property.findUniqueOrThrow.mockResolvedValue({
      id: PROP_ID,
      riskProfile: null,
    } as any)
    const result = await getInsurabilityStatus(PROP_ID)
    // Defaults → overall=25 → LOW
    expect(result.difficultyLevel).toBe('LOW')
    expect(result.isInsurable).toBe(true)
  })
})
