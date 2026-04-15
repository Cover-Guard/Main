/**
 * propertyService tests
 *
 * Focused on resolvePropertyId — the helper the `:id` route param middleware
 * delegates to. A bug here cascades into 404s on every sub-resource endpoint
 * (/risk, /insurance, /carriers, etc.) for slug-style URLs, which is how the
 * /api/properties/4009-Tyler-William-Ln,-Las-Vegas,-NV-89130/risk 404 was
 * surfacing in production.
 */

const findFirstMock = jest.fn()

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
  },
}))

jest.mock('../../utils/cache', () => {
  const { LRUCache } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    propertyCache: new LRUCache(100, 60_000),
  }
})

// Stub out heavy integrations so importing propertyService doesn't trip on
// missing env vars / network clients during test bootstrap.
jest.mock('../../integrations/propertyData', () => ({
  searchPropertiesByAddress: jest.fn(),
  fetchPropertyAVMValue: jest.fn(),
}))
jest.mock('../../integrations/googleGeocode', () => ({
  geocodeByPlaceId: jest.fn(),
  geocodeByAddress: jest.fn(),
}))

import { resolvePropertyId } from '../../services/propertyService'

beforeEach(() => {
  findFirstMock.mockReset()
})

describe('resolvePropertyId', () => {
  it('returns the canonical id when a direct id/parcelId/externalId hit exists', async () => {
    findFirstMock.mockResolvedValueOnce({ id: 'canonical-uuid' })

    const id = await resolvePropertyId('rentcast-12345')

    expect(id).toBe('canonical-uuid')
    expect(findFirstMock).toHaveBeenCalledTimes(1)
    const where = findFirstMock.mock.calls[0]?.[0]?.where
    expect(where).toEqual({
      OR: [
        { id: 'rentcast-12345' },
        { parcelId: 'rentcast-12345' },
        { externalId: 'rentcast-12345' },
      ],
    })
  })

  it('parses an address slug and resolves it via address+city+state+zip lookup', async () => {
    // First call (direct id/parcelId/externalId match) returns null,
    // second call (slug fallback) returns the canonical id.
    findFirstMock.mockResolvedValueOnce(null)
    findFirstMock.mockResolvedValueOnce({ id: 'db-uuid-from-slug' })

    const id = await resolvePropertyId('4009-Tyler-William-Ln,-Las-Vegas,-NV-89130')

    expect(id).toBe('db-uuid-from-slug')
    expect(findFirstMock).toHaveBeenCalledTimes(2)
    const slugWhere = findFirstMock.mock.calls[1]?.[0]?.where
    expect(slugWhere).toEqual({
      address: { equals: '4009 Tyler William Ln', mode: 'insensitive' },
      city: { equals: 'Las Vegas', mode: 'insensitive' },
      state: 'NV',
      zip: '89130',
    })
  })

  it('returns null when the input is neither a direct hit nor a parseable slug', async () => {
    findFirstMock.mockResolvedValueOnce(null)

    const id = await resolvePropertyId('totally-not-a-known-id')

    expect(id).toBeNull()
    // Only the direct lookup should run; slug parser bails out before any
    // second DB call because the input doesn't contain ',-'.
    expect(findFirstMock).toHaveBeenCalledTimes(1)
  })

  it('returns null when a slug parses but no row matches', async () => {
    findFirstMock.mockResolvedValueOnce(null)
    findFirstMock.mockResolvedValueOnce(null)

    const id = await resolvePropertyId('1-Nowhere-St,-Atlantis,-XX-00000')

    expect(id).toBeNull()
    expect(findFirstMock).toHaveBeenCalledTimes(2)
  })
})
