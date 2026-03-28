/**
 * Google Maps Geocoding & Places Integration
 *
 * Uses the Google Maps Geocoding API to validate addresses and resolve
 * Google Place IDs into structured address components + coordinates.
 * Used server-side to validate properties before risk analysis.
 */

import { logger } from '../utils/logger'
import { LRUCache } from '../utils/cache'
import type { GeocodedProperty } from '@coverguard/shared'

const GEOCODING_BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
const PLACE_DETAILS_BASE_URL = 'https://maps.googleapis.com/maps/api/place/details/json'

/** Cache geocode results — same placeId always returns same data.
 *  Saves ~100-300ms per repeat lookup and reduces Google API costs. */
const geocodeCache = new LRUCache<GeocodedProperty>(10_000, 24 * 60 * 60 * 1000) // 24hr TTL

function getApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoogleGeocodeResult {
  address_components: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
  formatted_address: string
  geometry: {
    location: { lat: number; lng: number }
    location_type: string
  }
  place_id: string
  types: string[]
}

interface GoogleGeocodeResponse {
  results: GoogleGeocodeResult[]
  status: string
  error_message?: string
}

interface GooglePlaceDetailsResponse {
  result: {
    address_components: Array<{
      long_name: string
      short_name: string
      types: string[]
    }>
    formatted_address: string
    geometry: {
      location: { lat: number; lng: number }
    }
    place_id: string
    name: string
  }
  status: string
  error_message?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractAddressComponent(
  components: Array<{ long_name: string; short_name: string; types: string[] }>,
  type: string,
  useShortName = false,
): string {
  const comp = components.find((c) => c.types.includes(type))
  return comp ? (useShortName ? comp.short_name : comp.long_name) : ''
}

function parseGeocodedResult(result: GoogleGeocodeResult): GeocodedProperty {
  const components = result.address_components

  const streetNumber = extractAddressComponent(components, 'street_number')
  const route = extractAddressComponent(components, 'route')
  const address = [streetNumber, route].filter(Boolean).join(' ') || result.formatted_address.split(',')[0] || ''

  const city =
    extractAddressComponent(components, 'locality') ||
    extractAddressComponent(components, 'sublocality_level_1') ||
    extractAddressComponent(components, 'administrative_area_level_3') ||
    ''

  const state = extractAddressComponent(components, 'administrative_area_level_1', true)
  const zip = extractAddressComponent(components, 'postal_code')
  const county = extractAddressComponent(components, 'administrative_area_level_2').replace(/ County$/, '')

  return {
    address,
    city,
    state,
    zip,
    county,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve a Google Place ID into a validated, geocoded property.
 * Returns null if the Place ID is invalid or the API is unavailable.
 */
export async function geocodeByPlaceId(placeId: string): Promise<GeocodedProperty | null> {
  // L1 cache hit — same placeId always resolves to same address
  const cached = geocodeCache.get(placeId)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    logger.warn('No Google Maps API key configured — cannot geocode place ID')
    return null
  }

  try {
    // Use Geocoding API with place_id (more reliable for address data than Place Details)
    const url = new URL(GEOCODING_BASE_URL)
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      logger.error(`Google Geocoding API HTTP error: ${res.status}`)
      return null
    }

    const data = (await res.json()) as GoogleGeocodeResponse
    if (data.status !== 'OK' || !data.results[0]) {
      logger.warn(`Google Geocoding API status: ${data.status}`, { placeId, error: data.error_message })
      return null
    }

    const result = parseGeocodedResult(data.results[0])
    geocodeCache.set(placeId, result)
    return result
  } catch (err) {
    logger.error('Google Geocoding API request failed', {
      placeId,
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}

/**
 * Geocode a free-text address string into structured property data.
 * Used to validate addresses that don't come from the Places Autocomplete flow.
 * Returns null if the address cannot be resolved.
 */
export async function geocodeByAddress(address: string): Promise<GeocodedProperty | null> {
  const cacheKey = `addr:${address.toLowerCase().trim()}`
  const cached = geocodeCache.get(cacheKey)
  if (cached) return cached

  const apiKey = getApiKey()
  if (!apiKey) {
    logger.warn('No Google Maps API key configured — cannot geocode address')
    return null
  }

  try {
    const url = new URL(GEOCODING_BASE_URL)
    url.searchParams.set('address', address)
    url.searchParams.set('components', 'country:US')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      logger.error(`Google Geocoding API HTTP error: ${res.status}`)
      return null
    }

    const data = (await res.json()) as GoogleGeocodeResponse
    if (data.status !== 'OK' || !data.results[0]) {
      logger.warn(`Google Geocoding API status: ${data.status}`, { address, error: data.error_message })
      return null
    }

    // Prefer results that are street-level (not just city/state)
    const streetResult = data.results.find((r) =>
      r.types.includes('street_address') || r.types.includes('premise') || r.types.includes('subpremise'),
    )

    const result = parseGeocodedResult(streetResult ?? data.results[0])
    geocodeCache.set(cacheKey, result)
    return result
  } catch (err) {
    logger.error('Google Geocoding API request failed', {
      address,
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}

/**
 * Get Place Details for richer property data (name, types, etc.)
 * Used when we need more than what Geocoding provides.
 */
export async function getPlaceDetails(placeId: string): Promise<GeocodedProperty | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  try {
    const url = new URL(PLACE_DETAILS_BASE_URL)
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'address_components,formatted_address,geometry,place_id,name')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = (await res.json()) as GooglePlaceDetailsResponse
    if (data.status !== 'OK' || !data.result) return null

    const result = data.result
    const components = result.address_components
    const streetNumber = extractAddressComponent(components, 'street_number')
    const route = extractAddressComponent(components, 'route')
    const address = [streetNumber, route].filter(Boolean).join(' ') || result.name || ''

    const city =
      extractAddressComponent(components, 'locality') ||
      extractAddressComponent(components, 'sublocality_level_1') ||
      ''

    return {
      address,
      city,
      state: extractAddressComponent(components, 'administrative_area_level_1', true),
      zip: extractAddressComponent(components, 'postal_code'),
      county: extractAddressComponent(components, 'administrative_area_level_2').replace(/ County$/, ''),
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
    }
  } catch (err) {
    logger.error('Google Place Details API request failed', {
      placeId,
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}
