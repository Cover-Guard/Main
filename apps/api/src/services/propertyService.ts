import { prisma } from '../utils/prisma'
import { propertyCache } from '../utils/cache'
import { logger } from '../utils/logger'
import { searchPropertiesByAddress } from '../integrations/propertyData'
import { geocodeByPlaceId } from '../integrations/googleGeocode'
import { PROPERTY_PUBLIC_SELECT } from '../utils/propertySelect'
import type { PropertySearchParams, PropertySearchResult, Property } from '@coverguard/shared'
import { randomUUID } from 'crypto'

export async function searchProperties(
  params: PropertySearchParams,
  userId?: string,
): Promise<PropertySearchResult> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const skip = (page - 1) * limit

  // If a Google Place ID is provided, resolve it to structured address data first
  if (params.placeId) {
    const geocoded = await geocodeByPlaceId(params.placeId)
    if (geocoded) {
      // Use the geocoded address components for the search
      params = {
        ...params,
        address: geocoded.address,
        city: geocoded.city,
        state: geocoded.state,
        zip: geocoded.zip,
        lat: geocoded.lat,
        lng: geocoded.lng,
      }
    }
  }

  // Build DB filter
  const where: Record<string, unknown> = {}
  if (params.zip) where.zip = params.zip
  if (params.state) where.state = params.state
  if (params.city) where.city = { contains: params.city, mode: 'insensitive' }

  // Only attempt DB lookup when we have at least one indexed filter
  const hasFilter = !!(params.zip || params.state || params.city)

  if (hasFilter) {
    // Run count + page fetch in parallel (both use the same WHERE)
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: PROPERTY_PUBLIC_SELECT,
      }),
      prisma.property.count({ where }),
    ])

    if (total > 0) {
      const dbResult = { properties: properties.map(prismaPropertyToDto), total, page, limit }
      // Fire-and-forget: record search history without blocking the response
      prisma.searchHistory
        .create({
          data: {
            userId: userId ?? null,
            query: [params.address, params.city, params.state, params.zip, params.parcelId]
              .filter(Boolean)
              .join(', '),
            resultCount: total,
          },
        })
        .catch((err) => logger.error('Failed to record search history', { error: err instanceof Error ? err.message : err }))
      return dbResult
    }
  }

  // Fall back to external API
  const result = await searchPropertiesByAddress(params)

  // Record search history (fire-and-forget)
  prisma.searchHistory
    .create({
      data: {
        userId: userId ?? null,
        query: [params.address, params.city, params.state, params.zip, params.parcelId]
          .filter(Boolean)
          .join(', '),
        resultCount: result.total,
      },
    })
    .catch((err) => logger.error('Failed to record search history', { error: err instanceof Error ? err.message : err }))

  // Batch-upsert results into DB cache — avoids N sequential round trips
  if (result.properties.length > 0) {
    // Only upsert properties that have a parcelId (required for unique lookup)
    const upsertable = result.properties.filter((p) => p.parcelId)
    if (upsertable.length > 0) {
      await prisma.$transaction(
        upsertable.map((p) => {
          const data = dtoToPrismaData(p)
          return prisma.property.upsert({
            where: { parcelId: p.parcelId! },
            update: data,
            create: { id: p.id, ...data },
          })
        }),
      )
    }

    // Warm the L1 cache for the properties we just fetched
    for (const prop of result.properties) {
      propertyCache.set(prop.id, prop)
    }
  }

  return result
}

// ─── Typeahead suggestions ────────────────────────────────────────────────────

export interface PropertySuggestion {
  id: string
  address: string
  city: string
  state: string
  zip: string
}

export async function suggestProperties(
  query: string,
  limit = 5,
): Promise<PropertySuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []

  // Search DB with case-insensitive partial match on address, city, or zip
  const dbResults = await prisma.property.findMany({
    where: {
      OR: [
        { address: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { zip: { startsWith: q } },
      ],
    },
    select: { id: true, address: true, city: true, state: true, zip: true },
    take: limit,
    orderBy: { createdAt: 'desc' },
  })

  if (dbResults.length >= limit) {
    return dbResults
  }

  // Supplement with mock suggestions if DB doesn't have enough
  const mockSuggestions = getMockSuggestions(q, limit - dbResults.length)
  const seen = new Set(dbResults.map((r) => r.id))
  for (const m of mockSuggestions) {
    if (!seen.has(m.id)) {
      dbResults.push(m)
      seen.add(m.id)
    }
  }

  return dbResults.slice(0, limit)
}

