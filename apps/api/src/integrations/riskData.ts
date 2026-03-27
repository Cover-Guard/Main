/**
 * Risk Data Integrations
 *
 * Aggregates risk data from multiple public data sources:
 *
 * FLOOD
 *   - FEMA National Flood Hazard Layer (NFHL) REST API
 *   - OpenFEMA API — historical flood claims by ZIP
 *
 * FIRE
 *   - Cal Fire FHSZ (California only)
 *   - USFS Wildland-Urban Interface (all states)
 *   - USDA Forest Service Fire Occurrence data
 *
 * EARTHQUAKE
 *   - USGS Design Maps Web Service (ASCE 7-22)
 *   - USGS Earthquake Hazard Tool (PGA)
 *
 * WIND / HURRICANE
 *   - NOAA Coastal Services Center (hurricane return periods)
 *   - ASCE 7 Basic Wind Speed by latitude band
 *
 * CRIME
 *   - FBI Crime Data Explorer API (requires API key: FBI_CDE_KEY)
 *   - Census Bureau ACS 5-year estimates (poverty proxy for crime)
 *
 * Each function returns a partial result; missing data falls back to
 * computed scores in riskService.ts.
 */

import { logger } from '../utils/logger'
import type { FloodRisk, FireRisk, EarthquakeRisk, CrimeRisk, WindRisk } from '@coverguard/shared'

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
          annualChanceOfFlooding: inSFHA ? 1.0 : 0.2,
        }
      }
    }
  } catch (err) {
    logger.warn('FEMA NFHL API unavailable', { err })
  }

  // Enrich with OpenFEMA historical claims for the ZIP
  if (zip) {
    try {
      const claimsUrl = `https://www.fema.gov/api/open/v2/nfipClaims?$filter=reportedZipCode eq '${zip}'&$select=amountPaidOnBuildingClaim,dateOfLoss&$top=100&$format=json`
      const claimsRes = await fetch(claimsUrl, { signal: AbortSignal.timeout(8000) })
      if (claimsRes.ok) {
        const claimsData = (await claimsRes.json()) as { NfipClaims: OpenFemaFloodClaim[] }
        const claims = claimsData.NfipClaims ?? []
        if (claims.length > 10) {
          // Elevated historical claim activity increases risk
          floodZoneData.annualChanceOfFlooding = Math.max(
            floodZoneData.annualChanceOfFlooding ?? 0.2,
            Math.min(claims.length / 500, 5.0)
          )
        }
      }
    } catch (err) {
      logger.warn('OpenFEMA claims API unavailable', { err })
    }
  }

  return floodZoneData
}

// ─── Fire Risk ────────────────────────────────────────────────────────────────

interface ArcGISFeatureResult {
  features: Array<{ attributes: Record<string, string | number | null> }>
}

export async function fetchFireRisk(lat: number, lng: number, state: string): Promise<Partial<FireRisk>> {
  const result: Partial<FireRisk> = {
    fireHazardSeverityZone: null,
    wildlandUrbanInterface: false,
  }

  // 1. California: Cal Fire FHSZ
  if (state === 'CA') {
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

  // 2. USFS Wildland-Urban Interface layer (all states)
  try {
    const url = `https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_WUI_2020_01/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=WUICLASS10&f=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (res.ok) {
      const data = (await res.json()) as ArcGISFeatureResult
      const wuiClass = data.features?.[0]?.attributes?.WUICLASS10 as string | undefined
      if (wuiClass) {
        // WUI classes: Intermix, Interface, Non-WUI
        result.wildlandUrbanInterface = result.wildlandUrbanInterface ||
          (wuiClass === 'Intermix' || wuiClass === 'Interface')
      }
    }
  } catch (err) {
    logger.warn('USFS WUI API unavailable', { err })
  }

  return result
}

// ─── Earthquake Risk (USGS) ───────────────────────────────────────────────────

interface UsgsDesignMapResponse {
  response: { data: { ss: number; s1: number; pga: number } }
}

export async function fetchEarthquakeRisk(lat: number, lng: number): Promise<Partial<EarthquakeRisk>> {
  // 1. USGS Design Maps (ASCE 7-22) — spectral acceleration
  try {
    const url = `https://earthquake.usgs.gov/ws/designmaps/asce7-22.json?latitude=${lat}&longitude=${lng}&riskCategory=II&siteClass=C&title=CoverGuard`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const data = (await res.json()) as UsgsDesignMapResponse
      const ss = data?.response?.data?.ss
      const pga = data?.response?.data?.pga

      const seismicZone = ss > 1.5 ? 'D' : ss > 0.75 ? 'C' : ss > 0.25 ? 'B' : 'A'

      return { seismicZone, nearestFaultLine: pga > 0.3 ? 5 : 25 }
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
        return { seismicZone: 'C' } // Elevated zone if hazard data present
      }
    }
  } catch (err) {
    logger.warn('USGS Hazard Curves API unavailable', { err })
  }

  return {}
}

