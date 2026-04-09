/**
 * Public Property Data Service
 *
 * Fetches publicly accessible property data from multiple sources:
 * - Google Street View / Satellite imagery
 * - ATTOM tax & sale history data
 * - Walk Score API
 * - Google Places (nearby amenities)
 *
 * All sources are public APIs accessed with appropriate keys.
 */

import { publicDataCache, publicDataDeduplicator } from '../utils/cache'
import { logger } from '../utils/logger'
import { prisma } from '../utils/prisma'
import { getPropertyById } from './propertyService'
import type {
  PropertyPublicData,
  PropertyImage,
  PropertyTaxRecord,
  PropertySaleHistory,
  NearbyAmenity,
  PropertyListingData,
  Property,
} from '@coverguard/shared'

// ─── Configuration ───────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const REPILERS_API_KEY = process.env.REPILERS_API_KEY || ''
const WALK_SCORE_KEY = process.env.WALK_SCORE_API_KEY || ''
const ATTOM_BASE_URL = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0'

// ─── Google Street View & Satellite Images ───────────────────────────────────

function getGoogleStreetViewUrl(lat: number, lng: number, heading = 0): string {
  if (!GOOGLE_MAPS_KEY) return ''
  return `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${lat},${lng}&heading=${heading}&pitch=10&fov=90&key=${GOOGLE_MAPS_KEY}`
}

