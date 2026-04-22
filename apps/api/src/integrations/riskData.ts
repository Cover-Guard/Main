/**
 * Risk Data Integrations
 *
 * Aggregates risk data from multiple public data sources:
 *
 * FLOOD
 *   - FEMA National Flood Hazard Layer (NFHL) REST API
 *   - OpenFEMA API — historical flood claims by ZIP
 *   - NOAA Sea Level Rise projections (coastal enhancement)
 *   - USGS 3DEP Elevation Point Query Service
 *
 * FIRE
 *   - Cal Fire FHSZ (California only)
 *   - USFS Wildland-Urban Interface (all states)
 *   - NIFC Historical Wildfire Perimeters (recent fire history)
 *   - HIFLD Fire Station locations (nearest fire station distance)
 *   - USGS NLCD Land Cover (vegetation density proxy)
 *
 * EARTHQUAKE
 *   - USGS Design Maps Web Service (ASCE 7-22)
 *   - USGS Earthquake Hazard Tool (PGA fallback)
 *   - USGS Quaternary Fault & Fold Database (nearest fault distance)
 *   - USGS Earthquake Catalog (historical seismic events)
 *
 * WIND / HURRICANE
 *   - NOAA Coastal Services Center / SLOSH (hurricane surge zones + category)
 *   - NOAA Storm Prediction Center historical tornado/hail events
 *   - ASCE 7 Basic Wind Speed by latitude band
 *
 * CRIME
 *   - FBI Crime Data Explorer API (requires API key: FBI_CDE_KEY)
 *   - Census Bureau ACS 5-year estimates (poverty/income proxy when FBI unavailable)
 *
 * ESRI LIVING ATLAS (cross-cutting enrichment for all risk categories)
 *   - Esri USA Flood Hazard Areas — validates/supplements FEMA flood zones
 *   - USDA Wildfire Risk to Communities (Esri-hosted) — wildfire hazard potential
 *   - Esri Historical Hurricane Tracks — IBTrACS storm tracks (Living Atlas)
 *   - CDC Social Vulnerability Index (Esri-hosted) — community vulnerability context
 *   - Esri USA Drought Monitor — drought severity (fire risk modifier)
 *   - USGS Landslide Susceptibility (Esri-hosted) — slope failure risk
 *
 * SUPPLEMENTAL (cross-cutting)
 *   - FEMA National Risk Index (NRI) — composite risk by census tract
 *   - USGS Karst Map — sinkhole susceptibility
 *   - USGS Landslide Susceptibility Map
 *   - National Inventory of Dams (NID) — downstream dam hazard
 *   - EPA Envirofacts — Superfund/brownfield proximity
 *
 * Each function returns a partial result; missing data falls back to
 * computed scores in riskService.ts.
 */

import { logger } from '../utils/logger'
import type { FloodRisk, FireRisk, EarthquakeRisk, CrimeRisk, WindRisk } from '@coverguard/shared'

// ─── Concurrency limiter for external API calls ─────────────────────────────
// Prevents overwhelming external government APIs during traffic bursts.
// Each property risk computation fans out to 12+ APIs in parallel;
// this limits total concurrent outbound requests across all properties.

class ConcurrencyLimiter {
  private running = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

/** Limits concurrent outbound requests to external GIS/API services */
const externalApiLimiter = new ConcurrencyLimiter(20)

/** Wraps fetch with the concurrency limiter */
function limitedFetch(url: string, options?: RequestInit): Promise<Response> {
  return externalApiLimiter.run(() => fetch(url, options))
}

// ─── Shared ArcGIS response type ─────────────────────────────────────────────

interface ArcGISFeatureResult {
  features: Array<{ attributes: Record<string, string | number | null> }>
}

// ─── Distance helper (Haversine) ─────────────────────────────────────────────

function haversineDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3959 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── FEMA Flood ───────────────────────────────────────────────────────────────

interface FemaFloodZoneResult {
  features: Array<{
    attributes: {
      FLD_ZONE: string
      STATIC_BFE: number | null
      FIRM_PAN: string
    }
  }>
}

interface OpenFemaFloodClaim {
  amountPaidOnBuildingClaim: number
  countyCode: string
  dateOfLoss: string
}

export async function fetchFloodRisk(lat: number, lng: number, zip: string): Promise<Partial<FloodRisk>> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates for flood risk', { lat, lng })
    return { floodZone: 'UNKNOWN', inSpecialFloodHazardArea: false }
  }

  const baseUrl = process.env.FEMA_API_BASE_URL ?? 'https://hazards.fema.gov/gis/nfhl/rest/services'
  const nfhlUrl = new URL(`${baseUrl}/public/NFHL/MapServer/28/query`)
  nfhlUrl.searchParams.set('geometry', `${lng},${lat}`)
  nfhlUrl.searchParams.set('geometryType', 'esriGeometryPoint')
  nfhlUrl.searchParams.set('inSR', '4326')
  nfhlUrl.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  nfhlUrl.searchParams.set('outFields', 'FLD_ZONE,STATIC_BFE,FIRM_PAN')
  nfhlUrl.searchParams.set('returnGeometry', 'false')
  nfhlUrl.searchParams.set('f', 'json')

  let floodZoneData: Partial<FloodRisk> = { floodZone: 'UNKNOWN', inSpecialFloodHazardArea: false }

  try {
    const res = await limitedFetch(nfhlUrl.toString(), { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as FemaFloodZoneResult
      const feature = data.features?.[0]?.attributes
      if (feature) {
        const sfhaZones = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE']
        const inSFHA = sfhaZones.some((z) => feature.FLD_ZONE?.startsWith(z))
        floodZoneData = {
          floodZone: feature.FLD_ZONE,
          firmPanelId: feature.FIRM_PAN ?? null,
          baseFloodElevation: feature.STATIC_BFE ?? null,
          inSpecialFloodHazardArea: inSFHA,
          annualChanceOfFlooding: inSFHA
            ? (feature.FLD_ZONE?.startsWith('V') ? 1.5
               : feature.FLD_ZONE === 'AE' || feature.FLD_ZONE === 'AH' ? 1.0
               : feature.FLD_ZONE === 'AO' ? 1.0
               : feature.FLD_ZONE === 'AR' ? 0.5
               : 1.0)
            : (feature.FLD_ZONE === 'X' ? 0.1
               : feature.FLD_ZONE === 'B' || feature.FLD_ZONE === 'X500' ? 0.2
               : feature.FLD_ZONE === 'C' ? 0.05
               : feature.FLD_ZONE === 'D' ? null  // D = undetermined
               : 0.1),
        }
      }
    }
  } catch (err) {
    logger.warn('FEMA NFHL API unavailable', { err })
  }

  // Enrich with OpenFEMA historical claims for the ZIP
  const claimsPromise = zip ? fetchOpenFemaClaims(zip, floodZoneData) : Promise.resolve()

  // Enrich with NOAA sea level rise for coastal properties
  const slrPromise = fetchNoaaSeaLevelRise(lat, lng, floodZoneData)

  // Enrich with Esri USA Flood Hazard Areas for cross-validation
  const esriFloodPromise = fetchEsriFloodHazardEnrichment(lat, lng, floodZoneData)

  await Promise.all([claimsPromise, slrPromise, esriFloodPromise])

  return floodZoneData
}

/** Esri USA Flood Hazard Areas — cross-validates FEMA flood zone when primary data is missing */
async function fetchEsriFloodHazardEnrichment(lat: number, lng: number, floodZoneData: Partial<FloodRisk>): Promise<void> {
  if (floodZoneData.floodZone && floodZoneData.floodZone !== 'UNKNOWN') return // already have primary data
  try {
    const url = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs?.FLD_ZONE) {
        const zone = attrs.FLD_ZONE as string
        const sfhaZones = ['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE']
        const inSFHA = sfhaZones.some((z) => zone.startsWith(z))
        floodZoneData.floodZone = zone
        floodZoneData.inSpecialFloodHazardArea = inSFHA
        floodZoneData.annualChanceOfFlooding = inSFHA ? 1.0 : 0.1
      }
    }
  } catch (err) {
    logger.warn('Esri USA Flood Hazard enrichment unavailable', { err })
  }
}

