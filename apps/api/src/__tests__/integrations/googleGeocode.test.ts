/**
 * Tests for apps/api/src/integrations/googleGeocode.ts
 */

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

const mockFetch = jest.fn() as jest.Mock
global.fetch = mockFetch

import { geocodeByPlaceId, geocodeByAddress, getPlaceDetails } from '../../integrations/googleGeocode'

// ─── Mock response helpers ──────────────────────────────────────────────────

function makeGeocodeResult(overrides: Partial<{
  streetNumber: string
  route: string
  city: string
  state: string
  stateShort: string
  zip: string
  county: string
  lat: number
  lng: number
  formattedAddress: string
  placeId: string
  types: string[]
  locationType: string
}> = {}) {
  const {
    streetNumber = '123',
    route = 'Main Street',
    city = 'Austin',
    state = 'Texas',
    stateShort = 'TX',
    zip = '78701',
    county = 'Travis County',
    lat = 30.2672,
    lng = -97.7431,
    formattedAddress = '123 Main Street, Austin, TX 78701, USA',
    placeId = 'ChIJrTLr-GyuEmsRBfy61i59si0',
    types = ['street_address'],
    locationType = 'ROOFTOP',
  } = overrides

  return {
    address_components: [
      { long_name: streetNumber, short_name: streetNumber, types: ['street_number'] },
      { long_name: route, short_name: route, types: ['route'] },
      { long_name: city, short_name: city, types: ['locality', 'political'] },
      { long_name: county, short_name: county, types: ['administrative_area_level_2', 'political'] },
      { long_name: state, short_name: stateShort, types: ['administrative_area_level_1', 'political'] },
      { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
      { long_name: zip, short_name: zip, types: ['postal_code'] },
    ],
    formatted_address: formattedAddress,
    geometry: {
      location: { lat, lng },
      location_type: locationType,
    },
    place_id: placeId,
    types,
  }
}

function makeGeocodeResponse(results: ReturnType<typeof makeGeocodeResult>[], status = 'OK') {
  return { results, status }
}

function makePlaceDetailsResponse(overrides: Partial<{
  streetNumber: string
  route: string
  city: string
  state: string
  stateShort: string
  zip: string
  county: string
  lat: number
  lng: number
  formattedAddress: string
  placeId: string
  name: string
}> = {}, status = 'OK') {
  const {
    streetNumber = '456',
    route = 'Oak Avenue',
    city = 'Miami',
    state = 'Florida',
    stateShort = 'FL',
    zip = '33101',
    county = 'Miami-Dade County',
    lat = 25.7617,
    lng = -80.1918,
    formattedAddress = '456 Oak Avenue, Miami, FL 33101, USA',
    placeId = 'ChIJ_abc123',
    name = '456 Oak Avenue',
  } = overrides

  return {
    result: {
      address_components: [
        { long_name: streetNumber, short_name: streetNumber, types: ['street_number'] },
        { long_name: route, short_name: route, types: ['route'] },
        { long_name: city, short_name: city, types: ['locality', 'political'] },
        { long_name: county, short_name: county, types: ['administrative_area_level_2', 'political'] },
        { long_name: state, short_name: stateShort, types: ['administrative_area_level_1', 'political'] },
        { long_name: 'United States', short_name: 'US', types: ['country', 'political'] },
        { long_name: zip, short_name: zip, types: ['postal_code'] },
      ],
      formatted_address: formattedAddress,
      geometry: { location: { lat, lng } },
      place_id: placeId,
      name,
    },
    status,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('googleGeocode integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    mockFetch.mockReset()
    process.env = { ...originalEnv }
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-key'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ─── geocodeByPlaceId ───────────────────────────────────────────────────

  describe('geocodeByPlaceId', () => {
    it('returns null when no API key configured', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      const result = await geocodeByPlaceId('ChIJ_test')
      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns parsed GeocodedProperty on successful API response', async () => {
      const geocodeResult = makeGeocodeResult()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeGeocodeResponse([geocodeResult]),
      })

      const result = await geocodeByPlaceId('ChIJrTLr-GyuEmsRBfy61i59si0')

      expect(result).not.toBeNull()
      expect(result!.address).toBe('123 Main Street')
      expect(result!.city).toBe('Austin')
      expect(result!.state).toBe('TX')
      expect(result!.zip).toBe('78701')
      expect(result!.county).toBe('Travis')
      expect(result!.lat).toBe(30.2672)
      expect(result!.lng).toBe(-97.7431)
      expect(result!.formattedAddress).toBe('123 Main Street, Austin, TX 78701, USA')
      expect(result!.placeId).toBe('ChIJrTLr-GyuEmsRBfy61i59si0')
    })

    it('returns null when API returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [],
          status: 'ZERO_RESULTS',
        }),
      })

      const result = await geocodeByPlaceId('ChIJ_invalid')
      expect(result).toBeNull()
    })

    it('returns null when API returns empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [],
          status: 'OK',
        }),
      })

      const result = await geocodeByPlaceId('ChIJ_empty')
      expect(result).toBeNull()
    })

    it('returns null on network/timeout error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('AbortError: The operation was aborted'))

      const result = await geocodeByPlaceId('ChIJ_timeout')
      expect(result).toBeNull()
    })

    it('parses address components correctly (street_number + route)', async () => {
      const geocodeResult = makeGeocodeResult({
        streetNumber: '9001',
        route: 'Technology Boulevard',
        city: 'San Jose',
        state: 'California',
        stateShort: 'CA',
        zip: '95134',
        county: 'Santa Clara County',
        lat: 37.4133,
        lng: -121.9296,
        formattedAddress: '9001 Technology Boulevard, San Jose, CA 95134, USA',
        placeId: 'ChIJ_sanjose',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeGeocodeResponse([geocodeResult]),
      })

      const result = await geocodeByPlaceId('ChIJ_sanjose')

      expect(result).not.toBeNull()
      expect(result!.address).toBe('9001 Technology Boulevard')
      expect(result!.city).toBe('San Jose')
      expect(result!.state).toBe('CA')
      expect(result!.zip).toBe('95134')
      expect(result!.county).toBe('Santa Clara')
    })
  })

  // ─── geocodeByAddress ───────────────────────────────────────────────────

  describe('geocodeByAddress', () => {
    it('returns null when no API key', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      const result = await geocodeByAddress('123 Main St, Austin, TX')
      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns geocoded result for valid address', async () => {
      const geocodeResult = makeGeocodeResult({
        streetNumber: '100',
        route: 'Willow Way',
        city: 'Miami',
        state: 'Florida',
        stateShort: 'FL',
        zip: '33101',
        county: 'Miami-Dade County',
        lat: 25.7617,
        lng: -80.1918,
        formattedAddress: '100 Willow Way, Miami, FL 33101, USA',
        placeId: 'ChIJ_miami',
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeGeocodeResponse([geocodeResult]),
      })

      const result = await geocodeByAddress('100 Willow Way, Miami, FL')

      expect(result).not.toBeNull()
      expect(result!.address).toBe('100 Willow Way')
      expect(result!.city).toBe('Miami')
      expect(result!.state).toBe('FL')
      expect(result!.lat).toBe(25.7617)

      // Verify the request URL includes address and country component
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('address=')
      expect(calledUrl).toContain('components=country%3AUS')
    })

    it('prefers street-level results over city-level', async () => {
      const cityResult = makeGeocodeResult({
        streetNumber: '',
        route: '',
        city: 'Austin',
        stateShort: 'TX',
        formattedAddress: 'Austin, TX, USA',
        placeId: 'ChIJ_austin_city',
        types: ['locality', 'political'],
      })

      const streetResult = makeGeocodeResult({
        streetNumber: '123',
        route: 'Main Street',
        city: 'Austin',
        stateShort: 'TX',
        formattedAddress: '123 Main Street, Austin, TX 78701, USA',
        placeId: 'ChIJ_street',
        types: ['street_address'],
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeGeocodeResponse([cityResult, streetResult]),
      })

      const result = await geocodeByAddress('123 Main Street, Austin TX')

      expect(result).not.toBeNull()
      expect(result!.placeId).toBe('ChIJ_street')
      expect(result!.address).toBe('123 Main Street')
    })

    it('falls back to first result when no street-level match', async () => {
      const cityResult = makeGeocodeResult({
        city: 'Austin',
        stateShort: 'TX',
        formattedAddress: 'Austin, TX, USA',
        placeId: 'ChIJ_austin_city',
        types: ['locality', 'political'],
      })

      const neighborhoodResult = makeGeocodeResult({
        city: 'Austin',
        stateShort: 'TX',
        formattedAddress: 'Downtown Austin, TX, USA',
        placeId: 'ChIJ_downtown',
        types: ['neighborhood', 'political'],
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeGeocodeResponse([cityResult, neighborhoodResult]),
      })

      const result = await geocodeByAddress('Austin, TX')

      expect(result).not.toBeNull()
      // Should use first result since neither is street-level
      expect(result!.placeId).toBe('ChIJ_austin_city')
    })

    it('returns null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      })

      const result = await geocodeByAddress('123 Main St, Austin, TX')
      expect(result).toBeNull()
    })
  })

  // ─── getPlaceDetails ──────────────────────────────────────────────────────

  describe('getPlaceDetails', () => {
    it('returns null when no API key', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      const result = await getPlaceDetails('ChIJ_test')
      expect(result).toBeNull()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns parsed result from Place Details API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makePlaceDetailsResponse({
          streetNumber: '789',
          route: 'Elm Drive',
          city: 'San Francisco',
          state: 'California',
          stateShort: 'CA',
          zip: '94103',
          county: 'San Francisco County',
          lat: 37.7749,
          lng: -122.4194,
          formattedAddress: '789 Elm Drive, San Francisco, CA 94103, USA',
          placeId: 'ChIJ_sf_place',
          name: '789 Elm Drive',
        }),
      })

      const result = await getPlaceDetails('ChIJ_sf_place')

      expect(result).not.toBeNull()
      expect(result!.address).toBe('789 Elm Drive')
      expect(result!.city).toBe('San Francisco')
      expect(result!.state).toBe('CA')
      expect(result!.zip).toBe('94103')
      expect(result!.county).toBe('San Francisco')
      expect(result!.lat).toBe(37.7749)
      expect(result!.lng).toBe(-122.4194)
      expect(result!.formattedAddress).toBe('789 Elm Drive, San Francisco, CA 94103, USA')
      expect(result!.placeId).toBe('ChIJ_sf_place')

      // Verify it called the Place Details endpoint, not Geocoding
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('place/details')
      expect(calledUrl).toContain('fields=')
    })

    it('returns null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await getPlaceDetails('ChIJ_error')
      expect(result).toBeNull()
    })
  })
})
