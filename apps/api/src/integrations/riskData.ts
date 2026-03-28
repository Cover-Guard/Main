/**
 * Risk Data Integrations
 *
 * Aggregates risk data from multiple public data sources:
 *
 * FLOOD
 *   - FEMA National Flood Hazard Layer (NFHL) REST API
 *   - OpenFEMA API — historical flood claims by ZIP
 *   - NOAA Sea Level Rise projections (coastal enhancement)
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
 * Each function returns a partial result; missing data falls back to
 * computed scores in riskService.ts.
 */

import { logger } from '../utils/logger'
import type { FloodRisk, FireRisk, EarthquakeRisk, CrimeRisk, WindRisk } from '@coverguard/shared'

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
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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
    const res = await fetch(nfhlUrl.toString(), { signal: AbortSignal.timeout(8000) })
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

  await Promise.all([claimsPromise, slrPromise])

  return floodZoneData
}

async function fetchOpenFemaClaims(zip: string, floodZoneData: Partial<FloodRisk>): Promise<void> {
  try {
    const claimsUrl = `https://www.fema.gov/api/open/v2/nfipClaims?$filter=reportedZipCode eq '${encodeURIComponent(zip)}'&$select=amountPaidOnBuildingClaim,dateOfLoss&$top=200&$orderby=dateOfLoss desc&$format=json`
    const claimsRes = await fetch(claimsUrl, { signal: AbortSignal.timeout(8000) })
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
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
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
}

export async function fetchFireRisk(lat: number, lng: number, state: string): Promise<FireRiskExtended> {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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

  // Run all fire data sources in parallel
  await Promise.all([
    fetchCalFireFHSZ(lat, lng, state, result),
    fetchUsfsWui(lat, lng, result),
    fetchNifcHistoricalFires(lat, lng, result),
    fetchNearestFireStation(lat, lng, result),
    fetchVegetationDensity(lat, lng, result),
  ])

  return result
}

/** California: Cal Fire FHSZ */
async function fetchCalFireFHSZ(lat: number, lng: number, state: string, result: FireRiskExtended): Promise<void> {
  if (state !== 'CA') return
  try {
    const url = `https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZ/FeatureServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=HAZ_CLASS,AGENCY&f=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
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
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
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
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
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
          const discoveryTime = f.attributes?.irwin_FireDiscoveryDateTime as number | null
          const acres = f.attributes?.poly_GISAcres as number | null
          return discoveryTime && (now - discoveryTime < fiveYearsMs) && acres && acres > 1000
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
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const stations = data.features ?? []
      if (stations.length > 0) {
        let minDist = Infinity
        for (const station of stations) {
          const sLat = station.attributes?.LATITUDE as number | null
          const sLng = station.attributes?.LONGITUDE as number | null
          if (sLat && sLng) {
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
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
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
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
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
        if (pga > 0.3) {
          result.liquidationPotential = 'HIGH'
          result.soilType = 'Soft soil (Site Class D-E assumed)'
        } else if (pga > 0.15) {
          result.liquidationPotential = 'MODERATE'
          result.soilType = 'Stiff soil (Site Class C)'
        } else {
          result.liquidationPotential = 'LOW'
          result.soilType = 'Rock/stiff soil (Site Class B-C)'
        }
        return
      }
    }
  } catch (err) {
    logger.warn('USGS Design Maps API unavailable', { err })
  }

  // 2. Fallback: USGS Hazard Curves API
  try {
    const url = `https://earthquake.usgs.gov/hazws/staticcurve/1/E2003/WUS/760/${lat}/${lng}/PGA/2P50`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json() as { hazardCurves?: unknown[] }
      if (data.hazardCurves?.length) {
        result.seismicZone = 'C'
      }
    }
  } catch (err) {
    logger.warn('USGS Hazard Curves API unavailable', { err })
  }
}

