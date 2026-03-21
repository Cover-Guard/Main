/**
 * Property Data Integration
 *
 * Wraps external property data providers (ATTOM, CoreLogic, etc.).
 * Swap the implementation here without touching business logic.
 */

import type { Property, PropertySearchParams, PropertySearchResult } from '@coverguard/shared'
import { logger } from '../utils/logger'

const ATTOM_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'

interface AttomPropertyDetail {
  identifier: { attomId: string; apn: string }
  address: {
    line1: string
    locality: string
    countrySubd: string
    postal1: string
    oneLine: string
  }
  location: { latitude: string; longitude: string; county: string }
  summary: {
    proptype: string
    yearbuilt: number
    propLandUse: string
  }
  building?: {
    size?: { universalsize: number }
    rooms?: { beds: number; bathstotal: number }
  }
  lot?: { lotsize1: number }
  assessment?: { assessed: { assdttlvalue: number } }
  sale?: { saleamt: number; salesearchdate: string }
}

async function fetchAttom<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const apiKey = process.env.ATTOM_API_KEY
  if (!apiKey) {
    logger.warn('ATTOM_API_KEY not set — using mock property data')
    return null
  }

  const url = new URL(`${ATTOM_BASE_URL}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { apikey: apiKey, accept: 'application/json' },
  })

  if (!res.ok) {
    logger.error(`ATTOM API error ${res.status}: ${path}`)
    return null
  }

  return res.json() as Promise<T>
}

function mapAttomToProperty(attom: AttomPropertyDetail): Omit<Property, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    address: attom.address.line1,
    city: attom.address.locality,
    state: attom.address.countrySubd,
    zip: attom.address.postal1,
    county: attom.location.county,
    lat: parseFloat(attom.location.latitude),
    lng: parseFloat(attom.location.longitude),
    propertyType: 'SINGLE_FAMILY',
    yearBuilt: attom.summary.yearbuilt ?? null,
    squareFeet: attom.building?.size?.universalsize ?? null,
    bedrooms: attom.building?.rooms?.beds ?? null,
    bathrooms: attom.building?.rooms?.bathstotal ?? null,
    lotSize: attom.lot?.lotsize1 ?? null,
    estimatedValue: attom.assessment?.assessed?.assdttlvalue ?? null,
    lastSalePrice: attom.sale?.saleamt ?? null,
    lastSaleDate: attom.sale?.salesearchdate ?? null,
    parcelId: attom.identifier.apn ?? null,
  }
}

/** Search properties by address string. Falls back to mock data if no API key. */
export async function searchPropertiesByAddress(
  params: PropertySearchParams
): Promise<PropertySearchResult> {
  if (!process.env.ATTOM_API_KEY) {
    return getMockSearchResults(params)
  }

  const attomParams: Record<string, string> = {}
  if (params.address) attomParams.address1 = params.address
  if (params.city) attomParams.address2 = `${params.city}, ${params.state ?? ''} ${params.zip ?? ''}`.trim()

  const data = await fetchAttom<{ property: AttomPropertyDetail[] }>(
    '/property/basicprofile',
    attomParams
  )

  if (!data?.property?.length) return { properties: [], total: 0, page: 1, limit: 20 }

  const properties = data.property.map((p) => ({
    id: p.identifier.attomId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...mapAttomToProperty(p),
  }))

  return { properties, total: properties.length, page: params.page ?? 1, limit: params.limit ?? 20 }
}

/** Fetch a single property by ID from external source. */
export async function fetchPropertyById(externalId: string): Promise<Property | null> {
  if (!process.env.ATTOM_API_KEY) return null

  const data = await fetchAttom<{ property: AttomPropertyDetail[] }>('/property/detailwithschools', {
    attomId: externalId,
  })

  if (!data?.property?.[0]) return null

  const p = data.property[0]
  return {
    id: p.identifier.attomId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...mapAttomToProperty(p),
  }
}

// ─── Mock data (used when ATTOM_API_KEY is not configured) ────────────────────

function getMockSearchResults(params: PropertySearchParams): PropertySearchResult {
  const mockProperties: Property[] = [
    {
      id: 'mock-1',
      address: params.address ?? '123 Main Street',
      city: params.city ?? 'Austin',
      state: params.state ?? 'TX',
      zip: params.zip ?? '78701',
      county: 'Travis',
      lat: 30.2672,
      lng: -97.7431,
      propertyType: 'SINGLE_FAMILY',
      yearBuilt: 1998,
      squareFeet: 2100,
      bedrooms: 3,
      bathrooms: 2,
      lotSize: 7200,
      estimatedValue: 620000,
      lastSalePrice: 485000,
      lastSaleDate: '2021-03-15',
      parcelId: 'MOCK-123456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  return { properties: mockProperties, total: mockProperties.length, page: 1, limit: 20 }
}
