/**
 * Property Data Integration
 *
 * Wraps external property data providers (RentCast, CoreLogic, etc.).
 * Swap the implementation here without touching business logic.
 */

import type { Property, PropertySearchParams, PropertySearchResult, PropertyType } from '@coverguard/shared'
import { logger } from '../utils/logger'

const RENTCAST_BASE_URL = 'https://api.rentcast.io/v1'

interface RentCastProperty {
  id: string
  formattedAddress: string
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  zipCode: string
  county?: string
  latitude?: number
  longitude?: number
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  lotSize?: number
  yearBuilt?: number
  lastSaleDate?: string
  lastSalePrice?: number
  taxAssessments?: Record<string, { value?: number; land?: number; improvements?: number }>
  features?: Record<string, unknown>
}

async function fetchRentCast<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const apiKey = process.env.RENTCAST_API_KEY
  if (!apiKey) {
    logger.warn('RENTCAST_API_KEY not set — using mock property data')
    return null
  }

  try {
    const url = new URL(`${RENTCAST_BASE_URL}${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json', 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      logger.error(`RentCast API error ${res.status}: ${path}`)
      return null
    }

    return (await res.json()) as T
  } catch (err) {
    logger.error('RentCast API request failed', { path, error: err instanceof Error ? err.message : err })
    return null
  }
}

function mapRentCastToProperty(rc: RentCastProperty): Omit<Property, 'id' | 'createdAt' | 'updatedAt'> {
  // Get the most recent tax assessment value as estimated value
  const assessmentYears = rc.taxAssessments ? Object.keys(rc.taxAssessments).sort().reverse() : []
  const latestAssessment = assessmentYears.length > 0 ? rc.taxAssessments![assessmentYears[0]] : null

  return {
    address: rc.addressLine1,
    city: rc.city,
    state: rc.state,
    zip: rc.zipCode,
    county: rc.county ?? '',
    lat: rc.latitude ?? 0,
    lng: rc.longitude ?? 0,
    propertyType: (rc.propertyType ?? 'SINGLE_FAMILY') as PropertyType,
    yearBuilt: rc.yearBuilt ?? null,
    squareFeet: rc.squareFootage ?? null,
    bedrooms: rc.bedrooms ?? null,
    bathrooms: rc.bathrooms ?? null,
    lotSize: rc.lotSize ?? null,
    estimatedValue: latestAssessment?.value ?? null,
    lastSalePrice: rc.lastSalePrice ?? null,
    lastSaleDate: rc.lastSaleDate ?? null,
    parcelId: rc.id ?? null,
  }
}

/** Search properties by address string. Falls back to mock data if no API key. */
export async function searchPropertiesByAddress(
  params: PropertySearchParams,
): Promise<PropertySearchResult> {
  if (!process.env.RENTCAST_API_KEY) {
    return getMockSearchResults(params)
  }

  const rcParams: Record<string, string> = {}
  if (params.address) rcParams.address = params.address
  if (params.city) rcParams.city = params.city
  if (params.state) rcParams.state = params.state
  if (params.zip) rcParams.zipCode = params.zip
  if (params.limit) rcParams.limit = String(params.limit)
  if (params.page) rcParams.offset = String(((params.page ?? 1) - 1) * (params.limit ?? 20))

  const data = await fetchRentCast<RentCastProperty[]>('/properties', rcParams)

  if (!data?.length) return { properties: [], total: 0, page: 1, limit: 20 }

  const properties = data.map((p) => ({
    id: p.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...mapRentCastToProperty(p),
  }))

  return { properties, total: properties.length, page: params.page ?? 1, limit: params.limit ?? 20 }
}

/** Fetch a single property by ID from external source. */
export async function fetchPropertyById(externalId: string): Promise<Property | null> {
  if (!process.env.RENTCAST_API_KEY) return null

  const data = await fetchRentCast<RentCastProperty[]>('/properties', {
    id: externalId,
  })

  if (!data?.[0]) return null

  const p = data[0]
  return {
    id: p.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...mapRentCastToProperty(p),
  }
}
// ─── Mock data (used when RENTCAST_API_KEY is not configured) ────────────────────

/** Deterministic seed from a string so the same query always returns the same mock results. */
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

interface MockSeed {
  address: string
  city: string
  state: string
  zip: string
  county: string
  lat: number
  lng: number
  type: Property['propertyType']
  yearBuilt: number
  sqft: number
  beds: number
  baths: number
  lot: number
  value: number
  salePrice: number
}

const MOCK_SEEDS: MockSeed[] = [
  { address: '123 Main Street', city: 'Austin', state: 'TX', zip: '78701', county: 'Travis', lat: 30.2672, lng: -97.7431, type: 'SINGLE_FAMILY', yearBuilt: 1998, sqft: 2100, beds: 3, baths: 2, lot: 7200, value: 620000, salePrice: 485000 },
  { address: '456 Oak Avenue', city: 'Austin', state: 'TX', zip: '78702', county: 'Travis', lat: 30.2610, lng: -97.7220, type: 'SINGLE_FAMILY', yearBuilt: 2005, sqft: 1850, beds: 3, baths: 2, lot: 6500, value: 545000, salePrice: 420000 },
  { address: '789 Elm Drive', city: 'Austin', state: 'TX', zip: '78703', county: 'Travis', lat: 30.2890, lng: -97.7640, type: 'SINGLE_FAMILY', yearBuilt: 1975, sqft: 2800, beds: 4, baths: 3, lot: 9600, value: 890000, salePrice: 725000 },
  { address: '321 Cedar Lane', city: 'Austin', state: 'TX', zip: '78704', county: 'Travis', lat: 30.2435, lng: -97.7565, type: 'TOWNHOUSE', yearBuilt: 2018, sqft: 1600, beds: 2, baths: 2, lot: 3200, value: 475000, salePrice: 430000 },
  { address: '555 Maple Court', city: 'Austin', state: 'TX', zip: '78701', county: 'Travis', lat: 30.2710, lng: -97.7390, type: 'CONDO', yearBuilt: 2020, sqft: 1200, beds: 2, baths: 1, lot: 0, value: 380000, salePrice: 365000 },
  { address: '100 Willow Way', city: 'Miami', state: 'FL', zip: '33101', county: 'Miami-Dade', lat: 25.7617, lng: -80.1918, type: 'SINGLE_FAMILY', yearBuilt: 1989, sqft: 2400, beds: 4, baths: 3, lot: 8400, value: 750000, salePrice: 680000 },
  { address: '202 Palm Boulevard', city: 'Miami', state: 'FL', zip: '33139', county: 'Miami-Dade', lat: 25.7907, lng: -80.1340, type: 'CONDO', yearBuilt: 2015, sqft: 1500, beds: 2, baths: 2, lot: 0, value: 620000, salePrice: 570000 },
  { address: '75 Ocean Drive', city: 'Miami', state: 'FL', zip: '33139', county: 'Miami-Dade', lat: 25.7825, lng: -80.1303, type: 'CONDO', yearBuilt: 2010, sqft: 1100, beds: 1, baths: 1, lot: 0, value: 450000, salePrice: 410000 },
  { address: '900 Market Street', city: 'San Francisco', state: 'CA', zip: '94103', county: 'San Francisco', lat: 37.7837, lng: -122.4090, type: 'CONDO', yearBuilt: 2012, sqft: 950, beds: 1, baths: 1, lot: 0, value: 820000, salePrice: 780000 },
  { address: '1425 Noe Street', city: 'San Francisco', state: 'CA', zip: '94131', county: 'San Francisco', lat: 37.7475, lng: -122.4322, type: 'SINGLE_FAMILY', yearBuilt: 1935, sqft: 1800, beds: 3, baths: 2, lot: 3500, value: 1650000, salePrice: 1420000 },
  { address: '342 Divisadero Street', city: 'San Francisco', state: 'CA', zip: '94117', county: 'San Francisco', lat: 37.7725, lng: -122.4370, type: 'MULTI_FAMILY', yearBuilt: 1920, sqft: 3200, beds: 5, baths: 3, lot: 3000, value: 2100000, salePrice: 1800000 },
  { address: '88 Peachtree Lane', city: 'Atlanta', state: 'GA', zip: '30301', county: 'Fulton', lat: 33.7490, lng: -84.3880, type: 'SINGLE_FAMILY', yearBuilt: 2001, sqft: 2600, beds: 4, baths: 3, lot: 8000, value: 520000, salePrice: 460000 },
  { address: '1500 Lake Shore Drive', city: 'Chicago', state: 'IL', zip: '60610', county: 'Cook', lat: 41.9100, lng: -87.6268, type: 'CONDO', yearBuilt: 2008, sqft: 1350, beds: 2, baths: 2, lot: 0, value: 480000, salePrice: 440000 },
  { address: '230 Broadway', city: 'New York', state: 'NY', zip: '10007', county: 'New York', lat: 40.7128, lng: -74.0060, type: 'CONDO', yearBuilt: 2016, sqft: 900, beds: 1, baths: 1, lot: 0, value: 1050000, salePrice: 975000 },
  { address: '45 Magnolia Drive', city: 'Houston', state: 'TX', zip: '77002', county: 'Harris', lat: 29.7604, lng: -95.3698, type: 'SINGLE_FAMILY', yearBuilt: 1992, sqft: 2300, beds: 4, baths: 2, lot: 7800, value: 410000, salePrice: 375000 },
]

function getMockSearchResults(params: PropertySearchParams): PropertySearchResult {
  const query = [params.address, params.city, params.state, params.zip].filter(Boolean).join(' ').toLowerCase()

  // Score each seed property against the search query
  const scored = MOCK_SEEDS.map((seed, idx) => {
    let score = 0
    const seedText = `${seed.address} ${seed.city} ${seed.state} ${seed.zip}`.toLowerCase()

    // Exact field matches
    if (params.zip && seed.zip === params.zip) score += 100
    if (params.state && seed.state.toLowerCase() === params.state.toLowerCase()) score += 50
    if (params.city && seed.city.toLowerCase().includes(params.city.toLowerCase())) score += 40

    // Address word matching
    if (params.address) {
      const words = params.address.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (word.length > 1 && seedText.includes(word)) score += 10
      }
    }

    // General query word matching (fallback)
    if (score === 0) {
      const words = query.split(/\s+/)
      for (const word of words) {
        if (word.length > 1 && seedText.includes(word)) score += 5
      }
    }

    return { seed, idx, score }
  })

  // Return all properties that match at least partially, or the top 5 if nothing matches
  let matches = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)
  if (matches.length === 0) {
    // No direct match — return a few diverse results based on query hash
    const h = hashCode(query)
    const startIdx = h % MOCK_SEEDS.length
    matches = Array.from({ length: 5 }, (_, i) => {
      const idx = (startIdx + i) % MOCK_SEEDS.length
      return scored[idx]!
    })
  }

  const now = new Date().toISOString()
  const properties: Property[] = matches.map(({ seed, idx }) => ({
    id: `mock-${idx + 1}`,
    address: seed.address,
    city: seed.city,
    state: seed.state,
    zip: seed.zip,
    county: seed.county,
    lat: seed.lat,
    lng: seed.lng,
    propertyType: seed.type,
    yearBuilt: seed.yearBuilt,
    squareFeet: seed.sqft,
    bedrooms: seed.beds,
    bathrooms: seed.baths,
    lotSize: seed.lot || null,
    estimatedValue: seed.value,
    lastSalePrice: seed.salePrice,
    lastSaleDate: '2021-03-15',
    parcelId: `MOCK-${String(idx + 1).padStart(6, '0')}`,
    createdAt: now,
    updatedAt: now,
  }))

  const page = Math.max(1, params.page ?? 1)
  const limit = Math.max(1, Math.min(100, params.limit ?? 20))
  const start = (page - 1) * limit
  const paged = properties.slice(start, start + limit)

  return { properties: paged, total: properties.length, page, limit }
}
