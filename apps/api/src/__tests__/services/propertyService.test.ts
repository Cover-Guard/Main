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
const createMock = jest.fn()

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      create: (...args: unknown[]) => createMock(...args),
    },
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

import { resolvePropertyId, ensurePropertyId } from '../../services/propertyService'
import { geocodeByAddress } from '../../integrations/googleGeocode'

const mockedGeocode = geocodeByAddress as jest.MockedFunction<typeof geocodeByAddress>

beforeEach(() => {
  findFirstMock.mockReset()
  createMock.mockReset()
  mockedGeocode.mockReset()
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

/**
 * ensurePropertyId — the wrapper that falls back to Google geocoding +
 * on-demand row creation when resolvePropertyId can't find a match. This
 * is what makes direct-URL navigation to a never-seen-before address slug
 * work (e.g. /api/properties/6529-Bradford-Ln,-Las-Vegas,-NV-89108/report
 * for a property that was never surfaced by the search flow).
 */
describe('ensurePropertyId', () => {
  it('returns the canonical id when resolvePropertyId finds a direct match, without geocoding', async () => {
    findFirstMock.mockResolvedValueOnce({ id: 'existing-uuid' })

    const id = await ensurePropertyId('rentcast-12345')

    expect(id).toBe('existing-uuid')
    expect(mockedGeocode).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('geocodes and creates a new row when the slug parses but no existing row matches', async () => {
    // resolvePropertyId: no direct hit, no slug match
    findFirstMock.mockResolvedValueOnce(null)
    findFirstMock.mockResolvedValueOnce(null)
    // ensurePropertyId lat/lng proximity check: also no near-duplicate
    findFirstMock.mockResolvedValueOnce(null)

    mockedGeocode.mockResolvedValueOnce({
      placeId: 'ChIJtestBradford',
      address: '6529 Bradford Ln',
      city: 'Las Vegas',
      state: 'NV',
      zip: '89108',
      county: 'Clark County',
      lat: 36.2138,
      lng: -115.2387,
      formattedAddress: '6529 Bradford Ln, Las Vegas, NV 89108, USA',
    })

    createMock.mockResolvedValueOnce({ id: 'new-uuid' })

    const id = await ensurePropertyId('6529-Bradford-Ln,-Las-Vegas,-NV-89108')

    expect(typeof id).toBe('string')
    expect(id).not.toBeNull()
    expect(mockedGeocode).toHaveBeenCalledWith('6529 Bradford Ln, Las Vegas, NV 89108')
    expect(createMock).toHaveBeenCalledTimes(1)
    const createData = createMock.mock.calls[0]?.[0]?.data
    expect(createData).toMatchObject({
      address: '6529 Bradford Ln',
      city: 'Las Vegas',
      state: 'NV',
      zip: '89108',
      county: 'Clark County',
      lat: 36.2138,
      lng: -115.2387,
      propertyType: 'SINGLE_FAMILY',
    })
  })

  it('returns an existing nearby id instead of creating a duplicate when lat/lng proximity matches', async () => {
    // No resolvePropertyId hit
    findFirstMock.mockResolvedValueOnce(null)
    findFirstMock.mockResolvedValueOnce(null)
    // But lat/lng proximity finds an existing row (e.g. created earlier
    // via placeId flow with a slightly different address normalization)
    findFirstMock.mockResolvedValueOnce({ id: 'nearby-uuid' })

    mockedGeocode.mockResolvedValueOnce({
      placeId: 'ChIJtestBradford',
      address: '6529 Bradford Ln',
      city: 'Las Vegas',
      state: 'NV',
      zip: '89108',
      county: 'Clark County',
      lat: 36.2138,
      lng: -115.2387,
      formattedAddress: '6529 Bradford Ln, Las Vegas, NV 89108, USA',
    })

    const id = await ensurePropertyId('6529-Bradford-Ln,-Las-Vegas,-NV-89108')

    expect(id).toBe('nearby-uuid')
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns null when the slug parses but geocoding fails (e.g. missing API key)', async () => {
    findFirstMock.mockResolvedValueOnce(null)
    findFirstMock.mockResolvedValueOnce(null)
    mockedGeocode.mockResolvedValueOnce(null)

    const id = await ensurePropertyId('1-Nowhere-St,-Atlantis,-XX-00000')

    expect(id).toBeNull()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns null without geocoding when the identifier is not a parseable slug', async () => {
    findFirstMock.mockResolvedValueOnce(null)

    const id = await ensurePropertyId('totally-not-a-slug')

    expect(id).toBeNull()
    expect(mockedGeocode).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })
})