async function fetchOpenFemaClaims(zip: string, floodZoneData: Partial<FloodRisk>): Promise<void> {
  try {
    const claimsUrl = `https://www.fema.gov/api/open/v2/nfipClaims?$filter=reportedZipCode eq '${encodeURIComponent(zip)}'&$select=amountPaidOnBuildingClaim,dateOfLoss&$top=200&$orderby=dateOfLoss%20desc&$format=json`
    const claimsRes = await limitedFetch(claimsUrl, { signal: AbortSignal.timeout(8000) })
    if (claimsRes.ok) {
      const claimsData = (await claimsRes.json()) as { NfipClaims: OpenFemaFloodClaim[] }
      const claims = claimsData.NfipClaims ?? []

      if (claims.length > 0) {
        // Count recent claims (last 10 years)
        const tenYearsAgo = new Date()
        tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10)
        const recentClaims = claims.filter((c) => {
          try { return new Date(c.dateOfLoss) >= tenYearsAgo } catch { return false }
        })

        // More claims = higher flood risk. Weight recent claims more heavily.
        const totalClaimsWeight = claims.length * 0.5 + recentClaims.length * 1.5
        if (totalClaimsWeight > 10) {
          floodZoneData.annualChanceOfFlooding = Math.max(
            floodZoneData.annualChanceOfFlooding ?? 0.2,
            Math.min(totalClaimsWeight / 200, 5.0),
          )
        }

        // Calculate average claim amount for context
        const totalPaid = claims.reduce((sum, c) => sum + (c.amountPaidOnBuildingClaim || 0), 0)
        const avgClaim = totalPaid / claims.length
        // High average payouts indicate severe flooding
        if (avgClaim > 50_000 && claims.length > 5) {
          floodZoneData.annualChanceOfFlooding = Math.max(
            floodZoneData.annualChanceOfFlooding ?? 0.5,
            Math.min(avgClaim / 100_000, 3.0),
          )
        }
      }
    }
  } catch (err) {
    logger.warn('OpenFEMA claims API unavailable', { err })
  }
}

/** NOAA Sea Level Rise viewer ArcGIS service — enhances flood risk for coastal properties */
async function fetchNoaaSeaLevelRise(lat: number, lng: number, floodZoneData: Partial<FloodRisk>): Promise<void> {
  try {
    // NOAA SLR inundation layer: 3-foot scenario (moderate projection by 2100)
    const url = `https://coast.noaa.gov/arcgis/rest/services/dc_slr/slr_3ft/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=OBJECTID&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      if (data.features?.length) {
        // Property is within 3-foot sea level rise inundation zone
        floodZoneData.annualChanceOfFlooding = Math.max(
          floodZoneData.annualChanceOfFlooding ?? 0.5,
          2.0,
        )
      }
    }
  } catch (err) {
    logger.warn('NOAA Sea Level Rise API unavailable', { err })
  }
}

// ─── Fire Risk ────────────────────────────────────────────────────────────────

/** Extended fire risk result with additional data from new sources */
export interface FireRiskExtended extends Partial<FireRisk> {
  wuiClass?: string | null
  recentFireCount?: number
  nearestFireDistanceMiles?: number | null
  esriWildfireHazardPotential?: string | null
  esriWildfireRiskRating?: string | null
  esriBurningProbability?: number | null
  esriFlameLength?: number | null
  esriDroughtLevel?: string | null
  esriDroughtLabel?: string | null
  esriDroughtIntensity?: number
}

export async function fetchFireRisk(lat: number, lng: number, state: string): Promise<FireRiskExtended> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates for fire risk', { lat, lng })
    return {}
  }

  const result: FireRiskExtended = {
    fireHazardSeverityZone: null,
    wildlandUrbanInterface: false,
    wuiClass: null,
    recentFireCount: 0,
    nearestFireStation: null,
    vegetationDensity: null,
    nearestFireDistanceMiles: null,
  }

  // Run all fire data sources in parallel (including Esri enrichments)
  await Promise.all([
    fetchCalFireFHSZ(lat, lng, state, result),
    fetchUsfsWui(lat, lng, result),
    fetchNifcHistoricalFires(lat, lng, result),
    fetchNearestFireStation(lat, lng, result),
    fetchVegetationDensity(lat, lng, result),
    fetchEsriWildfireRiskEnrichment(lat, lng, result),
    fetchEsriDroughtEnrichment(lat, lng, result),
  ])

  return result
}

/** USDA Wildfire Risk to Communities via Esri — enriches fire data with hazard potential.
 *  NOTE: `apps.fs.usda.gov` runs a WAF that returns 403 to requests without a
 *  browser-like `Referer`/`User-Agent` from non-residential egress IPs. We set
 *  both so server-side calls from cloud egress aren't filtered. If the primary
 *  source still fails, Cal Fire FHSZ + USFS WUI + NIFC + LANDFIRE already
 *  provide fire coverage. */
async function fetchEsriWildfireRiskEnrichment(lat: number, lng: number, result: FireRiskExtended): Promise<void> {
  try {
    const url = `https://apps.fs.usda.gov/arcx/rest/services/RDW_Wildfire/RMRS_WRC_WildfireRisk/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=WHPS_CLASS,RISK_RATING,BP,FL&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Referer: 'https://wildfirerisk.org/',
        'User-Agent': 'CoverGuard/1.0 (+https://coverguard.app)',
      },
    })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        const whpsMap: Record<string, string> = { '1': 'Very Low', '2': 'Low', '3': 'Moderate', '4': 'High', '5': 'Very High' }
        const whpsClass = String(attrs.WHPS_CLASS ?? '')
        result.esriWildfireHazardPotential = whpsMap[whpsClass] ?? (attrs.WHPS_CLASS as string) ?? null
        result.esriWildfireRiskRating = (attrs.RISK_RATING as string) ?? null
        result.esriBurningProbability = typeof attrs.BP === 'number' ? attrs.BP : null
        result.esriFlameLength = typeof attrs.FL === 'number' ? attrs.FL : null

        // If Esri wildfire data shows high/very high risk, ensure WUI flag and hazard zone are set
        if (whpsClass === '4' || whpsClass === '5') {
          result.wildlandUrbanInterface = true
          if (!result.fireHazardSeverityZone) {
            result.fireHazardSeverityZone = whpsClass === '5' ? 'VERY HIGH' : 'HIGH'
          }
        }
      }
    }
  } catch (err) {
    logger.warn('USDA Wildfire Risk to Communities (Esri) API unavailable', { err })
  }
}

/** US Drought Monitor via Esri — drought conditions increase fire risk */
async function fetchEsriDroughtEnrichment(lat: number, lng: number, result: FireRiskExtended): Promise<void> {
  try {
    const url = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/US_Drought_Intensity_v1/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=dm,Name&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        const dm = typeof attrs.dm === 'number' ? attrs.dm : null
        const labelMap: Record<number, string> = {
          0: 'Abnormally Dry', 1: 'Moderate Drought', 2: 'Severe Drought',
          3: 'Extreme Drought', 4: 'Exceptional Drought',
        }
        const dmCodeMap: Record<number, string> = { 0: 'D0', 1: 'D1', 2: 'D2', 3: 'D3', 4: 'D4' }
        result.esriDroughtLevel = dm != null ? (dmCodeMap[dm] ?? `D${dm}`) : 'None'
        result.esriDroughtLabel = dm != null ? (labelMap[dm] ?? (attrs.Name as string) ?? null) : 'No drought'
        result.esriDroughtIntensity = dm != null ? dm + 1 : 0
      } else {
        result.esriDroughtLevel = 'None'
        result.esriDroughtLabel = 'No drought conditions'
        result.esriDroughtIntensity = 0
      }
    }
  } catch (err) {
    logger.warn('US Drought Monitor (Esri) API unavailable', { err })
  }
}