function getGoogleSatelliteUrl(lat: number, lng: number, zoom = 18): string {
  if (!GOOGLE_MAPS_KEY) return ''
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=800x500&maptype=satellite&key=${GOOGLE_MAPS_KEY}`
}

function buildPropertyImages(property: Property): PropertyImage[] {
  const images: PropertyImage[] = []

  if (!GOOGLE_MAPS_KEY || !property.lat || !property.lng) return images

  // Front view
  images.push({
    url: getGoogleStreetViewUrl(property.lat, property.lng, 0),
    source: 'Google Street View',
    caption: `Street view of ${property.address}`,
    type: 'street_view',
  })

  // Side angle view
  images.push({
    url: getGoogleStreetViewUrl(property.lat, property.lng, 90),
    source: 'Google Street View',
    caption: `Side view of ${property.address}`,
    type: 'street_view',
  })

  // Opposite angle
  images.push({
    url: getGoogleStreetViewUrl(property.lat, property.lng, 180),
    source: 'Google Street View',
    caption: `Rear street view of ${property.address}`,
    type: 'street_view',
  })

  // Satellite / aerial
  images.push({
    url: getGoogleSatelliteUrl(property.lat, property.lng, 19),
    source: 'Google Maps Satellite',
    caption: `Aerial view of ${property.address}`,
    type: 'satellite',
  })

  // Wider aerial for neighborhood context
  images.push({
    url: getGoogleSatelliteUrl(property.lat, property.lng, 16),
    source: 'Google Maps Satellite',
    caption: `Neighborhood aerial of ${property.address}`,
    type: 'satellite',
  })

  return images
}

// ─── ATTOM Extended Property Data ────────────────────────────────────────────

interface AttomAssessment {
  tax?: {
    taxamt?: number
    taxyear?: number
    taxrate?: number
  }
  assessed?: {
    assdttlvalue?: number
    assdlandvalue?: number
    assdimprvalue?: number
  }
  market?: {
    mktttlvalue?: number
    mktlandvalue?: number
    mktimprvalue?: number
  }
}

interface AttomSaleRecord {
  amount?: { saleamt?: number; saleprice?: number }
  saleSearchDate?: string
  sellerName?: string
  buyerName?: string
}

interface AttomBuildingDetail {
  summary?: {
    yearbuilt?: number
    yearbuilteffective?: number
    levels?: number
    storydt?: string
  }
  interior?: {
    fplccount?: number
    fplctype?: string
  }
  construction?: {
    roofcover?: string
    roofShape?: string
    foundationtype?: string
    wallType?: string
    condition?: string
  }
  parking?: {
    garagetype?: string
    prkgSpaces?: number
  }
  rooms?: {
    beds?: number
    bathstotal?: number
    bathsfull?: number
    bathshalf?: number
  }
  size?: {
    universalsize?: number
    livingsize?: number
    groundfloorsize?: number
    bldgsize?: number
  }
  heating?: {
    heattype?: string
    heatingfuel?: string
  }
  cooling?: {
    cooltype?: string
  }
}

interface AttomExpandedProfile {
  identifier?: { apn?: string }
  lot?: { lotsize1?: number; lotsize2?: number; pooltype?: string }
  area?: {
    munname?: string
    subdname?: string
    loctype?: string
    countrysecsubd?: string
  }
  assessment?: AttomAssessment
  sale?: AttomSaleRecord
  building?: AttomBuildingDetail[]
  vintage?: { lastModified?: string }
}

async function fetchAttomExpanded(address: string, zip: string): Promise<AttomExpandedProfile | null> {
  if (!REPILERS_API_KEY) return null

  try {
    const url = new URL(`${ATTOM_BASE_URL}/property/expandedprofile`)
    url.searchParams.set('address1', address)
    url.searchParams.set('address2', zip)

    const res = await fetch(url.toString(), {
      headers: { apikey: REPILERS_API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      logger.warn(`ATTOM expanded profile ${res.status} for ${address}, ${zip}`)
      return null
    }

    const data = (await res.json()) as { property?: AttomExpandedProfile[] }
    return data?.property?.[0] ?? null
  } catch (err) {
    logger.error('ATTOM expanded profile fetch failed', {
      error: err instanceof Error ? err.message : err,
    })
    return null
  }
}

interface AttomSaleHistoryResponse {
  property?: Array<{
    salehistory?: Array<{
      amount?: { saleamt?: number }
      salesearchdate?: string
      sellername?: string
      buyername?: string
    }>
    building?: { size?: { universalsize?: number } }
  }>
}

async function fetchAttomSaleHistory(address: string, zip: string): Promise<PropertySaleHistory[]> {
  if (!REPILERS_API_KEY) return []

  try {
    const url = new URL(`${ATTOM_BASE_URL}/saleshistory/detail`)
    url.searchParams.set('address1', address)
    url.searchParams.set('address2', zip)

    const res = await fetch(url.toString(), {
      headers: { apikey: REPILERS_API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return []

    const data = (await res.json()) as AttomSaleHistoryResponse
    const prop = data?.property?.[0]
    if (!prop?.salehistory) return []

    const sqft = prop.building?.size?.universalsize ?? null

    return prop.salehistory
      .filter((s) => s.amount?.saleamt && s.salesearchdate)
      .map((s) => ({
        date: s.salesearchdate!,
        price: s.amount!.saleamt!,
        pricePerSqFt: sqft && sqft > 0 ? Math.round(s.amount!.saleamt! / sqft) : null,
        seller: s.sellername || null,
        buyer: s.buyername || null,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch (err) {
    logger.error('ATTOM sale history fetch failed', {
      error: err instanceof Error ? err.message : err,
    })
    return []
  }
}

// ─── Tax Records ─────────────────────────────────────────────────────────────

function extractTaxRecord(attom: AttomExpandedProfile | null, property: Property): PropertyTaxRecord {
  if (attom?.assessment) {
    const a = attom.assessment
    return {
      assessedValue: a.assessed?.assdttlvalue ?? property.estimatedValue,
      taxAmount: a.tax?.taxamt ?? null,
      taxYear: a.tax?.taxyear ?? null,
      landValue: a.assessed?.assdlandvalue ?? null,
      improvementValue: a.assessed?.assdimprvalue ?? null,
      taxRate: a.tax?.taxrate ?? null,
    }
  }

  // Fallback: estimate from property data
  if (property.estimatedValue) {
    const estimatedTaxRate = getEstimatedTaxRate(property.state)
    return {
      assessedValue: property.estimatedValue,
      taxAmount: Math.round(property.estimatedValue * estimatedTaxRate),
      taxYear: new Date().getFullYear() - 1,
      landValue: null,
      improvementValue: null,
      taxRate: estimatedTaxRate * 100,
    }
  }

  return { assessedValue: null, taxAmount: null, taxYear: null, landValue: null, improvementValue: null, taxRate: null }
}

function getEstimatedTaxRate(state: string): number {
  const rates: Record<string, number> = {
    NJ: 0.0241, IL: 0.0227, NH: 0.0218, CT: 0.0198, WI: 0.0188,
    TX: 0.0181, NE: 0.0173, NY: 0.0168, PA: 0.0153, OH: 0.0152,
    IA: 0.0146, MI: 0.0154, VT: 0.0186, KS: 0.0141, SD: 0.0131,
    MN: 0.0118, FL: 0.0098, MA: 0.0123, RI: 0.0153, ME: 0.0136,
    GA: 0.0092, MD: 0.0106, MO: 0.0097, OR: 0.0097, NC: 0.0084,
    AK: 0.0119, WA: 0.0098, VA: 0.0082, ND: 0.0098, IN: 0.0085,
    CA: 0.0077, MT: 0.0085, AZ: 0.0066, TN: 0.0067, ID: 0.0069,
    NM: 0.0078, MS: 0.0081, OK: 0.0090, KY: 0.0086, AR: 0.0062,
    DE: 0.0057, WV: 0.0058, SC: 0.0057, NV: 0.0060, WY: 0.0057,
    UT: 0.0063, LA: 0.0055, CO: 0.0051, DC: 0.0056, AL: 0.0041,
    HI: 0.0028,
  }
  return rates[state] ?? 0.0110
}

// ─── Listing Data (from ATTOM expanded profile) ─────────────────────────────

function extractListingData(attom: AttomExpandedProfile | null, property: Property): PropertyListingData {
  const building = attom?.building?.[0]
  const assessment = attom?.assessment

  const features: string[] = []
  if (building?.interior?.fplccount) features.push(`${building.interior.fplccount} Fireplace(s)`)
  if (building?.interior?.fplctype) features.push(`Fireplace: ${building.interior.fplctype}`)
  if (building?.parking?.prkgSpaces) features.push(`${building.parking.prkgSpaces} Parking Spaces`)
  if (attom?.lot?.pooltype && attom.lot.pooltype !== 'None') features.push(`Pool: ${attom.lot.pooltype}`)
  if (building?.rooms?.bathsfull) features.push(`${building.rooms.bathsfull} Full Bath(s)`)
  if (building?.rooms?.bathshalf) features.push(`${building.rooms.bathshalf} Half Bath(s)`)

  const marketValue = assessment?.market?.mktttlvalue
  const sqft = building?.size?.universalsize ?? property.squareFeet

  return {
    zestimate: marketValue ?? property.estimatedValue,
    rentEstimate: property.estimatedValue ? Math.round(property.estimatedValue * 0.005) : null,
    daysOnMarket: null,
    listingStatus: attom?.sale?.saleSearchDate
      ? (daysSince(attom.sale.saleSearchDate) < 90 ? 'recently_sold' : 'off_market')
      : 'off_market',
    listPrice: attom?.sale?.amount?.saleamt ?? property.lastSalePrice,
    pricePerSqFt: (marketValue ?? property.estimatedValue) && sqft && sqft > 0
      ? Math.round((marketValue ?? property.estimatedValue!) / sqft)
      : null,
    description: null,
    features,
    yearRenovated: building?.summary?.yearbuilteffective ?? null,
    stories: building?.summary?.levels ?? null,
    garage: building?.parking?.garagetype ?? null,
    heating: building?.heating?.heattype ?? null,
    cooling: building?.cooling?.cooltype ?? null,
    roofType: building?.construction?.roofcover ?? null,
    foundation: building?.construction?.foundationtype ?? null,
    exteriorMaterial: building?.construction?.wallType ?? null,
    hoaFee: null,
  }
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Nearby Amenities (Google Places) ────────────────────────────────────────

interface GooglePlaceResult {
  name: string
  types: string[]
  geometry: { location: { lat: number; lng: number } }
  rating?: number
}

async function fetchNearbyAmenities(lat: number, lng: number): Promise<NearbyAmenity[]> {
  if (!GOOGLE_MAPS_KEY) return []

  const amenityTypes: Array<{ type: string; mapped: NearbyAmenity['type'] }> = [
    { type: 'school', mapped: 'school' },
    { type: 'hospital', mapped: 'hospital' },
    { type: 'fire_station', mapped: 'fire_station' },
    { type: 'police', mapped: 'police' },
    { type: 'park', mapped: 'park' },
    { type: 'supermarket', mapped: 'grocery' },
    { type: 'transit_station', mapped: 'transit' },
  ]

  const results: NearbyAmenity[] = []

  // Fetch top 2 amenity types in parallel to reduce API calls
  const fetches = amenityTypes.map(async ({ type, mapped }) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=${type}&key=${GOOGLE_MAPS_KEY}`
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
      if (!res.ok) return []

      const data = (await res.json()) as { results?: GooglePlaceResult[] }
      const places = data.results?.slice(0, 2) ?? []

      return places.map((place) => ({
        name: place.name,
        type: mapped,
        distance: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
        rating: place.rating ?? null,
      }))
    } catch {
      return []
    }
  })

  const allResults = await Promise.all(fetches)
  for (const batch of allResults) {
    results.push(...batch)
  }

  return results.sort((a, b) => a.distance - b.distance)
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959 // Earth radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// ─── Walk Score ──────────────────────────────────────────────────────────────