/** USGS Quaternary Fault & Fold Database — finds nearest known fault */
async function fetchNearestQuaternaryFault(lat: number, lng: number, result: EarthquakeRiskExtended): Promise<void> {
  try {
    // Query USGS QFaults ArcGIS MapServer — search within ~30 mile radius
    const bufferDeg = 0.45 // ~30 miles
    const envelope = `${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}`
    const url = `https://earthquake.usgs.gov/arcgis/rest/services/eq/QFaults/MapServer/0/query?geometry=${encodeURIComponent(envelope)}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=fault_name,slip_rate,age&returnGeometry=true&resultRecordCount=5&f=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
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
        // No faults found within 30 miles
        result.nearestFaultLine = 30
      }
    }
  } catch (err) {
    logger.warn('USGS QFaults API unavailable', { err })
  }
}

// ─── Wind Risk ────────────────────────────────────────────────────────────────

/** Extended wind result with SLOSH category and SPC event data */
export interface WindRiskExtended extends Partial<WindRisk> {
  sloshCategory?: number | null
  historicalTornadoCount?: number
  historicalHailCount?: number
}

export async function fetchWindRisk(lat: number, lng: number, state: string): Promise<WindRiskExtended> {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
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
    historicalTornadoCount: 0,
    historicalHailCount: 0,
  }

  // Run wind data sources in parallel
  await Promise.all([
    fetchSloshHurricaneSurge(lat, lng, result),
    fetchSpcStormEvents(lat, lng, result),
  ])

  return result
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

/** NOAA SLOSH Hurricane Surge Zones — returns category (1-5) */
async function fetchSloshHurricaneSurge(lat: number, lng: number, result: WindRiskExtended): Promise<void> {
  if (!result.hurricaneRisk) return
  try {
    const url = `https://coast.noaa.gov/arcgis/rest/services/HurricaneEvacuation/SLOSH/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=CATEG&returnGeometry=false&f=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      if (data.features?.length) {
        result.hurricaneRisk = true
        // CATEG field is the SLOSH hurricane category (1-5) the surge zone is modeled for
        const categ = data.features[0]?.attributes?.CATEG
        if (categ != null) {
          const cat = typeof categ === 'string' ? parseInt(categ, 10) : categ as number
          if (!isNaN(cat) && cat >= 1 && cat <= 5) {
            result.sloshCategory = cat
          }
        }
      }
    }
  } catch (err) {
    logger.warn('NOAA SLOSH API unavailable', { err })
  }
}

/** NOAA Storm Events Database (via Iowa Environmental Mesonet) — historical tornado and hail events */
async function fetchSpcStormEvents(lat: number, lng: number, result: WindRiskExtended): Promise<void> {
  // Query NOAA/SPC storm events via IEM's GeoJSON endpoints
  // Tornado reports within ~25 miles over last 20 years
  const bufferDeg = 0.35 // ~25 miles

  // Tornado events — SPC SVRGIS (Severe Weather GIS) tornado tracks
  try {
    const spcUrl = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Tornado_Tracks/FeatureServer/0/query?geometry=${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=yr,mag&where=yr>=2004&resultRecordCount=50&returnGeometry=false&f=json`
    const res = await fetch(spcUrl, { signal: AbortSignal.timeout(8000) })
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
    const hailUrl = `https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Hail_Reports/FeatureServer/0/query?geometry=${lng - bufferDeg},${lat - bufferDeg},${lng + bufferDeg},${lat + bufferDeg}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=yr,size&where=yr>=2004&resultRecordCount=50&returnGeometry=false&f=json`
    const res = await fetch(hailUrl, { signal: AbortSignal.timeout(8000) })
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
}

export async function fetchCrimeRisk(lat: number, lng: number, zip: string): Promise<CrimeRiskExtended> {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    logger.warn('Invalid coordinates for crime risk', { lat, lng })
    return { dataSourceUsed: 'NONE' }
  }

  // Try FBI CDE first (most accurate)
  const fbiResult = await fetchFbiCrimeData(zip)
  if (fbiResult) return { ...fbiResult, dataSourceUsed: 'FBI_CDE' }

  // Fallback: Census Bureau ACS poverty/income data as crime proxy
  const censusResult = await fetchCensusAcsCrimeProxy(zip)
  if (censusResult) return { ...censusResult, dataSourceUsed: 'CENSUS_ACS' }

  return { dataSourceUsed: 'NONE' }
}

async function fetchFbiCrimeData(zip: string): Promise<Partial<CrimeRisk> | null> {
  const fbiKey = process.env.FBI_CDE_KEY
  if (!fbiKey) return null

  const fbiHeaders = { 'x-api-key': fbiKey }

  try {
    // FBI CDE: get agencies near this ZIP code
    const agenciesUrl = `https://api.usa.gov/crime/fbi/cde/agencies/byZip/${encodeURIComponent(zip)}`
    const agenciesRes = await fetch(agenciesUrl, { signal: AbortSignal.timeout(10000), headers: fbiHeaders })
    if (!agenciesRes.ok) return null

    const agencies = (await agenciesRes.json()) as { results?: Array<{ ori: string }> }
    const ori = agencies.results?.[0]?.ori
    if (!ori) return null

    // Get summary stats for this agency
    const summaryUrl = `https://api.usa.gov/crime/fbi/cde/summarized/agency/${encodeURIComponent(ori)}/offenses?from=2020&to=2023`
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(10000), headers: fbiHeaders })
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
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = (await res.json()) as string[][]
    // First row is headers, second row is values
    if (!data || data.length < 2) return null

    const values = data[1]
    const belowPoverty = parseInt(values[0], 10)
    const totalPovPop = parseInt(values[1], 10)
    const medianIncome = parseInt(values[2], 10)
    const unemployed = parseInt(values[3], 10)
    const laborForce = parseInt(values[4], 10)

    if (isNaN(totalPovPop) || totalPovPop === 0) return null

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
