import { prisma } from '../utils/prisma'
import { searchPropertiesByAddress } from '../integrations/propertyData'
import type { PropertySearchParams, PropertySearchResult, Property } from '@coverguard/shared'

export async function searchProperties(params: PropertySearchParams): Promise<PropertySearchResult> {
  // First, try to find in local DB (cached results)
  if (params.address || params.zip) {
    const where: Record<string, unknown> = {}
    if (params.zip) where.zip = params.zip
    if (params.state) where.state = params.state
    if (params.city) where.city = { contains: params.city, mode: 'insensitive' }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip: ((params.page ?? 1) - 1) * (params.limit ?? 20),
        take: params.limit ?? 20,
      }),
      prisma.property.count({ where }),
    ])

    if (total > 0) {
      return {
        properties: properties.map(prismaPropertyToDto),
        total,
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      }
    }
  }

  // Fall back to external API
  const result = await searchPropertiesByAddress(params)

  // Cache results in DB
  for (const prop of result.properties) {
    await prisma.property.upsert({
      where: { parcelId: prop.parcelId ?? undefined },
      update: { ...dtoToPrismaCreate(prop) },
      create: dtoToPrismaCreate(prop),
    }).catch(() => { /* ignore duplicate key errors */ })
  }

  return result
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const prop = await prisma.property.findUnique({ where: { id } })
  if (!prop) return null
  return prismaPropertyToDto(prop)
}

function prismaPropertyToDto(p: Awaited<ReturnType<typeof prisma.property.findUniqueOrThrow>>): Property {
  return {
    id: p.id,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county,
    lat: p.lat,
    lng: p.lng,
    propertyType: p.propertyType,
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