interface WalkScoreResponse {
  walkscore?: number
  transit?: { score?: number }
}

async function fetchWalkScore(lat: number, lng: number, address: string): Promise<{ walk: number | null; transit: number | null }> {
  if (!WALK_SCORE_KEY) {
    return estimateWalkScore(lat, lng)
  }

  try {
    const url = `https://api.walkscore.com/score?format=json&lat=${lat}&lon=${lng}&address=${encodeURIComponent(address)}&transit=1&wsapikey=${WALK_SCORE_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return estimateWalkScore(lat, lng)

    const data = (await res.json()) as WalkScoreResponse
    return {
      walk: data.walkscore ?? null,
      transit: data.transit?.score ?? null,
    }
  } catch {
    return estimateWalkScore(lat, lng)
  }
}

function estimateWalkScore(_lat: number, _lng: number): { walk: number | null; transit: number | null } {
  // Return null to indicate we don't have real data
  return { walk: null, transit: null }
}

// ─── Neighborhood Median Values ──────────────────────────────────────────────

function estimateNeighborhoodValues(property: Property): { medianValue: number | null; medianRent: number | null } {
  if (!property.estimatedValue) return { medianValue: null, medianRent: null }

  // Approximate median as ±10% of the property value (rough neighborhood proxy)
  const medianValue = Math.round(property.estimatedValue * 0.95)
  const medianRent = Math.round(medianValue * 0.005)

  return { medianValue, medianRent }
}

// ─── Main Service Function ───────────────────────────────────────────────────

export async function getPropertyPublicData(
  propertyId: string,
  forceRefresh = false,
): Promise<PropertyPublicData> {
  // Check cache first
  if (!forceRefresh) {
    const cached = publicDataCache.get(propertyId)
    if (cached) return cached
  }

  return publicDataDeduplicator.dedupe(propertyId, async () => {
    const property = await getPropertyById(propertyId)
    if (!property) {
      // Use findUniqueOrThrow to generate a P2025 error that the error
      // handler maps to 404 — avoids returning a generic 500.
      await prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { id: true } })
      // Unreachable, but satisfies TypeScript control flow
      throw new Error(`Property ${propertyId} not found`)
    }

    // Fetch from multiple sources in parallel — each source is individually
    // caught so a single upstream failure doesn't crash the entire response.
    const [attomProfile, saleHistory, amenities, walkScores] = await Promise.all([
      fetchAttomExpanded(property.address, property.zip).catch((err) => {
        logger.warn('ATTOM expanded profile failed', { propertyId, error: err instanceof Error ? err.message : err })
        return null
      }),
      fetchAttomSaleHistory(property.address, property.zip).catch((err) => {
        logger.warn('ATTOM sale history failed', { propertyId, error: err instanceof Error ? err.message : err })
        return [] as PropertySaleHistory[]
      }),
      fetchNearbyAmenities(property.lat, property.lng).catch((err) => {
        logger.warn('Nearby amenities fetch failed', { propertyId, error: err instanceof Error ? err.message : err })
        return [] as NearbyAmenity[]
      }),
      fetchWalkScore(property.lat, property.lng, `${property.address}, ${property.city}, ${property.state} ${property.zip}`).catch((err) => {
        logger.warn('Walk score fetch failed', { propertyId, error: err instanceof Error ? err.message : err })
        return { walk: null, transit: null }
      }),
    ])

    const images = buildPropertyImages(property)
    const taxRecords = extractTaxRecord(attomProfile, property)
    const listingData = extractListingData(attomProfile, property)
    const neighborhoodValues = estimateNeighborhoodValues(property)

    // Use ATTOM sale history, or fall back to property's last sale if available
    const finalSaleHistory = saleHistory.length > 0
      ? saleHistory
      : (property.lastSalePrice && property.lastSaleDate
        ? [{
            date: property.lastSaleDate,
            price: property.lastSalePrice,
            pricePerSqFt: property.squareFeet ? Math.round(property.lastSalePrice / property.squareFeet) : null,
            seller: null,
            buyer: null,
          }]
        : [])

    const result: PropertyPublicData = {
      propertyId,
      images,
      taxRecords,
      saleHistory: finalSaleHistory,
      nearbyAmenities: amenities,
      listingData,
      walkScore: walkScores.walk,
      transitScore: walkScores.transit,
      neighborhoodMedianValue: neighborhoodValues.medianValue,
      neighborhoodMedianRent: neighborhoodValues.medianRent,
      lastUpdated: new Date().toISOString(),
    }

    publicDataCache.set(propertyId, result)
    return result
  })
}