/** Quick mock-based suggestions for typeahead (when DB is sparse). */
function getMockSuggestions(query: string, limit: number): PropertySuggestion[] {
  const q = query.toLowerCase()
  const seeds = [
    { address: '123 Main Street', city: 'Austin', state: 'TX', zip: '78701' },
    { address: '456 Oak Avenue', city: 'Austin', state: 'TX', zip: '78702' },
    { address: '789 Elm Drive', city: 'Austin', state: 'TX', zip: '78703' },
    { address: '321 Cedar Lane', city: 'Austin', state: 'TX', zip: '78704' },
    { address: '555 Maple Court', city: 'Austin', state: 'TX', zip: '78701' },
    { address: '100 Willow Way', city: 'Miami', state: 'FL', zip: '33101' },
    { address: '202 Palm Boulevard', city: 'Miami', state: 'FL', zip: '33139' },
    { address: '75 Ocean Drive', city: 'Miami', state: 'FL', zip: '33139' },
    { address: '900 Market Street', city: 'San Francisco', state: 'CA', zip: '94103' },
    { address: '1425 Noe Street', city: 'San Francisco', state: 'CA', zip: '94131' },
    { address: '342 Divisadero Street', city: 'San Francisco', state: 'CA', zip: '94117' },
    { address: '88 Peachtree Lane', city: 'Atlanta', state: 'GA', zip: '30301' },
    { address: '1500 Lake Shore Drive', city: 'Chicago', state: 'IL', zip: '60610' },
    { address: '230 Broadway', city: 'New York', state: 'NY', zip: '10007' },
    { address: '45 Magnolia Drive', city: 'Houston', state: 'TX', zip: '77002' },
  ]

  return seeds
    .filter((s) => {
      const text = `${s.address} ${s.city} ${s.state} ${s.zip}`.toLowerCase()
      return text.includes(q)
    })
    .slice(0, limit)
    .map((s, i) => ({
      id: `suggest-${i}`,
      address: s.address,
      city: s.city,
      state: s.state,
      zip: s.zip,
    }))
}

/**
 * Resolve a Google Place ID into a validated property record.
 * Creates or finds the property in the database keyed by placeId/address.
 */
export async function geocodeAndCreateProperty(
  placeId: string,
  userId?: string,
): Promise<Property | null> {
  const geocoded = await geocodeByPlaceId(placeId)
  if (!geocoded || !geocoded.address || !geocoded.state) return null

  // Check if we already have this property in DB (match on address + zip)
  const existing = await prisma.property.findFirst({
    where: {
      address: { equals: geocoded.address, mode: 'insensitive' },
      zip: geocoded.zip || undefined,
      state: geocoded.state,
    },
    select: PROPERTY_PUBLIC_SELECT,
  })

  if (existing) {
    // Update lat/lng from Google if they differ significantly (Google geocoding is authoritative)
    const latDiff = Math.abs(existing.lat - geocoded.lat)
    const lngDiff = Math.abs(existing.lng - geocoded.lng)
    if (latDiff > 0.00001 || lngDiff > 0.00001) {
      await prisma.property.update({
        where: { id: existing.id },
        data: { lat: geocoded.lat, lng: geocoded.lng },
      })
    }
    const dto = prismaPropertyToDto({ ...existing, lat: geocoded.lat, lng: geocoded.lng })
    propertyCache.set(dto.id, dto)

    // Record search history
    prisma.searchHistory
      .create({ data: { userId: userId ?? null, query: geocoded.formattedAddress, resultCount: 1 } })
      .catch(() => {})
    return dto
  }

  // Create a new property from geocoded data
  const id = randomUUID()
  const newProp = await prisma.property.create({
    data: {
      id,
      address: geocoded.address,
      city: geocoded.city,
      state: geocoded.state,
      zip: geocoded.zip,
      county: geocoded.county,
      lat: geocoded.lat,
      lng: geocoded.lng,
      propertyType: 'SINGLE_FAMILY',
    },
    select: PROPERTY_PUBLIC_SELECT,
  })

  const dto = prismaPropertyToDto(newProp)
  propertyCache.set(id, dto)

  // Record search history
  prisma.searchHistory
    .create({ data: { userId: userId ?? null, query: geocoded.formattedAddress, resultCount: 1 } })
    .catch(() => {})

  return dto
}

export async function getPropertyById(id: string): Promise<Property | null> {
  // L1 cache hit
  const cached = propertyCache.get(id)
  if (cached) return cached

  const prop = await prisma.property.findUnique({
    where: { id },
    select: PROPERTY_PUBLIC_SELECT,
  })
  if (!prop) return null

  const dto = prismaPropertyToDto(prop)
  propertyCache.set(id, dto)
  return dto
}

function prismaPropertyToDto(
  p: {
    id: string
    address: string
    city: string
    state: string
    zip: string
    county: string
    lat: number
    lng: number
    propertyType: string
    yearBuilt: number | null
    squareFeet: number | null
    bedrooms: number | null
    bathrooms: number | null
    lotSize: number | null
    estimatedValue: number | null
    lastSalePrice: number | null
    lastSaleDate: Date | null
    parcelId: string | null
    createdAt: Date
    updatedAt: Date
  },
): Property {
  return {
    id: p.id,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    lat: p.lat,
    lng: p.lng,
    propertyType: p.propertyType as Property['propertyType'],
    yearBuilt: p.yearBuilt,
    squareFeet: p.squareFeet,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    lotSize: p.lotSize,
    estimatedValue: p.estimatedValue,
    lastSalePrice: p.lastSalePrice,
    lastSaleDate: p.lastSaleDate?.toISOString() ?? null,
    parcelId: p.parcelId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

/** Convert a DTO to Prisma field data (excludes `id` so upsert update doesn't touch the PK). */
function dtoToPrismaData(p: Property) {
  return {
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    lat: p.lat,
    lng: p.lng,
    propertyType: p.propertyType as never,
    yearBuilt: p.yearBuilt,
    squareFeet: p.squareFeet,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    lotSize: p.lotSize,
    estimatedValue: p.estimatedValue,
    lastSalePrice: p.lastSalePrice,
    lastSaleDate: p.lastSaleDate ? new Date(p.lastSaleDate) : null,
    parcelId: p.parcelId,
  }
}