/** California: Cal Fire FHSZ */
async function fetchCalFireFHSZ(lat: number, lng: number, state: string, result: FireRiskExtended): Promise<void> {
  if (state !== 'CA') return
  try {
    const url = `https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZ/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=HAZ_CLASS,AGENCY&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const hazClass = data.features?.[0]?.attributes?.HAZ_CLASS as string | undefined
      if (hazClass) {
        result.fireHazardSeverityZone = hazClass
        result.wildlandUrbanInterface = ['HIGH', 'VERY HIGH', 'EXTREME'].includes(hazClass)
      }
    }
  } catch (err) {
    logger.warn('Cal Fire FHSZ API unavailable', { err })
  }
}

/** USFS Wildland-Urban Interface layer (all states) */
async function fetchUsfsWui(lat: number, lng: number, result: FireRiskExtended): Promise<void> {
  try {
    const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_WUI_2020_01/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=WUICLASS10&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const wuiClass = data.features?.[0]?.attributes?.WUICLASS10 as string | undefined
      if (wuiClass) {
        result.wuiClass = wuiClass
        // WUI classes: Intermix (highest risk), Interface, Non-WUI/Uninhabited
        const isWui = wuiClass === 'Intermix' || wuiClass === 'Interface'
        result.wildlandUrbanInterface = result.wildlandUrbanInterface || isWui
      }
    }
  } catch (err) {
    logger.warn('USFS WUI API unavailable', { err })
  }
}

/** NIFC Historical Wildfire Perimeters — checks for recent fires within 5 miles */
async function fetchNifcHistoricalFires(lat: number, lng: number, result: FireRiskExtended): Promise<void> {
  try {
    // Query NIFC InteragencyFirePerimeterHistory for fires within ~5 miles (8 km buffer)
    // Uses a bounding box envelope around the point
    const bufferDeg = 0.075 // ~5 miles at mid-latitudes
    const envelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const url = `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=poly_IncidentName,irwin_FireDiscoveryDateTime,poly_GISAcres&where=poly_GISAcres>100&orderByFields=irwin_FireDiscoveryDateTime DESC&resultRecordCount=20&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const fires = data.features ?? []
      result.recentFireCount = fires.length

      // If fires burned directly through/near property, WUI risk is elevated
      if (fires.length > 0) {
        result.wildlandUrbanInterface = true
        // Check for very large or very recent fires
        const now = Date.now()
        const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000
        const recentLargeFires = fires.filter((f) => {
          const rawTime = f.attributes?.irwin_FireDiscoveryDateTime
          const discoveryTime = typeof rawTime === 'number' ? rawTime
            : typeof rawTime === 'string' ? new Date(rawTime).getTime()
            : null
          const acres = f.attributes?.poly_GISAcres as number | null
          return discoveryTime && !isNaN(discoveryTime) && (now - discoveryTime < fiveYearsMs) && acres && acres > 1000
        })
        if (recentLargeFires.length > 0 && !result.fireHazardSeverityZone) {
          result.fireHazardSeverityZone = 'HIGH'
        }
      }
    }
  } catch (err) {
    logger.warn('NIFC Historical Fires API unavailable', { err })
  }
}

/** HIFLD Fire Station locations — find nearest fire station distance */
async function fetchNearestFireStation(lat: number, lng: number, result: FireRiskExtended): Promise<void> {
  try {
    // HIFLD (Homeland Infrastructure Foundation-Level Data) Fire Stations
    // Query within a ~10 mile radius, get closest
    const bufferDeg = 0.15 // ~10 miles
    const envelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const url = `https://services1.arcgis.com/Hp6G80Pky0om6HgQ/arcgis/rest/services/Fire_Stations/FeatureServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=LATITUDE,LONGITUDE,NAME&resultRecordCount=10&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const stations = data.features ?? []
      if (stations.length > 0) {
        let minDist = Infinity
        for (const station of stations) {
          const sLat = station.attributes?.LATITUDE as number | null
          const sLng = station.attributes?.LONGITUDE as number | null
          if (sLat != null && sLng != null) {
            const dist = haversineDistanceMiles(lat, lng, sLat, sLng)
            if (dist < minDist) minDist = dist
          }
        }
        if (minDist < Infinity) {
          result.nearestFireStation = Math.round(minDist * 10) / 10 // 1 decimal
        }
      }
    }
  } catch (err) {
    logger.warn('HIFLD Fire Stations API unavailable', { err })
  }
}

/** USGS NLCD Land Cover — determines vegetation density as fire fuel proxy */
async function fetchVegetationDensity(lat: number, lng: number, result: FireRiskExtended): Promise<void> {
  try {
    // MRLC (Multi-Resolution Land Characteristics) NLCD 2021 Land Cover
    const url = `https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/ows?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=NLCD_2021_Land_Cover_L48&query_layers=NLCD_2021_Land_Cover_L48&info_format=application/json&x=1&y=1&width=3&height=3&srs=EPSG:4326&bbox=${lng - 0.0005},${lat - 0.0005},${lng + 0.0005},${lat + 0.0005}`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json() as { features?: Array<{ properties?: { GRAY_INDEX?: number } }> }
      const nlcdCode = data.features?.[0]?.properties?.GRAY_INDEX
      if (nlcdCode) {
        // NLCD codes: 41=Deciduous, 42=Evergreen, 43=Mixed Forest, 51=Shrub, 52=Shrub/Scrub, 71=Grassland
        // High fire fuel: Evergreen (42), Shrub/Scrub (52), Mixed Forest (43)
        // Moderate: Deciduous (41), Grassland (71), Shrub (51)
        // Low: Developed (21-24), Water (11), Barren (31), Crops (81-82)
        const highFuel = [42, 43, 52]
        const moderateFuel = [41, 51, 71]
        if (highFuel.includes(nlcdCode)) {
          result.vegetationDensity = 'HIGH'
        } else if (moderateFuel.includes(nlcdCode)) {
          result.vegetationDensity = 'MODERATE'
        } else {
          result.vegetationDensity = 'LOW'
        }
      }
    }
  } catch (err) {
    logger.warn('USGS NLCD Land Cover API unavailable', { err })
  }
}

// ─── Earthquake Risk (USGS) ───────────────────────────────────────────────────

interface UsgsDesignMapResponse {
  response: { data: { ss: number; s1: number; pga: number; sds: number; sd1: number } }
}

/** Extended earthquake result with spectral values for scoring */
export interface EarthquakeRiskExtended extends Partial<EarthquakeRisk> {
  ss?: number | null
  pga?: number | null
  s1?: number | null
}

export async function fetchEarthquakeRisk(lat: number, lng: number): Promise<EarthquakeRiskExtended> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates for earthquake risk', { lat, lng })
    return {}
  }

  const result: EarthquakeRiskExtended = {}

  // Run design maps and fault queries in parallel
  await Promise.all([
    fetchUsgsDesignMaps(lat, lng, result),
    fetchNearestQuaternaryFault(lat, lng, result),
  ])

  return result
}

/** USGS Design Maps (ASCE 7-22) — spectral acceleration values */
async function fetchUsgsDesignMaps(lat: number, lng: number, result: EarthquakeRiskExtended): Promise<void> {
  // 1. Primary: USGS Design Maps
  try {
    const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=${lat}&longitude=${lng}&riskCategory=II&siteClass=C&title=CoverGuard`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const data = (await res.json()) as UsgsDesignMapResponse
      const ss = data?.response?.data?.ss
      const pga = data?.response?.data?.pga
      const s1 = data?.response?.data?.s1

      if (ss != null) {
        result.seismicZone = ss > 1.5 ? 'D' : ss > 0.75 ? 'C' : ss > 0.25 ? 'B' : 'A'
        result.ss = ss
        result.pga = pga ?? null
        result.s1 = s1 ?? null

        // Determine soil liquefaction potential from PGA + seismic zone
        if (pga != null && pga > 0.3) {
          result.liquefactionPotential = 'HIGH'
          result.soilType = 'Soft soil (Site Class D-E assumed)'
        } else if (pga != null && pga > 0.15) {
          result.liquefactionPotential = 'MODERATE'
          result.soilType = 'Stiff soil (Site Class C)'
        } else if (pga != null) {
          result.liquefactionPotential = 'LOW'
          result.soilType = 'Rock/stiff soil (Site Class B-C)'
        }
        return
      }
    }
  } catch (err) {
    logger.warn('USGS Design Maps API unavailable', { err })
  }

  // 2. Fallback: USGS Hazard Curves API — try WUS (Western US) first, then EUS (Eastern US)
  const regions = lng < -100 ? ['WUS', 'EUS'] : ['EUS', 'WUS']
  for (const region of regions) {
    try {
      const url = `https://earthquake.usgs.gov/hazws/staticcurve/1/E2003/${region}/760/${lat}/${lng}/PGA/2P50`
      const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = await res.json() as { hazardCurves?: unknown[] }
        if (data.hazardCurves?.length) {
          result.seismicZone = result.seismicZone ?? 'C'
          break
        }
      }
    } catch (err) {
      logger.warn(`USGS Hazard Curves (${region}) API unavailable`, { err })
    }
  }
}