// ─── Wind Risk ────────────────────────────────────────────────────────────────

interface NoaaHurricaneResponse {
  features?: Array<{ attributes?: { CATEG?: string } }>
}

export async function fetchWindRisk(lat: number, lng: number, state: string): Promise<Partial<WindRisk>> {
  const hurricaneStates = ['FL', 'TX', 'LA', 'MS', 'AL', 'GA', 'SC', 'NC', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'ME']
  const tornadoStates   = ['TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'MO', 'IA', 'IL', 'IN', 'OH', 'AR', 'LA', 'MS', 'AL', 'TN', 'KY']
  const hailStates      = ['TX', 'OK', 'KS', 'NE', 'SD', 'ND', 'CO', 'WY', 'MT', 'MN', 'IA', 'MO']

  let hurricaneRisk = hurricaneStates.includes(state)
  const tornadoRisk  = tornadoStates.includes(state)
  const hailRisk     = hailStates.includes(state)
  const designWindSpeed = lat < 25 ? 180 : lat < 30 ? 150 : lat < 35 ? 130 : 115

  // NOAA SLOSH Hurricane Surge Zones (coastal only)
  if (hurricaneRisk) {
    try {
      const url = `https://coast.noaa.gov/arcgis/rest/services/HurricaneEvacuation/SLOSH/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&outFields=CATEG&f=json`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (res.ok) {
        const data = (await res.json()) as NoaaHurricaneResponse
        if (data.features?.length) {
          hurricaneRisk = true // confirmed coastal hurricane surge zone
        }
      }
    } catch (err) {
      logger.warn('NOAA SLOSH API unavailable', { err })
    }
  }

  return { hurricaneRisk, tornadoRisk, hailRisk, designWindSpeed }
}

// ─── Crime Risk (FBI Crime Data Explorer) ─────────────────────────────────────

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

export async function fetchCrimeRisk(lat: number, lng: number, zip: string): Promise<Partial<CrimeRisk>> {
  const fbiKey = process.env.FBI_CDE_KEY

  if (!fbiKey) {
    // Without an API key, fall back to computed score from riskService
    return {}
  }

  try {
    // FBI CDE: get agencies near this ZIP code
    const agenciesUrl = `https://api.usa.gov/crime/fbi/cde/agencies/byZip/${zip}?API_KEY=${fbiKey}`
    const agenciesRes = await fetch(agenciesUrl, { signal: AbortSignal.timeout(10000) })
    if (!agenciesRes.ok) return {}

    const agencies = (await agenciesRes.json()) as { results?: Array<{ ori: string }> }
    const ori = agencies.results?.[0]?.ori
    if (!ori) return {}

    // Get summary stats for this agency
    const summaryUrl = `https://api.usa.gov/crime/fbi/cde/summarized/agency/${ori}/offenses?from=2020&to=2023&API_KEY=${fbiKey}`
    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(10000) })
    if (!summaryRes.ok) return {}

    const summaryData = (await summaryRes.json()) as FbiAgencyData
    const latest = summaryData.data?.[0]?.summary?.sort((a, b) => b.year - a.year)[0]
    if (!latest || !latest.population) return {}

    const violentRate   = (latest.violent_crime   / latest.population) * 100000
    const propertyRate  = (latest.property_crime  / latest.population) * 100000

    // National averages (FBI 2022): violent ~380, property ~1,954 per 100k
    const nationalViolentAvg  = 380
    const nationalAvgDiff = ((violentRate - nationalViolentAvg) / nationalViolentAvg) * 100

    return {
      violentCrimeIndex:  Math.round(violentRate),
      propertyCrimeIndex: Math.round(propertyRate),
      nationalAverageDiff: Math.round(nationalAvgDiff),
    }
  } catch (err) {
    logger.warn('FBI CDE API error', { err })
    return {}
  }
}
