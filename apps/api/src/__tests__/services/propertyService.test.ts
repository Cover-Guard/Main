/**
 * propertyService tests
 *
 * Tests the four exported functions:
 *  - searchProperties: DB lookup, external API fallback, geocoding, pagination, caching
 *  - suggestProperties: typeahead suggestions from DB + mock supplement
 *  - geocodeAndCreateProperty: geocode → find-or-create property
 *  - getPropertyById: L1 cache hit / DB fallback
 */

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))
jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      $transaction: jest.fn(),
    },
    searchHistory: { create: jest.fn().mockReturnValue({ catch: jest.fn() }) },
    $transaction: jest.fn(),
  },
}))
jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    propertyCache: new LRUCache(100, 60_000),
    riskCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    tokenCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
    insuranceDeduplicator: new RequestDeduplicator(),
    carriersDeduplicator: new RequestDeduplicator(),
  }
})
jest.mock('../../integrations/propertyData', () => ({
  searchPropertiesByAddress: jest.fn(),
}))
jest.mock('../../integrations/googleGeocode', () => ({
  geocodeByPlaceId: jest.fn(),
}))
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid-123'),
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
import type { Property } from '@coverguard/shared'

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-15T12:00:00Z')

/** Factory for a Prisma-shaped property row (Date objects for dates). */
function makePrismaProperty(overrides: Partial<{
  id: string; address: string; city: string; state: string; zip: string;
  county: string; lat: number; lng: number; propertyType: string;
  yearBuilt: number | null; squareFeet: number | null; bedrooms: number | null;
  bathrooms: number | null; lotSize: number | null; estimatedValue: number | null;
  lastSalePrice: number | null; lastSaleDate: Date | null; parcelId: string | null;
  createdAt: Date; updatedAt: Date;
}> = {}) {
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
    yearBuilt: 2005,
    squareFeet: 2000,
    bedrooms: 3,
    bathrooms: 2,
    lotSize: 5000,
    estimatedValue: 450_000,
    lastSalePrice: 400_000,
    lastSaleDate: new Date('2023-06-01'),
    parcelId: 'APN-001',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

/** Factory for a DTO-shaped Property (ISO strings for dates). */
function makePropertyDto(overrides: Partial<Property> = {}): Property {
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
    yearBuilt: 2005,
    squareFeet: 2000,
    bedrooms: 3,
    bathrooms: 2,
    lotSize: 5000,
    estimatedValue: 450_000,
    lastSalePrice: 400_000,
    lastSaleDate: '2023-06-01T00:00:00.000Z',
    parcelId: 'APN-001',
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

function makeGeocodedResult(overrides: Record<string, unknown> = {}) {
  return {
    address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip: '78701',
    county: 'Travis',
    lat: 30.27,
    lng: -97.74,
    formattedAddress: '123 Main St, Austin, TX 78701',
    ...overrides,
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

const mockFindMany = prisma.property.findMany as jest.Mock
const mockFindUnique = prisma.property.findUnique as jest.Mock
const mockFindFirst = prisma.property.findFirst as jest.Mock
const mockCount = prisma.property.count as jest.Mock
const mockCreate = prisma.property.create as jest.Mock
const mockUpdate = prisma.property.update as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock
const mockSearchHistoryCreate = prisma.searchHistory.create as jest.Mock
const mockSearchExternal = searchPropertiesByAddress as jest.Mock
const mockGeocodeByPlaceId = geocodeByPlaceId as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  // Clear the L1 cache between tests
  ;(propertyCache as any).map?.clear?.()
  // Re-stub searchHistory.create to return a thenable
  mockSearchHistoryCreate.mockReturnValue({ catch: jest.fn() })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// searchProperties
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('searchProperties', () => {
  it('resolves placeId via geocode before searching', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(makeGeocodedResult())
    mockFindMany.mockResolvedValue([makePrismaProperty()])
    mockCount.mockResolvedValue(1)

    await searchProperties({ placeId: 'ChIJ-test' })

    expect(mockGeocodeByPlaceId).toHaveBeenCalledWith('ChIJ-test')
    // Should have used geocoded zip to query DB
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ zip: '78701' }),
      }),
    )
  })

  it('searches DB when zip filter provided and returns DB results if found', async () => {
    const prismaRow = makePrismaProperty()
    mockFindMany.mockResolvedValue([prismaRow])
    mockCount.mockResolvedValue(1)

    const result = await searchProperties({ zip: '78701' })

    expect(mockFindMany).toHaveBeenCalled()
    expect(mockSearchExternal).not.toHaveBeenCalled()
    expect(result.total).toBe(1)
    expect(result.properties).toHaveLength(1)
    expect(result.properties[0].id).toBe('prop-1')
  })

  it('falls back to external API when DB has no results', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    mockSearchExternal.mockResolvedValue({
      properties: [makePropertyDto()],
      total: 1,
      page: 1,
      limit: 20,
    })
    mockTransaction.mockResolvedValue([])

    const result = await searchProperties({ zip: '78701' })

    expect(mockSearchExternal).toHaveBeenCalled()
    expect(result.total).toBe(1)
  })

  it('falls back to external API when no indexed filter is provided', async () => {
    mockSearchExternal.mockResolvedValue({
      properties: [makePropertyDto({ parcelId: null })],
      total: 1,
      page: 1,
      limit: 20,
    })

    const result = await searchProperties({ address: '123 Main St' })

    // No zip/state/city → skips DB entirely
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockSearchExternal).toHaveBeenCalled()
    expect(result.total).toBe(1)
  })

  it('records search history (fire-and-forget) for DB results', async () => {
    mockFindMany.mockResolvedValue([makePrismaProperty()])
    mockCount.mockResolvedValue(1)

    await searchProperties({ zip: '78701' }, 'user-42')

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-42',
        resultCount: 1,
      }),
    })
  })

  it('records search history for external API results', async () => {
    mockSearchExternal.mockResolvedValue({
      properties: [],
      total: 0,
      page: 1,
      limit: 20,
    })

    await searchProperties({ address: '999 Nowhere' }, 'user-99')

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-99',
        resultCount: 0,
      }),
    })
  })

  it('batch-upserts external results into DB', async () => {
    const props = [
      makePropertyDto({ id: 'p-1', parcelId: 'APN-1' }),
      makePropertyDto({ id: 'p-2', parcelId: 'APN-2' }),
      makePropertyDto({ id: 'p-3', parcelId: null }), // should be excluded from upsert
    ]
    mockSearchExternal.mockResolvedValue({ properties: props, total: 3, page: 1, limit: 20 })
    mockTransaction.mockResolvedValue([])

    await searchProperties({ address: '123 Main' })

    // $transaction should have been called with 2 upsert operations (parcelId: null excluded)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    const txArg = mockTransaction.mock.calls[0][0]
    expect(txArg).toHaveLength(2)
  })

  it('warms L1 cache for fetched external properties', async () => {
    const dto = makePropertyDto({ id: 'warm-me' })
    mockSearchExternal.mockResolvedValue({ properties: [dto], total: 1, page: 1, limit: 20 })
    mockTransaction.mockResolvedValue([])

    await searchProperties({ address: '123 Main' })

    expect(propertyCache.get('warm-me')).toEqual(dto)
  })

  it('applies pagination parameters correctly', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(50)
    mockSearchExternal.mockResolvedValue({ properties: [], total: 0, page: 3, limit: 10 })

    await searchProperties({ zip: '78701', page: 3, limit: 10 })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20, // (3-1)*10
        take: 10,
      }),
    )
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// suggestProperties
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('suggestProperties', () => {
  it('returns empty array for queries shorter than 2 chars', async () => {
    const result = await suggestProperties('A')
    expect(result).toEqual([])
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns DB results when enough are found', async () => {
    const dbRows = Array.from({ length: 5 }, (_, i) => ({
      id: `db-${i}`,
      address: `${100 + i} Main St`,
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    }))
    mockFindMany.mockResolvedValue(dbRows)

    const result = await suggestProperties('Main', 5)

    expect(result).toHaveLength(5)
    expect(result[0].id).toBe('db-0')
  })

  it('supplements with mock suggestions when DB has fewer than limit', async () => {
    // DB returns 1 result, limit is 5 → should supplement with mocks
    mockFindMany.mockResolvedValue([
      { id: 'db-0', address: '123 Main Street', city: 'Austin', state: 'TX', zip: '78701' },
    ])

    const result = await suggestProperties('Main', 5)

    // Should have DB result + mock results for "Main" keyword
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].id).toBe('db-0')
  })

  it('deduplicates DB and mock results by id', async () => {
    // Give DB a result with id that matches a mock id pattern
    mockFindMany.mockResolvedValue([
      { id: 'suggest-0', address: '123 Main Street', city: 'Austin', state: 'TX', zip: '78701' },
    ])

    const result = await suggestProperties('Main', 5)

    // No duplicate ids
    const ids = result.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// geocodeAndCreateProperty
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('geocodeAndCreateProperty', () => {
  it('returns null when geocoding fails', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(null)

    const result = await geocodeAndCreateProperty('bad-place-id')

    expect(result).toBeNull()
    expect(mockFindFirst).not.toHaveBeenCalled()
  })

  it('returns null when geocoded address is missing', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(makeGeocodedResult({ address: '' }))

    const result = await geocodeAndCreateProperty('no-address')

    expect(result).toBeNull()
  })

  it('returns null when geocoded state is missing', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(makeGeocodedResult({ state: '' }))

    const result = await geocodeAndCreateProperty('no-state')

    expect(result).toBeNull()
  })

  it('returns existing property if DB match found', async () => {
    const geocoded = makeGeocodedResult()
    mockGeocodeByPlaceId.mockResolvedValue(geocoded)
    const existingRow = makePrismaProperty()
    mockFindFirst.mockResolvedValue(existingRow)

    const result = await geocodeAndCreateProperty('place-123', 'user-1')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('prop-1')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('updates lat/lng when existing property has significantly different coordinates', async () => {
    const geocoded = makeGeocodedResult({ lat: 30.5, lng: -97.5 })
    mockGeocodeByPlaceId.mockResolvedValue(geocoded)
    // Existing has lat=30.27, lng=-97.74 which differs by >0.00001
    mockFindFirst.mockResolvedValue(makePrismaProperty())

    await geocodeAndCreateProperty('place-shift')

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: { lat: 30.5, lng: -97.5 },
    })
  })

  it('does NOT update lat/lng when coordinates are close enough', async () => {
    const geocoded = makeGeocodedResult({ lat: 30.27, lng: -97.74 })
    mockGeocodeByPlaceId.mockResolvedValue(geocoded)
    mockFindFirst.mockResolvedValue(makePrismaProperty({ lat: 30.27, lng: -97.74 }))

    await geocodeAndCreateProperty('place-same')

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('creates new property when no DB match', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(makeGeocodedResult())
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'mock-uuid-123' })

    const result = await geocodeAndCreateProperty('new-place')

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'mock-uuid-123',
        address: '123 Main St',
        state: 'TX',
        propertyType: 'SINGLE_FAMILY',
      }),
    })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('mock-uuid-123')
  })

  it('records search history for existing property', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(makeGeocodedResult())
    mockFindFirst.mockResolvedValue(makePrismaProperty())

    await geocodeAndCreateProperty('place-existing', 'user-5')

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-5',
        query: '123 Main St, Austin, TX 78701',
        resultCount: 1,
      }),
    })
  })

  it('records search history for new property', async () => {
    mockGeocodeByPlaceId.mockResolvedValue(makeGeocodedResult())
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'mock-uuid-123' })

    await geocodeAndCreateProperty('place-new', 'user-6')

    expect(mockSearchHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-6',
        query: '123 Main St, Austin, TX 78701',
        resultCount: 1,
      }),
    })
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getPropertyById
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('getPropertyById', () => {
  it('returns L1 cached value without DB call', async () => {
    const dto = makePropertyDto({ id: 'cached-1' })
    propertyCache.set('cached-1', dto)

    const result = await getPropertyById('cached-1')

    expect(result).toEqual(dto)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('fetches from DB on cache miss', async () => {
    mockFindUnique.mockResolvedValue(makePrismaProperty({ id: 'db-1' }))

    const result = await getPropertyById('db-1')

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'db-1' },
      select: expect.any(Object),
    })
    expect(result).not.toBeNull()
    expect(result!.id).toBe('db-1')
  })

  it('returns null when property not found in DB', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getPropertyById('nonexistent')

    expect(result).toBeNull()
  })

  it('stores result in L1 cache after DB fetch', async () => {
    mockFindUnique.mockResolvedValue(makePrismaProperty({ id: 'cache-me' }))

    await getPropertyById('cache-me')

    // Second call should hit cache
    mockFindUnique.mockClear()
    const result2 = await getPropertyById('cache-me')
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(result2!.id).toBe('cache-me')
  })
})
