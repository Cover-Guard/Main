/**
 * propertyService tests
 *
 * Tests searchProperties, suggestProperties, geocodeAndCreateProperty,
 * and getPropertyById including DB lookups, external API fallback,
 * L1 caching, fire-and-forget writes, and geocode flows.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    searchHistory: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../utils/cache', () => {
  const { LRUCache } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    propertyCache: new LRUCache(100, 60_000),
    riskCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    tokenCache: new LRUCache(100, 60_000),
    publicDataCache: new LRUCache(100, 60_000),
    riskDeduplicator: { dedupe: jest.fn() },
    insuranceDeduplicator: { dedupe: jest.fn() },
    carriersDeduplicator: { dedupe: jest.fn() },
    insurabilityDeduplicator: { dedupe: jest.fn() },
    publicDataDeduplicator: { dedupe: jest.fn() },
    RequestDeduplicator: jest.fn(),
  }
})

jest.mock('../../integrations/propertyData', () => ({
  searchPropertiesByAddress: jest.fn(),
}))

jest.mock('../../integrations/googleGeocode', () => ({
  geocodeByPlaceId: jest.fn(),
}))

jest.mock('../../utils/propertySelect', () => ({
  PROPERTY_PUBLIC_SELECT: {
    id: true, address: true, city: true, state: true, zip: true, county: true,
    lat: true, lng: true, propertyType: true, yearBuilt: true, squareFeet: true,
    bedrooms: true, bathrooms: true, lotSize: true, estimatedValue: true,
    lastSalePrice: true, lastSaleDate: true, parcelId: true, createdAt: true, updatedAt: true,
  },
}))

import { prisma } from '../../utils/prisma'
import { propertyCache } from '../../utils/cache'
import { searchPropertiesByAddress } from '../../integrations/propertyData'
import { geocodeByPlaceId } from '../../integrations/googleGeocode'
import {
  searchProperties,
  suggestProperties,
  geocodeAndCreateProperty,
  getPropertyById,
} from '../../services/propertyService'

const mockFindMany = prisma.property.findMany as jest.Mock
const mockCount = prisma.property.count as jest.Mock
const mockFindFirst = prisma.property.findFirst as jest.Mock
const mockFindUnique = prisma.property.findUnique as jest.Mock
const mockCreate = prisma.property.create as jest.Mock
const mockUpdate = prisma.property.update as jest.Mock
const mockSearchHistoryCreate = prisma.searchHistory.create as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock
const mockSearchExternal = searchPropertiesByAddress as jest.Mock
const mockGeocode = geocodeByPlaceId as jest.Mock

function mockPrismaProperty(overrides = {}) {
  return {
    id: 'prop-1',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    county: 'Travis',
    lat: 30.27,
    lng: -97.74,
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: 2000,
    squareFeet: 2000,
    bedrooms: 3,
    bathrooms: 2,
    lotSize: 5000,
    estimatedValue: 500000,
    lastSalePrice: 450000,
    lastSaleDate: new Date('2023-01-15'),
    parcelId: 'R123456',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  }
}

function mockPropertyDto(overrides = {}) {
  return {
    id: 'prop-1',
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    county: 'Travis',
    lat: 30.27,
    lng: -97.74,
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: 2000,
    squareFeet: 2000,
    bedrooms: 3,
    bathrooms: 2,
    lotSize: 5000,
    estimatedValue: 500000,
    lastSalePrice: 450000,
    lastSaleDate: '2023-01-15T00:00:00.000Z',
    parcelId: 'R123456',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  // Clear L1 cache between tests
  ;(propertyCache as any).map?.clear?.()
  // Ensure searchHistory.create returns a resolved promise by default
  mockSearchHistoryCreate.mockResolvedValue({})
  mockTransaction.mockResolvedValue([])
})

// ─── searchProperties ────────────────────────────────────────────────────────

describe('searchProperties', () => {
  it('returns DB results when zip filter matches', async () => {
    const prismaRow = mockPrismaProperty()
    mockFindMany.mockResolvedValue([prismaRow])
    mockCount.mockResolvedValue(1)

    const result = await searchProperties({ zip: '78701' })

    expect(result.total).toBe(1)
    expect(result.properties).toHaveLength(1)
    expect(result.properties[0].id).toBe('prop-1')
    expect(result.properties[0].createdAt).toBe('2024-01-01T00:00:00.000Z')
    expect(mockSearchExternal).not.toHaveBeenCalled()
  })

  it('falls back to external API when DB has no results', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const externalDto = mockPropertyDto({ id: 'ext-1', parcelId: 'EXT1' })
    mockSearchExternal.mockResolvedValue({
      properties: [externalDto],
      total: 1,
      page: 1,
      limit: 20,
    })

    const result = await searchProperties({ zip: '78701' })

    expect(result.total).toBe(1)
    expect(result.properties[0].id).toBe('ext-1')
    expect(mockSearchExternal).toHaveBeenCalled()
  })

  it('records search history fire-and-forget', async () => {
    mockFindMany.mockResolvedValue([mockPrismaProperty()])
    mockCount.mockResolvedValue(1)

    await searchProperties({ zip: '78701', city: 'Austin' }, 'user-123')

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-123',
        query: expect.stringContaining('Austin'),
        resultCount: 1,
      }),
    })
  })

  it('with placeId + existing filter: parallel DB + geocode, returns DB results if found', async () => {
    const prismaRow = mockPrismaProperty()
    mockFindMany.mockResolvedValue([prismaRow])
    mockCount.mockResolvedValue(1)
    mockGeocode.mockResolvedValue({
      address: '123 Main St', city: 'Austin', state: 'TX', zip: '78701',
      county: 'Travis', lat: 30.27, lng: -97.74,
      formattedAddress: '123 Main St, Austin, TX 78701', placeId: 'place-1',
    })

    const result = await searchProperties({ zip: '78701', placeId: 'place-1' })

    expect(result.total).toBe(1)
    // Both DB and geocode should have been called in parallel
    expect(mockFindMany).toHaveBeenCalled()
    expect(mockGeocode).toHaveBeenCalledWith('place-1')
  })

  it('with placeId only: geocodes first, then searches', async () => {
    mockGeocode.mockResolvedValue({
      address: '456 Oak Ave', city: 'Austin', state: 'TX', zip: '78702',
      county: 'Travis', lat: 30.28, lng: -97.73,
      formattedAddress: '456 Oak Ave, Austin, TX 78702', placeId: 'place-2',
    })
    // After geocoding, DB search with the geocoded zip
    mockFindMany.mockResolvedValue([mockPrismaProperty({ id: 'prop-2', zip: '78702' })])
    mockCount.mockResolvedValue(1)

    const result = await searchProperties({ placeId: 'place-2' })

    expect(mockGeocode).toHaveBeenCalledWith('place-2')
    expect(result.total).toBe(1)
  })

  it('caches results in L1 cache', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const dto = mockPropertyDto({ id: 'cached-1' })
    mockSearchExternal.mockResolvedValue({
      properties: [dto], total: 1, page: 1, limit: 20,
    })

    await searchProperties({ zip: '78701' })

    expect(propertyCache.get('cached-1')).toMatchObject({ id: 'cached-1' })
  })

  it('batch-upserts results to DB (fire and forget)', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const dto = mockPropertyDto({ id: 'upsert-1', parcelId: 'P100' })
    mockSearchExternal.mockResolvedValue({
      properties: [dto], total: 1, page: 1, limit: 20,
    })

    await searchProperties({ zip: '78701' })

    expect(mockTransaction).toHaveBeenCalled()
  })
})

// ─── suggestProperties ───────────────────────────────────────────────────────

describe('suggestProperties', () => {
  it('returns empty array for query shorter than 2 chars', async () => {
    const result = await suggestProperties('a')
    expect(result).toEqual([])
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns DB results when enough found', async () => {
    const dbResults = Array.from({ length: 5 }, (_, i) => ({
      id: `db-${i}`, address: `${i} Main St`, city: 'Austin', state: 'TX', zip: '78701',
    }))
    mockFindMany.mockResolvedValue(dbResults)

    const result = await suggestProperties('Main', 5)

    expect(result).toHaveLength(5)
    expect(result[0].id).toBe('db-0')
  })

  it('supplements with mock suggestions when DB results < limit', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'db-0', address: '100 Main Street', city: 'Austin', state: 'TX', zip: '78701' },
    ])

    const result = await suggestProperties('Austin', 5)

    expect(result.length).toBeGreaterThan(1)
  })

  it('deduplicates results from DB and mock', async () => {
    mockFindMany.mockResolvedValue([
      { id: 'suggest-0', address: '123 Main Street', city: 'Austin', state: 'TX', zip: '78701' },
    ])

    const result = await suggestProperties('Austin', 5)

    const ids = result.map((r) => r.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ─── geocodeAndCreateProperty ────────────────────────────────────────────────

describe('geocodeAndCreateProperty', () => {
  const geocodedResult = {
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    county: 'Travis',
    lat: 30.27,
    lng: -97.74,
    formattedAddress: '123 Main St, Austin, TX 78701',
    placeId: 'place-abc',
  }

  it('returns null when geocode fails', async () => {
    mockGeocode.mockResolvedValue(null)

    const result = await geocodeAndCreateProperty('bad-place-id')

    expect(result).toBeNull()
  })

  it('returns null when geocoded address missing', async () => {
    mockGeocode.mockResolvedValue({ ...geocodedResult, address: '', state: '' })

    const result = await geocodeAndCreateProperty('place-no-addr')

    expect(result).toBeNull()
  })

  it('finds existing property by proximity + state', async () => {
    mockGeocode.mockResolvedValue(geocodedResult)
    const existing = mockPrismaProperty({ lat: 30.2701, lng: -97.7401 })
    mockFindFirst.mockResolvedValue(existing)

    const result = await geocodeAndCreateProperty('place-abc')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('prop-1')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('updates lat/lng when diff > 0.00001', async () => {
    mockGeocode.mockResolvedValue(geocodedResult)
    // Existing with slightly different coords (diff > 0.00001)
    const existing = mockPrismaProperty({ lat: 30.2705, lng: -97.7405 })
    mockFindFirst.mockResolvedValue(existing)
    mockUpdate.mockResolvedValue({ id: 'prop-1' })

    await geocodeAndCreateProperty('place-abc')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: { lat: 30.27, lng: -97.74 },
      select: { id: true },
    })
  })

  it('creates new property when no proximity match', async () => {
    mockGeocode.mockResolvedValue(geocodedResult)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue(mockPrismaProperty({ id: 'new-prop' }))

    const result = await geocodeAndCreateProperty('place-new', 'user-1')

    expect(result).not.toBeNull()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address: '123 Main St',
          city: 'Austin',
          state: 'TX',
          propertyType: 'SINGLE_FAMILY',
        }),
      }),
    )
  })

  it('records search history', async () => {
    mockGeocode.mockResolvedValue(geocodedResult)
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue(mockPrismaProperty({ id: 'hist-prop' }))

    await geocodeAndCreateProperty('place-hist', 'user-99')

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-99',
        query: '123 Main St, Austin, TX 78701',
        resultCount: 1,
      },
    })
  })
})

// ─── getPropertyById ─────────────────────────────────────────────────────────

describe('getPropertyById', () => {
  it('returns cached property from L1 cache', async () => {
    const dto = mockPropertyDto({ id: 'l1-hit' })
    propertyCache.set('l1-hit', dto as any)

    const result = await getPropertyById('l1-hit')

    expect(result).toMatchObject({ id: 'l1-hit' })
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('fetches from DB and caches when not in L1', async () => {
    const prismaRow = mockPrismaProperty({ id: 'db-fetch' })
    mockFindUnique.mockResolvedValue(prismaRow)

    const result = await getPropertyById('db-fetch')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('db-fetch')
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'db-fetch' },
      select: expect.any(Object),
    })
    // Should now be cached
    expect(propertyCache.get('db-fetch')).toMatchObject({ id: 'db-fetch' })
  })

  it('returns null when property not found', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getPropertyById('nonexistent')

    expect(result).toBeNull()
  })
})