/** USGS Quaternary Fault & Fold Database — finds nearest known fault */
async function fetchNearestQuaternaryFault(lat: number, lng: number, result: EarthquakeRiskExtended): Promise<void> {
  try {
    // Query USGS QFaults ArcGIS MapServer — search within ~30 mile radius
    const bufferDeg = 0.45 // ~30 miles
    const envelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const url = `https://earthquake.usgs.gov/arcgis/rest/services/eq/QFaults/MapServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=fault_name,slip_rate,age&returnGeometry=true&resultRecordCount=5&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json() as {
        features?: Array<{
          attributes?: { fault_name?: string; slip_rate?: string; age?: string }
          geometry?: { paths?: number[][][] }
        }>
      }
      const faults = data.features ?? []
      if (faults.length > 0) {
        // Find minimum distance to any fault segment
        let minDist = Infinity
        for (const fault of faults) {
          const paths = fault.geometry?.paths ?? []
          for (const path of paths) {
            for (const point of path) {
              if (point.length >= 2) {
                const dist = haversineDistanceMiles(lat, lng, point[1], point[0])
                if (dist < minDist) minDist = dist
              }
            }
          }
        }
        if (minDist < Infinity) {
          result.nearestFaultLine = Math.round(minDist * 10) / 10
        }
      } else {
        // No faults found within 30-mile query range
        result.nearestFaultLine = null
      }
    }
  } catch (err) {
    logger.warn('USGS QFaults API unavailable', { err })
  }
}

// ─── Wind Risk ────────────────────────────────────────────────────────────────

/** Extended wind result with SLOSH category and SPC event data */
export interface WindRiskExtended extends Partial<WindRisk> {
  /** @deprecated NOAA retired per-category SLOSH MapServer services. Kept for
   *  backward compatibility; always `null` now. Use `inCoastalFloodHazardZone`
   *  + `esriHurricaneMaxCategory` instead. */
  sloshCategory?: number | null
  /** True when the property sits inside NOAA's Coastal Flood Hazard Composite
   *  (SLOSH surge + FEMA flood + SLR merged). Proxy for surge exposure now
   *  that the per-category SLOSH query services are gone. */
  inCoastalFloodHazardZone?: boolean
  historicalTornadoCount?: number
  historicalHailCount?: number
  historicalHurricaneCount?: number
  esriHurricaneMaxCategory?: number | null
  esriHurricaneMaxWind?: number | null
  esriHurricaneMostRecentYear?: number | null
  esriHurricaneStormNames?: string[]
}

export async function fetchWindRisk(lat: number, lng: number, state: string): Promise<WindRiskExtended> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates for wind risk', { lat, lng })
    return {}
  }

  const hurricaneStates = ['FL', 'TX', 'LA', 'MS', 'AL', 'GA', 'SC', 'NC', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'ME', 'NH']
  const tornadoStates   = ['TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'MO', 'IA', 'IL', 'IN', 'OH', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY', 'GA', 'FL', 'SC', 'NC']
  const hailStates      = ['TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'CO', 'WY', 'MT', 'MN', 'IA', 'MO', 'IL', 'AR']

  const result: WindRiskExtended = {
    hurricaneRisk: hurricaneStates.includes(state),
    tornadoRisk: tornadoStates.includes(state),
    hailRisk: hailStates.includes(state),
    designWindSpeed: computeDesignWindSpeed(lat, state),
    sloshCategory: null,
    inCoastalFloodHazardZone: false,
    historicalTornadoCount: 0,
    historicalHailCount: 0,
    historicalHurricaneCount: 0,
  }

  // Run wind data sources in parallel. `fetchHistoricalHurricaneTracks`
  // (NOAA NGDC Gulf Data Atlas) was removed — that service now returns
  // "Service not started" (HTTP 500 in the JSON body). The Esri Living Atlas
  // IBTrACS service covers the same data and is still live.
  await Promise.all([
    fetchCoastalFloodHazardZone(lat, lng, result),
    fetchSpcStormEvents(lat, lng, result),
    fetchEsriHurricaneTracksEnrichment(lat, lng, result),
  ])

  return result
}

/** Esri Living Atlas Historical Hurricane Tracks — richer IBTrACS data with storm categories */
async function fetchEsriHurricaneTracksEnrichment(lat: number, lng: number, result: WindRiskExtended): Promise<void> {
  if (!result.hurricaneRisk) return
  try {
    const bufferDeg = 1.1 // ~75 miles
    const envelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const url = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Hurricanes_v1/FeatureServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Name,Year_,MAX_WIND,MAX_CAT&where=MAX_WIND>=64&resultRecordCount=200&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const tracks = data.features ?? []
      if (tracks.length > 0) {
        let maxWind: number | null = null
        let maxCat: number | null = null
        let mostRecentYear: number | null = null
        const names: string[] = []

        for (const t of tracks) {
          const wind = t.attributes?.MAX_WIND as number | null
          const cat = t.attributes?.MAX_CAT as number | null
          const year = t.attributes?.Year_ as number | null
          const name = t.attributes?.Name as string | null

          if (wind != null && (maxWind == null || wind > maxWind)) maxWind = wind
          if (cat != null && (maxCat == null || cat > maxCat)) maxCat = cat
          if (year != null && (mostRecentYear == null || year > mostRecentYear)) mostRecentYear = year
          if (name && !names.includes(name)) names.push(name)
        }

        // Update main counts if Esri has more data than NOAA Gulf Atlas
        result.historicalHurricaneCount = Math.max(result.historicalHurricaneCount ?? 0, tracks.length)
        result.esriHurricaneMaxCategory = maxCat
        result.esriHurricaneMaxWind = maxWind
        result.esriHurricaneMostRecentYear = mostRecentYear
        result.esriHurricaneStormNames = names.slice(0, 10)

        // Boost design wind speed for areas with major hurricane history
        if (maxCat != null && maxCat >= 3) {
          result.designWindSpeed = Math.max(result.designWindSpeed ?? 115, 170)
        }
      }
    }
  } catch (err) {
    logger.warn('Esri Hurricane Tracks API unavailable', { err })
  }
}

/** Compute ASCE 7 design wind speed with more granularity */
function computeDesignWindSpeed(lat: number, state: string): number {
  // Coastal Gulf/Atlantic states get higher base speeds
  const coastalHighWind = ['FL', 'LA', 'TX', 'MS', 'AL']
  const coastalModWind = ['SC', 'NC', 'GA', 'VA']

  if (coastalHighWind.includes(state)) {
    if (lat < 26) return 185 // South FL, extreme Gulf
    if (lat < 28) return 170
    if (lat < 30) return 160
    return 150
  }
  if (coastalModWind.includes(state)) {
    if (lat < 33) return 140
    return 130
  }
  // Interior states
  if (lat < 25) return 180
  if (lat < 30) return 150
  if (lat < 35) return 130
  if (lat < 40) return 120
  return 115
}

/** NOAA Coastal Flood Hazard — "is this point in the coastal flood hazard composite?"
 *
 *  NOTE: NOAA retired the per-category SLOSH services (`CFEM_NHC_Surge_Cat{1,3,5}/
 *  MapServer`) — each now returns an ArcGIS 404 JSON body (wrapped in HTTP 200,
 *  which is why the previous try/catch swallowed it silently and `sloshCategory`
 *  was `null` for every property). We replace the old per-category probe with
 *  an `identify` against the current `CFEM_CoastalFloodHazardComposite` service
 *  (same source the tile overlay uses). The composite merges SLOSH surge +
 *  FEMA flood zones + SLR, so we can no longer pin a specific Saffir-Simpson
 *  category — instead we surface a boolean `inCoastalFloodHazardZone` and let
 *  `computeWindScore` treat it as a risk boost. Category differentiation now
 *  comes exclusively from `fetchEsriHurricaneTracksEnrichment` (historical
 *  track Saffir-Simpson MAX_CAT). */
async function fetchCoastalFloodHazardZone(lat: number, lng: number, result: WindRiskExtended): Promise<void> {
  if (!result.hurricaneRisk) return
  try {
    // The composite service has 35 per-state layers (0–34). `identify` with
    // `layers=visible` is the supported way to ask "what layer(s) cover this
    // point?" without knowing which state layer applies.
    const extent = `${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`
    const url =
      `https://coast.noaa.gov/arcgis/rest/services/FloodExposureMapper/CFEM_CoastalFloodHazardComposite/MapServer/identify` +
      `?geometry=${encodeURIComponent(JSON.stringify({ x: lng, y: lat }))}` +
      `&geometryType=esriGeometryPoint&sr=4326&layers=visible&tolerance=2` +
      `&mapExtent=${extent}&imageDisplay=256,256,96&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return
    const data = (await res.json()) as { results?: Array<{ attributes?: Record<string, unknown> }> }
    const hits = data.results ?? []
    if (hits.length > 0) {
      result.inCoastalFloodHazardZone = true
    }
  } catch (err) {
    logger.warn('NOAA Coastal Flood Hazard Composite API unavailable', { err })
  }
}

/** NOAA Storm Events Database (via Iowa Environmental Mesonet) — historical tornado and hail events */
async function fetchSpcStormEvents(lat: number, lng: number, result: WindRiskExtended): Promise<void> {
  // Query NOAA/SPC storm events via IEM's GeoJSON endpoints
  // Tornado reports within ~25 miles over last 20 years
  const bufferDeg = 0.35 // ~25 miles

  // Tornado events — SPC SVRGIS (Severe Weather GIS) tornado tracks
  try {
    const tornadoEnvelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const spcUrl = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Tornado_Tracks/FeatureServer/0/query?geometry=${encodeURIComponent(tornadoEnvelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=yr,mag&where=yr>=2004&resultRecordCount=50&returnGeometry=false&f=json`
    const res = await limitedFetch(spcUrl, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const tornadoes = data.features ?? []
      result.historicalTornadoCount = tornadoes.length

      // If there are actual historical tornado tracks near the property, confirm risk
      if (tornadoes.length > 0) {
        result.tornadoRisk = true
        // Check for significant tornadoes (EF2+)
        const significantTornadoes = tornadoes.filter((t) => {
          const mag = t.attributes?.mag as number | null
          return mag != null && mag >= 2
        })
        if (significantTornadoes.length > 0) {
          // Boost design wind speed for areas with EF2+ tornado history
          result.designWindSpeed = Math.max(result.designWindSpeed ?? 115, 150)
        }
      }
    }
  } catch (err) {
    logger.warn('SPC Tornado Tracks API unavailable', { err })
  }

  // Hail events — SPC SVRGIS Hail reports
  try {
    const hailEnvelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const hailUrl = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Hail_Reports/FeatureServer/0/query?geometry=${encodeURIComponent(hailEnvelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=yr,size&where=yr>=2004&resultRecordCount=50&returnGeometry=false&f=json`
    const res = await limitedFetch(hailUrl, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const hailEvents = data.features ?? []
      result.historicalHailCount = hailEvents.length

      if (hailEvents.length > 0) {
        result.hailRisk = true
        // Check for large hail (>= 2 inches)
        const largeHail = hailEvents.filter((h) => {
          const size = h.attributes?.size as number | null
          return size != null && size >= 200 // size in hundredths of inches
        })
        if (largeHail.length > 3) {
          result.designWindSpeed = Math.max(result.designWindSpeed ?? 115, 130)
        }
      }
    }
  } catch (err) {
    logger.warn('SPC Hail Reports API unavailable', { err })
  }
}

// NOTE: The legacy `fetchHistoricalHurricaneTracks` helper (NOAA NGDC Gulf Data
// Atlas — `TropicalStorms_Hurricanes/MapServer`) was deleted. That service
// now returns an ArcGIS 500 JSON body ("Service not started"); the Esri Living
// Atlas `Hurricanes_v1` FeatureServer covers the same IBTrACS data and is still
// live. Track counts and design-wind boosting now come exclusively from
// `fetchEsriHurricaneTracksEnrichment`.

// ─── Crime Risk (FBI Crime Data Explorer + Census ACS fallback) ──────────────

interface FbiAgencyData {
  data: Array<{
    summary: Array<{
      year: number
      violent_crime: number
      property_crime: number
      population: number
    }>
  }>
}

/** Extended crime result that signals data source used */
export interface CrimeRiskExtended extends Partial<CrimeRisk> {
  dataSourceUsed?: 'FBI_CDE' | 'CENSUS_ACS' | 'NONE'
  esriSviOverall?: number | null
  esriSviRating?: string | null
  esriSviSocioeconomic?: number | null
}

export async function fetchCrimeRisk(lat: number, lng: number, zip: string): Promise<CrimeRiskExtended> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates for crime risk', { lat, lng })
    return { dataSourceUsed: 'NONE' }
  }

  // Try FBI CDE first (most accurate)
  const fbiResult = await fetchFbiCrimeData(zip)

  // Enrich with CDC Social Vulnerability Index via Esri (runs in parallel with primary source)
  const sviData = await fetchEsriSviEnrichment(lat, lng)

  if (fbiResult) return { ...fbiResult, ...sviData, dataSourceUsed: 'FBI_CDE' }

  // Fallback: Census Bureau ACS poverty/income data as crime proxy
  const censusResult = await fetchCensusAcsCrimeProxy(zip)
  if (censusResult) return { ...censusResult, ...sviData, dataSourceUsed: 'CENSUS_ACS' }

  return { ...sviData, dataSourceUsed: 'NONE' }
}

/** CDC Social Vulnerability Index via Esri — enriches crime context with community vulnerability */
async function fetchEsriSviEnrichment(lat: number, lng: number): Promise<Partial<CrimeRiskExtended>> {
  try {
    const url = `https://services3.arcgis.com/ZvidGQkLaDJxRSJ2/arcgis/rest/services/CDC_SVI_2020/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=RPL_THEMES,RPL_THEME1&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        const overall = typeof attrs.RPL_THEMES === 'number' ? Math.round(attrs.RPL_THEMES * 1000) / 1000 : null
        let rating: string | null = null
        if (overall != null) {
          if (overall >= 0.75) rating = 'Very High'
          else if (overall >= 0.50) rating = 'High'
          else if (overall >= 0.25) rating = 'Moderate'
          else rating = 'Low'
        }
        return {
          esriSviOverall: overall,
          esriSviRating: rating,
          esriSviSocioeconomic: typeof attrs.RPL_THEME1 === 'number' ? Math.round(attrs.RPL_THEME1 * 1000) / 1000 : null,
        }
      }
    }
  } catch (err) {
    logger.warn('CDC SVI (Esri) enrichment unavailable', { err })
  }
  return {}
}

async function fetchFbiCrimeData(zip: string): Promise<Partial<CrimeRisk> | null> {
  const fbiKey = process.env.FBI_CDE_KEY
  if (!fbiKey) return null

  const fbiHeaders = { 'x-api-key': fbiKey }

  try {
    // FBI CDE: get agencies near this ZIP code
    const agenciesUrl = `https://api.usa.gov/crime/fbi/cde/agencies/byZip/${encodeURIComponent(zip)}`
    const agenciesRes = await limitedFetch(agenciesUrl, { signal: AbortSignal.timeout(10000), headers: fbiHeaders })
    if (!agenciesRes.ok) return null

    const agencies = (await agenciesRes.json()) as { results?: Array<{ ori: string }> }
    const ori = agencies.results?.[0]?.ori
    if (!ori) return null

    // Get summary stats for this agency
    const summaryUrl = `https://api.usa.gov/crime/fbi/cde/summarized/agency/${encodeURIComponent(ori)}/offenses?from=2020&to=2023`
    const summaryRes = await limitedFetch(summaryUrl, { signal: AbortSignal.timeout(10000), headers: fbiHeaders })
    if (!summaryRes.ok) return null

    const summaryData = (await summaryRes.json()) as FbiAgencyData
    const latest = summaryData.data?.[0]?.summary?.sort((a, b) => b.year - a.year)[0]
    if (!latest || !latest.population) return null

    const violentRate = (latest.violent_crime / latest.population) * 100000
    const propertyRate = (latest.property_crime / latest.population) * 100000

    // National averages (FBI 2022): violent ~380, property ~1,954 per 100k
    const nationalViolentAvg = 380
    const nationalAvgDiff = ((violentRate - nationalViolentAvg) / nationalViolentAvg) * 100

    return {
      violentCrimeIndex: Math.round(violentRate),
      propertyCrimeIndex: Math.round(propertyRate),
      nationalAverageDiff: Math.round(nationalAvgDiff),
    }
  } catch (err) {
    logger.warn('FBI CDE API error', { err })
    return null
  }
}

/**
 * Census Bureau ACS 5-year estimates as crime proxy when FBI data unavailable.
 * Uses poverty rate, median household income, and unemployment as correlates.
 *
 * Research shows strong correlation between poverty rate and crime:
 * - Poverty rate >20% → violent crime ~2x national avg
 * - Median income <$35k → property crime ~1.5x national avg
 */
async function fetchCensusAcsCrimeProxy(zip: string): Promise<Partial<CrimeRisk> | null> {
  try {
    // Census ACS 5-year ZIP Code Tabulation Area (ZCTA) data
    // B17001_002E = below poverty level, B17001_001E = total population for poverty
    // B19013_001E = median household income
    // B23025_005E = unemployed, B23025_002E = in labor force
    const censusKey = process.env.CENSUS_API_KEY ? `&key=${process.env.CENSUS_API_KEY}` : ''
    const url = `https://api.census.gov/data/2022/acs/acs5?get=B17001_002E,B17001_001E,B19013_001E,B23025_005E,B23025_002E&for=zip%20code%20tabulation%20area:${encodeURIComponent(zip)}${censusKey}`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = (await res.json()) as string[][]
    // First row is headers, second row is values
    if (!data || data.length < 2) return null

    const values = data[1]
    if (!values || values.length < 5) return null

    const belowPoverty = parseInt(values[0], 10)
    const totalPovPop = parseInt(values[1], 10)
    const medianIncome = parseInt(values[2], 10)
    const unemployed = parseInt(values[3], 10)
    const laborForce = parseInt(values[4], 10)

    if (isNaN(belowPoverty) || isNaN(totalPovPop) || isNaN(medianIncome) || isNaN(unemployed) || isNaN(laborForce)) return null
    if (totalPovPop === 0) return null

    const povertyRate = (belowPoverty / totalPovPop) * 100
    const unemploymentRate = laborForce > 0 ? (unemployed / laborForce) * 100 : 0

    // Estimate crime indices from socioeconomic indicators
    // National avg poverty rate ~12.4%, median income ~$74,580, unemployment ~3.6%

    // Violent crime proxy: weighted formula based on research correlations
    // Higher poverty → higher violent crime; lower income → higher violent crime
    const povertyFactor = povertyRate / 12.4 // normalized to national avg
    const incomeFactor = medianIncome > 0 ? 74_580 / medianIncome : 1.5
    const unemploymentFactor = unemploymentRate / 3.6

    // Estimated violent crime rate per 100k (national avg ~380)
    const estViolentRate = Math.round(
      380 * (povertyFactor * 0.45 + incomeFactor * 0.35 + unemploymentFactor * 0.20)
    )

    // Estimated property crime rate per 100k (national avg ~1,954)
    const estPropertyRate = Math.round(
      1954 * (povertyFactor * 0.35 + incomeFactor * 0.40 + unemploymentFactor * 0.25)
    )

    const nationalViolentAvg = 380
    const nationalAvgDiff = ((estViolentRate - nationalViolentAvg) / nationalViolentAvg) * 100

    return {
      violentCrimeIndex: estViolentRate,
      propertyCrimeIndex: estPropertyRate,
      nationalAverageDiff: Math.round(nationalAvgDiff),
    }
  } catch (err) {
    logger.warn('Census ACS API unavailable', { err })
    return null
  }
}

// ─── Supplemental Data Sources ───────────────────────────────────────────────

/** USGS 3DEP Elevation Point Query — returns elevation in feet for any US lat/lng */
export async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `https://epqs.nationalmap.gov/v1/json?x=${lng}&y=${lat}&wkid=4326&units=Feet&includeDate=false`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json() as { value?: number }
      if (data.value != null && data.value > -1000) {
        return Math.round(data.value * 10) / 10
      }
    }
  } catch (err) {
    logger.warn('USGS 3DEP Elevation API unavailable', { err })
  }
  return null
}

