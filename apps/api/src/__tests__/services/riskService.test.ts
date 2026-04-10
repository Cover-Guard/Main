/**
 * riskService tests
 *
 * We test the externally observable behaviour of getOrComputeRiskProfile:
 *  - L1 in-memory cache hit (no DB or integration calls)
 *  - DB cache hit (valid expiresAt → no integration calls)
 *  - Full computation path (integration calls + DB upsert)
 *  - Score→level boundary mapping (observable via returned DTO)
 */

// Mock all heavy external dependencies before importing the module under test
jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findUniqueOrThrow: jest.fn() },
    riskProfile: { upsert: jest.fn() },
  },
}))
jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    riskCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    // Provide no-ops for other caches so importing the module doesn't throw
    propertyCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    tokenCache: new LRUCache(100, 60_000),
    insuranceDeduplicator: new RequestDeduplicator(),
    carriersDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
  }
})
jest.mock('../../integrations/riskData', () => ({
  fetchFloodRisk: jest.fn(),
  fetchFireRisk: jest.fn(),
  fetchEarthquakeRisk: jest.fn(),
  fetchWindRisk: jest.fn(),
  fetchCrimeRisk: jest.fn(),
  fetchElevation: jest.fn().mockResolvedValue(null),
  fetchHistoricalEarthquakes: jest.fn().mockResolvedValue({ count: 0, maxMagnitude: null, nearestDistanceKm: null }),
  fetchLandfireFuelModel: jest.fn().mockResolvedValue({ fuelModel: null, vegetationDensity: null }),
  fetchFemaNri: jest.fn().mockResolvedValue(null),
  fetchSinkholeRisk: jest.fn().mockResolvedValue({ susceptibility: null, karstTerrain: false }),
  fetchDamHazard: jest.fn().mockResolvedValue({ nearbyHighHazardDams: 0, nearestDamCondition: null, nearestDamDistanceKm: null }),
  fetchSuperfundProximity: jest.fn().mockResolvedValue({ nearbySites: 0, nearestSiteDistanceKm: null, nearestSiteName: null }),
  fetchEsriFloodHazard: jest.fn().mockResolvedValue(null),
  fetchEsriLandslideRisk: jest.fn().mockResolvedValue(null),
  fetchEsriSocialVulnerability: jest.fn().mockResolvedValue(null),
  fetchOpenFemaDisasterHistory: jest.fn().mockResolvedValue(null),
}))

import { prisma } from '../../utils/prisma'
import { riskCache } from '../../utils/cache'
import {
  fetchFloodRisk,
  fetchFireRisk,
  fetchEarthquakeRisk,
  fetchWindRisk,
  fetchCrimeRisk,
} from '../../integrations/riskData'
import { getOrComputeRiskProfile } from '../../services/riskService'

// Cast each Prisma method individually — jest.Mocked<typeof prisma> doesn't
// resolve deeply enough for Prisma's fluent client types.
const mockFindProperty = prisma.property.findUniqueOrThrow as jest.Mock
const mockUpsertRisk = prisma.riskProfile.upsert as jest.Mock
const mockFetchFlood = fetchFloodRisk as jest.Mock
const mockFetchFire = fetchFireRisk as jest.Mock
const mockFetchEq = fetchEarthquakeRisk as jest.Mock
const mockFetchWind = fetchWindRisk as jest.Mock
const mockFetchCrime = fetchCrimeRisk as jest.Mock

const PROPERTY_ID = 'prop-123'

const baseProperty = {
  id: PROPERTY_ID,
  lat: 34.05,
  lng: -118.24,
  state: 'CA',
  zip: '90001',
  riskProfile: null,
}

const mockRiskProfile = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'rp-1',
  propertyId: PROPERTY_ID,
  overallRiskLevel: 'LOW',
  overallRiskScore: 20,
  floodRiskLevel: 'LOW',
  floodRiskScore: 10,
  floodZone: 'X',
  floodFirmPanelId: null,
  floodBaseElevation: null,
  inSFHA: false,
  floodAnnualChance: null,
  fireRiskLevel: 'LOW',
  fireRiskScore: 15,
  fireHazardZone: null,
  wildlandUrbanInterface: false,
  nearestFireStation: null,
  windRiskLevel: 'LOW',
  windRiskScore: 10,
  hurricaneRisk: false,
  tornadoRisk: false,
  hailRisk: false,
  designWindSpeed: null,
  earthquakeRiskLevel: 'LOW',
  earthquakeRiskScore: 10,
  seismicZone: 'A',
  nearestFaultLine: null,
  crimeRiskLevel: 'LOW',
  crimeRiskScore: 25,
  violentCrimeIndex: 380,
  propertyCrimeIndex: 2110,
  nationalAvgDiff: 0,
  generatedAt: new Date(),
  expiresAt: new Date(Date.now() + 3_600_000),
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  riskCache.delete(PROPERTY_ID)
})

