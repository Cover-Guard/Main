import { prisma } from '../utils/prisma'
import { propertyCache } from '../utils/cache'
import { searchPropertiesByAddress } from '../integrations/propertyData'
import type { PropertySearchParams, PropertySearchResult, Property } from '@coverguard/shared'

export async function searchProperties(params: PropertySearchParams): Promise<PropertySearchResult> {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const skip = (page - 1) * limit

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
        // Select only the columns the DTO needs — avoids over-fetching
        select: {
          id: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          county: true,
          lat: true,
          lng: true,
          propertyType: true,
          yearBuilt: true,
          squareFeet: true,
          bedrooms: true,
          bathrooms: true,
          lotSize: true,
          estimatedValue: true,
          lastSalePrice: true,
          lastSaleDate: true,
          parcelId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.property.count({ where }),
    ])

    if (total > 0) {
      return {
        properties: properties.map(prismaPropertyToDto),
        total,
        page,
        limit,
      }
    }
  }

  // Fall back to external API
  const result = await searchPropertiesByAddress(params)

  // Batch-upsert results into DB cache — avoids N sequential round trips
  if (result.properties.length > 0) {
    const creates = result.properties.map(dtoToPrismaCreate)

    // createMany with skipDuplicates is a single INSERT … ON CONFLICT DO NOTHING
    await prisma.property
      .createMany({ data: creates, skipDuplicates: true })
      .catch(() => {
        // Fall back to individual upserts if createMany fails (e.g. unique constraint
        // collisions on externalId vs parcelId that skipDuplicates can't handle)
        return Promise.all(
          creates.map((c) =>
            prisma.property
              .upsert({
                where: { parcelId: c.parcelId ?? undefined },
                update: c,
                create: c,
              })
              .catch(() => null),
          ),
        )
      })

    // Warm the L1 cache for the properties we just fetched
    for (const prop of result.properties) {
      propertyCache.set(prop.id, prop)
    }
  }

  return result
}

export async function getPropertyById(id: string): Promise<Property | null> {
  // L1 cache hit
  const cached = propertyCache.get(id) as Property | undefined
  if (cached) return cached

  const prop = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      county: true,
      lat: true,
      lng: true,
      propertyType: true,
      yearBuilt: true,
      squareFeet: true,
      bedrooms: true,
      bathrooms: true,
      lotSize: true,
      estimatedValue: true,
      lastSalePrice: true,
      lastSaleDate: true,
      parcelId: true,
      createdAt: true,
      updatedAt: true,
    },
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

function dtoToPrismaCreate(p: Property) {
  return {
    id: p.id,
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