/**
 * USGS Earthquake Catalog — historical seismic events near property.
 * Returns count and max magnitude of earthquakes within 50km over last 20 years.
 */
export async function fetchHistoricalEarthquakes(lat: number, lng: number): Promise<{
  count: number
  maxMagnitude: number | null
  significantCount: number // magnitude >= 4.0
} | null> {
  try {
    const startDate = new Date()
    startDate.setFullYear(startDate.getFullYear() - 20)
    const startStr = startDate.toISOString().split('T')[0]
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lng}&maxradiuskm=50&minmagnitude=2.5&starttime=${startStr}&limit=500`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json() as {
        metadata?: { count?: number }
        features?: Array<{ properties?: { mag?: number } }>
      }
      const features = data.features ?? []
      const count = features.length
      let maxMag: number | null = null
      let significantCount = 0
      for (const f of features) {
        const mag = f.properties?.mag
        if (mag != null) {
          if (maxMag == null || mag > maxMag) maxMag = mag
          if (mag >= 4.0) significantCount++
        }
      }
      return { count, maxMagnitude: maxMag, significantCount }
    }
  } catch (err) {
    logger.warn('USGS Earthquake Catalog API unavailable', { err })
  }
  return null
}

/**
 * LANDFIRE Fuel Model — returns the Scott & Burgan 40 fuel model for fire behavior.
 * Higher fuel loads = more intense fire behavior around property.
 */
export async function fetchLandfireFuelModel(lat: number, lng: number): Promise<{
  fuelModel: string | null
  fuelDescription: string | null
} | null> {
  try {
    // LANDFIRE FBFM40 (Scott & Burgan 40 fuel models)
    const url = `https://lfps.usgs.gov/arcgis/rest/services/Landfire/US_200/MapServer/identify?geometry=${lng},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all:10&tolerance=1&mapExtent=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&imageDisplay=100,100,96&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json() as {
        results?: Array<{
          attributes?: { 'Pixel Value'?: string; 'FBFM40'?: string; 'CLASSNAME'?: string }
        }>
      }
      const result = data.results?.[0]?.attributes
      if (result) {
        const fuelModel = result['FBFM40'] ?? result['Pixel Value'] ?? null
        const fuelDescription = result['CLASSNAME'] ?? null
        return { fuelModel, fuelDescription }
      }
    }
  } catch (err) {
    logger.warn('LANDFIRE Fuel Model API unavailable', { err })
  }
  return null
}