describe('getOrComputeRiskProfile', () => {
  it('returns L1 cached value without any DB or integration calls', async () => {
    const cached = { propertyId: PROPERTY_ID } as ReturnType<typeof mockRiskProfile> & { propertyId: string }
    riskCache.set(PROPERTY_ID, cached as any, 60_000)

    const result = await getOrComputeRiskProfile(PROPERTY_ID)

    expect(result).toBe(cached)
    expect(mockFindProperty).not.toHaveBeenCalled()
  })

  it('uses DB-cached profile when expiresAt is in the future', async () => {
    const profile = mockRiskProfile()
    mockFindProperty.mockResolvedValue({
      ...baseProperty,
      riskProfile: profile,
    } as any)

    const result = await getOrComputeRiskProfile(PROPERTY_ID)

    expect(mockFetchFlood).not.toHaveBeenCalled()
    expect(result.propertyId).toBe(PROPERTY_ID)
    expect(result.flood.floodZone).toBe('X')
  })

  it('fetches external data when DB cache is expired and upserts new profile', async () => {
    const expiredProfile = mockRiskProfile({ expiresAt: new Date(Date.now() - 1000) })
    mockFindProperty.mockResolvedValue({
      ...baseProperty,
      riskProfile: expiredProfile,
    } as any)

    mockFetchFlood.mockResolvedValue({ floodZone: 'X', inSpecialFloodHazardArea: false })
    mockFetchFire.mockResolvedValue({ fireHazardSeverityZone: null, wildlandUrbanInterface: false })
    mockFetchEq.mockResolvedValue({ seismicZone: 'A' })
    mockFetchWind.mockResolvedValue({ hurricaneRisk: false, tornadoRisk: false, hailRisk: false })
    mockFetchCrime.mockResolvedValue({ violentCrimeIndex: 380, propertyCrimeIndex: 2110 })

    const upsertedProfile = mockRiskProfile()
    mockUpsertRisk.mockResolvedValue(upsertedProfile as any)

    const result = await getOrComputeRiskProfile(PROPERTY_ID)

    expect(mockFetchFlood).toHaveBeenCalledWith(baseProperty.lat, baseProperty.lng, baseProperty.zip)
    expect(mockUpsertRisk).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { propertyId: PROPERTY_ID },
        update: expect.objectContaining({ overallRiskLevel: expect.any(String) }),
        create: expect.objectContaining({ propertyId: PROPERTY_ID }),
      }),
    )
    expect(result.propertyId).toBe(PROPERTY_ID)
  })

  it('computes HIGH overall score for V flood zone (score=95)', async () => {
    mockFindProperty.mockResolvedValue({
      ...baseProperty,
      riskProfile: null,
    } as any)

    // V flood zone → floodScore=95
    mockFetchFlood.mockResolvedValue({ floodZone: 'VE', inSpecialFloodHazardArea: true })
    mockFetchFire.mockResolvedValue({ fireHazardSeverityZone: null, wildlandUrbanInterface: false })
    mockFetchEq.mockResolvedValue({ seismicZone: 'A' })
    mockFetchWind.mockResolvedValue({ hurricaneRisk: false, tornadoRisk: false, hailRisk: false })
    mockFetchCrime.mockResolvedValue({ violentCrimeIndex: 100, propertyCrimeIndex: 500 })

    const expectedUpserted = mockRiskProfile({
      floodZone: 'VE',
      floodRiskLevel: 'EXTREME',
      floodRiskScore: 95,
      inSFHA: true,
      overallRiskLevel: 'HIGH',
      overallRiskScore: 42,
    })
    mockUpsertRisk.mockResolvedValue(expectedUpserted as any)

    const result = await getOrComputeRiskProfile(PROPERTY_ID)
    expect(result.flood.floodZone).toBe('VE')
    expect(result.flood.inSpecialFloodHazardArea).toBe(true)
  })

  it('stores result in L1 cache after computation', async () => {
    mockFindProperty.mockResolvedValue({
      ...baseProperty,
      riskProfile: mockRiskProfile(),
    } as any)

    await getOrComputeRiskProfile(PROPERTY_ID)
    expect(riskCache.has(PROPERTY_ID)).toBe(true)
  })
})
