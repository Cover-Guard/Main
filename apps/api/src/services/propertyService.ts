import { prisma } from '../utils/prisma'
import { propertyCache } from '../utils/cache'
import { logger } from '../utils/logger'
import { searchPropertiesByAddress, fetchPropertyAVMValue } from '../integrations/propertyData'
import { geocodeByPlaceId } from '../integrations/googleGeocode'
import { PROPERTY_PUBLIC_SELECT } from '../utils/propertySelect'
import type { PropertySearchParams, PropertySearchResult, Property } from '@coverguard/shared'
import { randomUUID } from 'crypto'

/** Fire-and-forget: record search history without blocking the response. */
function recordSearchHistory(params: PropertySearchParams, userId: string | undefined, resultCount: number): void {
  prisma.searchHistory
    .create({
      data: {
        userId: userId ?? null,
        query: [params.address, params.city, params.state, params.zip, params.parcelId]
          .filter(Boolean)
          .join(', '),
        resultCount,
      },
    })
    .catch((err) => logger.error('Failed to record search history', { error: err instanceof Error ? err.message : err }))
}

export async function searchProperties(
  params: PropertySearchParams,
  userId?: string,
): Promise<PropertySearchResult> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const skip = (page - 1) * limit

  // When a placeId is provided, geocode and find/create the exact property.
  // This ensures the searched address is always the primary result.
  if (params.placeId) {
    const geocodedProperty = await geocodeAndCreateProperty(params.placeId, userId)
    if (geocodedProperty) {
      const nearbyWhere: Record<string, unknown> = {
        zip: geocodedProperty.zip,
        id: { not: geocodedProperty.id },
      }
      const [nearby, nearbyCount] = await Promise.all([
        prisma.property.findMany({
          where: nearbyWhere,
          take: Math.max(limit - 1, 0),
          orderBy: { createdAt: 'desc' },
          select: PROPERTY_PUBLIC_SELECT,
        }),
        prisma.property.count({ where: nearbyWhere }),
      ])

      const properties = [geocodedProperty, ...nearby.map(prismaPropertyToDto)]
      const total = 1 + nearbyCount
      recordSearchHistory(params, userId, total)
      return { properties, total, page: 1, limit }
    }
  }

  // Build DB filter
  const where: Record<string, unknown> = {}
  if (params.address) where.address = { contains: params.address, mode: 'insensitive' }
  if (params.zip) where.zip = params.zip
  if (params.state) where.state = params.state
  if (params.city) where.city = { contains: params.city, mode: 'insensitive' }

  // Only attempt DB lookup when we have at least one indexed filter
  const hasFilter = !!(params.address || params.zip || params.state || params.city)

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
      recordSearchHistory(params, userId, total)
      return dbResult
    }
  }

  // Fall back to external API
  const result = await searchPropertiesByAddress(params)

  recordSearchHistory(params, userId, result.total)

  // Batch-upsert results into DB synchronously so the properties exist when
  // the user immediately opens a report (risk, carriers, etc. need the DB row).
  if (result.properties.length > 0) {
    const upsertable = result.properties.filter((p) => p.parcelId)
    if (upsertable.length > 0) {
      try {
        const upserted = await prisma.$transaction(
          upsertable.map((p) => {
            const data = dtoToPrismaData(p)
            return prisma.property.upsert({
              where: { parcelId: p.parcelId! },
              update: data,
              create: { id: p.id, ...data },
              select: { id: true, parcelId: true },
            })
          }),
        )
        // Remap the returned DTO IDs to the canonical DB IDs. The incoming
        // external-provider id (e.g. a RentCast address slug) may differ
        // from the DB row id when the row was created earlier via the
        // placeId/geocode flow (randomUUID) and is now being re-upserted
        // by parcelId — the update branch preserves the original DB id.
        // Without this remap the client would request /report using the
        // slug, which no longer matches any row and returns 404.
        const idByParcel = new Map(upserted.map((u) => [u.parcelId, u.id]))
        for (const p of result.properties) {
          if (p.parcelId) {
            const canonicalId = idByParcel.get(p.parcelId)
            if (canonicalId && canonicalId !== p.id) {
              p.id = canonicalId
            }
          }
        }
      } catch (err) {
        logger.error('Failed to cache search results in DB', {
          error: err instanceof Error ? err.message : err,
        })
      }
    }
  }

  // Refresh the L1 cache with the (possibly remapped) canonical IDs so
  // subsequent lookups by id hit the cache directly.
  for (const prop of result.properties) {
    propertyCache.set(prop.id, prop)
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

  // Check if we already have this property in DB. Use lat/lng proximity
  // (indexed via @@index([lat, lng])) for the primary match, then verify
  // address/state. This is faster than case-insensitive string matching
  // on address which can't use any index.
  const LAT_TOLERANCE = 0.0005 // ~55 meters
  const LNG_TOLERANCE = 0.0005
  const existing = await prisma.property.findFirst({
    where: {
      lat: { gte: geocoded.lat - LAT_TOLERANCE, lte: geocoded.lat + LAT_TOLERANCE },
      lng: { gte: geocoded.lng - LNG_TOLERANCE, lte: geocoded.lng + LNG_TOLERANCE },
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
        select: { id: true },
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

  // Resolve the incoming identifier to a DB row. Search results may surface
  // external-provider IDs (e.g. RentCast address slugs) that differ from the
  // canonical DB UUID when a row was created earlier via the placeId flow
  // and later upserted by parcelId. Fall back to parcelId lookup so slug
  // IDs still resolve instead of 404-ing.
  const prop = await prisma.property.findFirst({
    where: { OR: [{ id }, { parcelId: id }] },
    select: PROPERTY_PUBLIC_SELECT,
  })
  if (!prop) return null

  const base = prismaPropertyToDto(prop)

  // Enrich with AVM market value (non-blocking — failure is silent).
  // The `as Property` cast below is intentional: the API tsconfig resolves
  // @coverguard/shared via node_modules symlink (which points to the pre-PR
  // main branch where marketValue doesn't exist yet), while the web tsconfig
  // uses an explicit paths mapping to the local source. Once this PR merges
  // both sides will see the new field in sync.
  const marketValue = await fetchPropertyAVMValue(base.address, base.city, base.state, base.zip)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dto = { ...base, marketValue: marketValue ?? undefined } as any as Property

  propertyCache.set(id, dto)
  // Also cache under the canonical id so downstream lookups hit L1.
  if (dto.id !== id) propertyCache.set(dto.id, dto)
  return dto
}

/**
 * Resolve an incoming property identifier (DB id, or external slug stored
 * as parcelId) to the canonical DB id. Returns null if no row matches.
 */
export async function resolvePropertyId(id: string): Promise<string | null> {
  const cached = propertyCache.get(id)
  if (cached) return cached.id
  const row = await prisma.property.findFirst({
    where: { OR: [{ id }, { parcelId: id }] },
    select: { id: true },
  })
  return row?.id ?? null
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