/**
 * FEMA National Risk Index (NRI) — composite risk by census tract.
 * Returns Expected Annual Loss and risk ratings for 18 natural hazards.
 */
export interface NriResult {
  riskRating: string | null // 'Very High', 'Relatively High', 'Relatively Moderate', etc.
  expectedAnnualLoss: number | null
  socialVulnerability: string | null
  communityResilience: string | null
  earthquakeRisk: string | null
  floodRisk: string | null
  hurricaneRisk: string | null
  tornadoRisk: string | null
  wildfireRisk: string | null
  /** Heat Wave risk rating (HWAV_RISKR): 'Very High', 'Relatively High', … */
  heatWaveRisk: string | null
  /** Heat Wave expected annual loss (total) — useful for triage copy */
  heatWaveExpectedAnnualLoss: number | null
  /** Strong Wind risk rating — supplements hurricane/tornado for inland wind */
  strongWindRisk: string | null
  /** Drought risk rating — supplemental signal for the drought layer */
  droughtRisk: string | null
}

export async function fetchFemaNri(lat: number, lng: number): Promise<NriResult | null> {
  try {
    // Use outFields=* because NRI field names vary between service versions
    const url = `https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/NRI_Census_Tracts/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        // Helper to find field by possible name variants
        const field = (...names: string[]): string | number | null => {
          for (const n of names) {
            if (attrs[n] != null) return attrs[n] as string | number
          }
          return null
        }
        const ealRaw = field('EAL_VALT', 'EAL_VALUE', 'EAL_VALB')
        const hwavEalRaw = field('HWAV_EALT', 'HWAV_EAL_VALUE', 'HWAV_EAL')
        return {
          riskRating: (field('RISK_RATNG', 'RISK_RATING') as string | null),
          expectedAnnualLoss: typeof ealRaw === 'number' ? ealRaw : typeof ealRaw === 'string' ? parseFloat(ealRaw) || null : null,
          socialVulnerability: (field('SOVI_RATNG', 'SOVI_RATING', 'SOVI_SCORE') as string | null),
          communityResilience: (field('RESL_RATNG', 'RESL_RATING', 'RESL_SCORE') as string | null),
          earthquakeRisk: (field('ERQK_RISKR', 'ERQK_RISKS', 'ERQK_SCORE') as string | null),
          floodRisk: (field('RFLD_RISKR', 'RFLD_RISKS', 'RFLD_SCORE') as string | null),
          hurricaneRisk: (field('HRCN_RISKR', 'HRCN_RISKS', 'HRCN_SCORE') as string | null),
          tornadoRisk: (field('TRND_RISKR', 'TRND_RISKS', 'TRND_SCORE') as string | null),
          wildfireRisk: (field('WFIR_RISKR', 'WFIR_RISKS', 'WFIR_SCORE') as string | null),
          heatWaveRisk: (field('HWAV_RISKR', 'HWAV_RISKS', 'HWAV_SCORE') as string | null),
          heatWaveExpectedAnnualLoss: typeof hwavEalRaw === 'number' ? hwavEalRaw : typeof hwavEalRaw === 'string' ? parseFloat(hwavEalRaw) || null : null,
          strongWindRisk: (field('SWND_RISKR', 'SWND_RISKS', 'SWND_SCORE') as string | null),
          droughtRisk: (field('DRGT_RISKR', 'DRGT_RISKS', 'DRGT_SCORE') as string | null),
        }
      }
    }
  } catch (err) {
    logger.warn('FEMA NRI API unavailable', { err })
  }
  return null
}

/**
 * USGS Karst Map — sinkhole susceptibility based on karst geology.
 * Returns whether property is in a karst area (dissolution-prone limestone/dolostone).
 */
export async function fetchSinkholeRisk(lat: number, lng: number): Promise<{
  inKarstArea: boolean
  karstType: string | null
} | null> {
  try {
    const url = `https://mrdata.usgs.gov/services/karst?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=karst&query_layers=karst&info_format=application/json&x=1&y=1&width=3&height=3&srs=EPSG:4326&bbox=${lng - 0.001},${lat - 0.001},${lng + 0.001},${lat + 0.001}`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json() as { features?: Array<{ properties?: { ROCKTYPE1?: string } }> }
      const feature = data.features?.[0]
      if (feature) {
        return {
          inKarstArea: true,
          karstType: feature.properties?.ROCKTYPE1 ?? 'Karst terrain',
        }
      }
    }
    return { inKarstArea: false, karstType: null }
  } catch (err) {
    logger.warn('USGS Karst Map API unavailable', { err })
    return null
  }
}

/**
 * National Inventory of Dams (NID) — finds high-hazard dams near property.
 * Downstream dam failure can cause catastrophic flooding.
 */
export async function fetchDamHazard(lat: number, lng: number): Promise<{
  nearbyHighHazardDams: number
  nearestDamName: string | null
  nearestDamCondition: string | null
  nearestDamDistance: number | null // miles
} | null> {
  try {
    const url = `https://nid.sec.usace.army.mil/api/nation/dams?latitude=${lat}&longitude=${lng}&radius=25&hazard=H&limit=10`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const dams = await res.json() as Array<{
        name?: string
        conditionAssessment?: string
        latitude?: number
        longitude?: number
        hazard?: string
      }>
      if (Array.isArray(dams) && dams.length > 0) {
        let nearest: typeof dams[0] | null = null
        let minDist = Infinity
        for (const dam of dams) {
          if (dam.latitude != null && dam.longitude != null) {
            const dist = haversineDistanceMiles(lat, lng, dam.latitude, dam.longitude)
            if (dist < minDist) {
              minDist = dist
              nearest = dam
            }
          }
        }
        return {
          nearbyHighHazardDams: dams.length,
          nearestDamName: nearest?.name ?? null,
          nearestDamCondition: nearest?.conditionAssessment ?? null,
          nearestDamDistance: minDist < Infinity ? Math.round(minDist * 10) / 10 : null,
        }
      }
      return { nearbyHighHazardDams: 0, nearestDamName: null, nearestDamCondition: null, nearestDamDistance: null }
    }
  } catch (err) {
    logger.warn('NID Dam Hazard API unavailable', { err })
  }
  return null
}

// ─── Esri Living Atlas Data Sources ──────────────────────────────────────────

/**
 * Esri USA Flood Hazard Areas (Living Atlas) — cross-validates FEMA flood zones.
 * Uses Esri's curated USA Flood Hazard Reduced Set for supplemental zone data.
 */
export interface EsriFloodHazardResult {
  esriFloodZone: string | null
  esriZoneSubtype: string | null
  esriFloodSource: string | null
}

export async function fetchEsriFloodHazard(lat: number, lng: number): Promise<EsriFloodHazardResult | null> {
  try {
    const url = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Flood_Hazard_Reduced_Set/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SOURCE_CIT&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        return {
          esriFloodZone: (attrs.FLD_ZONE as string) ?? null,
          esriZoneSubtype: (attrs.ZONE_SUBTY as string) ?? null,
          esriFloodSource: (attrs.SOURCE_CIT as string) ?? null,
        }
      }
    }
  } catch (err) {
    logger.warn('Esri USA Flood Hazard API unavailable', { err })
  }
  return null
}

/**
 * USDA Wildfire Risk to Communities (Esri-hosted) — provides wildfire hazard potential,
 * risk rating, and exposure data from USDA Forest Service RMRS.
 */
export interface EsriWildfireRiskResult {
  wildfireHazardPotential: string | null  // 'Very High', 'High', 'Moderate', 'Low', 'Very Low'
  wildfireRiskRating: string | null
  burningProbability: number | null       // Annual burn probability
  flameLength: number | null              // Expected flame length (feet)
}

export async function fetchEsriWildfireRisk(lat: number, lng: number): Promise<EsriWildfireRiskResult | null> {
  try {
    // USDA Forest Service Wildfire Risk to Communities — hosted on Esri ArcGIS.
    // See `fetchEsriWildfireRiskEnrichment` for the WAF/Referer rationale.
    const url = `https://apps.fs.usda.gov/arcx/rest/services/RDW_Wildfire/RMRS_WRC_WildfireRisk/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=WHPS_CLASS,RISK_RATING,BP,FL&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        Referer: 'https://wildfirerisk.org/',
        'User-Agent': 'CoverGuard/1.0 (+https://coverguard.app)',
      },
    })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        // Map WHPS class to readable label
        const whpsMap: Record<string, string> = { '1': 'Very Low', '2': 'Low', '3': 'Moderate', '4': 'High', '5': 'Very High' }
        const whpsClass = String(attrs.WHPS_CLASS ?? '')
        return {
          wildfireHazardPotential: whpsMap[whpsClass] ?? (attrs.WHPS_CLASS as string) ?? null,
          wildfireRiskRating: (attrs.RISK_RATING as string) ?? null,
          burningProbability: typeof attrs.BP === 'number' ? attrs.BP : null,
          flameLength: typeof attrs.FL === 'number' ? attrs.FL : null,
        }
      }
    }
  } catch (err) {
    logger.warn('USDA Wildfire Risk to Communities API unavailable', { err })
  }
  return null
}

/**
 * Esri Historical Hurricane Tracks (Living Atlas) — IBTrACS data with better
 * coverage and richer attributes than the Gulf Data Atlas service.
 */
export interface EsriHurricaneTrackResult {
  tracksWithin75Miles: number
  maxWindSpeed: number | null       // knots
  maxCategory: number | null        // Saffir-Simpson 1-5
  mostRecentYear: number | null
  stormNames: string[]
}

export async function fetchEsriHurricaneTracks(lat: number, lng: number): Promise<EsriHurricaneTrackResult | null> {
  try {
    const bufferDeg = 1.1 // ~75 miles
    const envelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const url = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Hurricanes_v1/FeatureServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=Name,Year_,MAX_WIND,MAX_CAT&where=MAX_WIND>=64&resultRecordCount=200&returnGeometry=false&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const tracks = data.features ?? []
      if (tracks.length > 0) {
        let maxWind: number | null = null
        let maxCat: number | null = null
        let mostRecentYear: number | null = null
        const names: string[] = []

        for (const t of tracks) {
          const wind = t.attributes?.MAX_WIND as number | null
          const cat = t.attributes?.MAX_CAT as number | null
          const year = t.attributes?.Year_ as number | null
          const name = t.attributes?.Name as string | null

          if (wind != null && (maxWind == null || wind > maxWind)) maxWind = wind
          if (cat != null && (maxCat == null || cat > maxCat)) maxCat = cat
          if (year != null && (mostRecentYear == null || year > mostRecentYear)) mostRecentYear = year
          if (name && !names.includes(name)) names.push(name)
        }

        return {
          tracksWithin75Miles: tracks.length,
          maxWindSpeed: maxWind,
          maxCategory: maxCat,
          mostRecentYear,
          stormNames: names.slice(0, 10), // limit to 10 most notable
        }
      }
    }
  } catch (err) {
    logger.warn('Esri Historical Hurricane Tracks API unavailable', { err })
  }
  return null
}

/**
 * CDC Social Vulnerability Index (Esri-hosted) — community vulnerability context.
 * Higher SVI indicates populations more vulnerable to hazard impacts.
 */
export interface EsriSviResult {
  overallSvi: number | null           // 0-1, higher = more vulnerable
  socioeconomicSvi: number | null     // Theme 1: socioeconomic status
  householdSvi: number | null         // Theme 2: household characteristics
  minoritySvi: number | null          // Theme 3: racial/ethnic minority status
  housingTypeSvi: number | null       // Theme 4: housing type & transportation
  sviRating: string | null            // 'Very High', 'High', 'Moderate', 'Low'
}

export async function fetchEsriSocialVulnerability(lat: number, lng: number): Promise<EsriSviResult | null> {
  try {
    const url = `https://services3.arcgis.com/ZvidGQkLaDJxRSJ2/arcgis/rest/services/CDC_SVI_2020/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=RPL_THEMES,RPL_THEME1,RPL_THEME2,RPL_THEME3,RPL_THEME4&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        const overall = typeof attrs.RPL_THEMES === 'number' ? attrs.RPL_THEMES : null
        let rating: string | null = null
        if (overall != null) {
          if (overall >= 0.75) rating = 'Very High'
          else if (overall >= 0.50) rating = 'High'
          else if (overall >= 0.25) rating = 'Moderate'
          else rating = 'Low'
        }
        return {
          overallSvi: overall != null ? Math.round(overall * 1000) / 1000 : null,
          socioeconomicSvi: typeof attrs.RPL_THEME1 === 'number' ? Math.round(attrs.RPL_THEME1 * 1000) / 1000 : null,
          householdSvi: typeof attrs.RPL_THEME2 === 'number' ? Math.round(attrs.RPL_THEME2 * 1000) / 1000 : null,
          minoritySvi: typeof attrs.RPL_THEME3 === 'number' ? Math.round(attrs.RPL_THEME3 * 1000) / 1000 : null,
          housingTypeSvi: typeof attrs.RPL_THEME4 === 'number' ? Math.round(attrs.RPL_THEME4 * 1000) / 1000 : null,
          sviRating: rating,
        }
      }
    }
  } catch (err) {
    logger.warn('CDC SVI (Esri) API unavailable', { err })
  }
  return null
}

/**
 * US Drought Monitor (Esri-hosted) — current drought severity.
 * Drought conditions significantly increase wildfire risk and affect water supply.
 */
export interface EsriDroughtResult {
  droughtLevel: string | null       // 'D0'-'D4' or 'None'
  droughtLabel: string | null       // 'Abnormally Dry', 'Moderate', 'Severe', 'Extreme', 'Exceptional'
  droughtIntensity: number          // 0-5, 0=none, 5=exceptional
}

export async function fetchEsriDroughtMonitor(lat: number, lng: number): Promise<EsriDroughtResult | null> {
  try {
    const url = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/US_Drought_Intensity_v1/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=dm,Name&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        const dm = typeof attrs.dm === 'number' ? attrs.dm : null
        const labelMap: Record<number, string> = {
          0: 'Abnormally Dry',
          1: 'Moderate Drought',
          2: 'Severe Drought',
          3: 'Extreme Drought',
          4: 'Exceptional Drought',
        }
        const dmCodeMap: Record<number, string> = { 0: 'D0', 1: 'D1', 2: 'D2', 3: 'D3', 4: 'D4' }
        return {
          droughtLevel: dm != null ? (dmCodeMap[dm] ?? `D${dm}`) : null,
          droughtLabel: dm != null ? (labelMap[dm] ?? (attrs.Name as string) ?? null) : null,
          droughtIntensity: dm != null ? dm + 1 : 0,
        }
      }
    }
    // No drought features = no current drought
    return { droughtLevel: 'None', droughtLabel: 'No drought conditions', droughtIntensity: 0 }
  } catch (err) {
    logger.warn('US Drought Monitor (Esri) API unavailable', { err })
  }
  return null
}

/**
 * USGS Landslide Susceptibility (Esri-hosted) — slope failure risk assessment.
 * Properties on or near steep terrain with susceptible geology face landslide risk.
 */
export interface EsriLandslideResult {
  susceptibility: string | null     // 'High', 'Moderate', 'Low', 'Very Low'
  inclinationClass: string | null   // Slope classification
  exposureScore: number | null      // 0-10 scale
}

export async function fetchEsriLandslideRisk(lat: number, lng: number): Promise<EsriLandslideResult | null> {
  try {
    const url = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/USA_Landslide_Susceptibility/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=SUSCEPTIBILITY,SLOPE_CLASS,EXPOSURE&returnGeometry=false&resultRecordCount=1&f=json`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const attrs = data.features?.[0]?.attributes
      if (attrs) {
        return {
          susceptibility: (attrs.SUSCEPTIBILITY as string) ?? null,
          inclinationClass: (attrs.SLOPE_CLASS as string) ?? null,
          exposureScore: typeof attrs.EXPOSURE === 'number' ? attrs.EXPOSURE : null,
        }
      }
    }
  } catch (err) {
    logger.warn('USGS Landslide Susceptibility (Esri) API unavailable', { err })
  }
  return null
}

/**
 * EPA Envirofacts — Superfund (CERCLIS/SEMS) site proximity.
 * Properties near contaminated sites face environmental liability risk.
 */
export async function fetchSuperfundProximity(lat: number, lng: number): Promise<{
  nearbySites: number
  nearestSiteName: string | null
  nearestSiteDistance: number | null // miles
} | null> {
  try {
    const url = `https://ofmpub.epa.gov/enviro/frs_rest_services.get_facilities?latitude83=${lat}&longitude83=${lng}&search_radius=3&pgm_sys_acrnm=SEMS&output=JSON`
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = await res.json() as {
        Results?: {
          FRSFacility?: Array<{
            PrimaryName?: string
            Latitude83?: number
            Longitude83?: number
          }>
        }
      }
      const sites = data.Results?.FRSFacility ?? []
      if (sites.length > 0) {
        let nearestName: string | null = null
        let minDist = Infinity
        for (const site of sites) {
          if (site.Latitude83 != null && site.Longitude83 != null) {
            const dist = haversineDistanceMiles(lat, lng, site.Latitude83, site.Longitude83)
            if (dist < minDist) {
              minDist = dist
              nearestName = site.PrimaryName ?? null
            }
          }
        }
        return {
          nearbySites: sites.length,
          nearestSiteName: nearestName,
          nearestSiteDistance: minDist < Infinity ? Math.round(minDist * 10) / 10 : null,
        }
      }
      return { nearbySites: 0, nearestSiteName: null, nearestSiteDistance: null }
    }
  } catch (err) {
    logger.warn('EPA Envirofacts API unavailable', { err })
  }
  return null
}

// ─── OpenFEMA Disaster Declarations ──────────────────────────────────────────
// Federal disaster declarations are a strong leading indicator that an area
// has experienced (and may again experience) major perils. Carriers monitor
// declaration history when shaping appetite for a region. We pull the last
// ~10 years of state-level declarations and bucket them by the four risk
// layers we already model so the rest of the pipeline can read them.

const FEMA_INCIDENT_TO_LAYER: Record<string, 'flood' | 'fire' | 'wind' | 'earthquake' | 'other'> = {
  Flood: 'flood',
  'Coastal Storm': 'flood',
  'Severe Storm': 'flood',
  'Severe Storm(s)': 'flood',
  'Severe Ice Storm': 'flood',
  'Dam/Levee Break': 'flood',
  Mud: 'flood',
  Tsunami: 'flood',
  Fire: 'fire',
  'Wildfire': 'fire',
  Hurricane: 'wind',
  Tornado: 'wind',
  Typhoon: 'wind',
  'Tropical Storm': 'wind',
  'Severe Storm - Tornado': 'wind',
  Earthquake: 'earthquake',
}

export interface FemaDisasterHistory {
  totalDeclarations: number
  byLayer: { flood: number; fire: number; wind: number; earthquake: number; other: number }
  recentIncidents: Array<{ incidentType: string; declarationDate: string; title: string }>
  windowYears: number
}

export async function fetchOpenFemaDisasterHistory(
  lat: number,
  lng: number,
  state: string,
): Promise<FemaDisasterHistory | null> {
  if (!state) return null
  const windowYears = 10
  const cutoff = new Date()
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - windowYears)
  const cutoffIso = cutoff.toISOString().slice(0, 10)
  const url =
    'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?' +
    `$filter=state eq '${state.toUpperCase()}' and declarationDate ge '${cutoffIso}'` +
    '&$orderby=declarationDate desc&$top=200&$select=incidentType,declarationDate,declarationTitle'
  try {
    const res = await limitedFetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = (await res.json()) as {
      DisasterDeclarationsSummaries?: Array<{
        incidentType?: string
        declarationDate?: string
        declarationTitle?: string
      }>
    }
    const rows = json.DisasterDeclarationsSummaries ?? []
    const byLayer = { flood: 0, fire: 0, wind: 0, earthquake: 0, other: 0 }
    for (const row of rows) {
      const layer = FEMA_INCIDENT_TO_LAYER[row.incidentType ?? ''] ?? 'other'
      byLayer[layer] += 1
    }
    const recentIncidents = rows.slice(0, 5).map((r) => ({
      incidentType: r.incidentType ?? 'Unknown',
      declarationDate: (r.declarationDate ?? '').slice(0, 10),
      title: r.declarationTitle ?? '',
    }))
    return {
      totalDeclarations: rows.length,
      byLayer,
      recentIncidents,
      windowYears,
    }
  } catch (err) {
    logger.warn('OpenFEMA DisasterDeclarationsSummaries unavailable', { err, state })
    return null
  }
}
