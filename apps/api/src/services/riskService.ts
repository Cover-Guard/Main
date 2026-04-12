import { prisma } from '../utils/prisma'
import { riskCache, riskDeduplicator } from '../utils/cache'
import { getStateRiskConfig, type PerilModifierConfig } from '../data/stateRiskProfiles'
import {
  fetchFloodRisk,
  fetchFireRisk,
  fetchEarthquakeRisk,
  fetchWindRisk,
  fetchCrimeRisk,
  fetchElevation,
  fetchHistoricalEarthquakes,
  fetchLandfireFuelModel,
  fetchFemaNri,
  fetchSinkholeRisk,
  fetchDamHazard,
  fetchSuperfundProximity,
  fetchOpenFemaDisasterHistory,
  type FemaDisasterHistory,
  fetchEsriFloodHazard,
  fetchEsriLandslideRisk,
  fetchEsriSocialVulnerability,
} from '../integrations/riskData'
import type {
  FireRiskExtended,
  EarthquakeRiskExtended,
  WindRiskExtended,
  CrimeRiskExtended,
  NriResult,
  EsriFloodHazardResult,
  EsriLandslideResult,
  EsriSviResult,
} from '../integrations/riskData'
import type { PropertyRiskProfile, RiskLevel, RiskTrend, StateRiskContext, StatePerilModifier } from '@coverguard/shared'
import { RISK_CACHE_TTL_SECONDS, RISK_SCORE_THRESHOLDS } from '@coverguard/shared'
import { RiskLevel as PrismaRiskLevel } from '../generated/prisma/client'
import { logger } from '../utils/logger'

function scoreToLevel(score: number): PrismaRiskLevel {
  if (score <= RISK_SCORE_THRESHOLDS.LOW) return 'LOW'
  if (score <= RISK_SCORE_THRESHOLDS.MODERATE) return 'MODERATE'
  if (score <= RISK_SCORE_THRESHOLDS.HIGH) return 'HIGH'
  if (score <= RISK_SCORE_THRESHOLDS.VERY_HIGH) return 'VERY_HIGH'
  return 'EXTREME'
}

// ─── Individual risk scoring functions ───────────────────────────────────────

function computeFloodScore(
  floodZone: string | undefined,
  inSFHA: boolean,
  annualChance: number | null,
): number {
  if (!floodZone || floodZone === 'UNKNOWN') return 20

  let baseScore: number
  if (floodZone.startsWith('V')) {
    baseScore = 95 // Coastal high hazard
  } else if (floodZone === 'AE' || floodZone === 'AH') {
    baseScore = 80
  } else if (floodZone === 'AO') {
    baseScore = 78 // Sheet flow flooding
  } else if (floodZone === 'AR') {
    baseScore = 65 // Reduced risk from levee
  } else if (floodZone === 'A99') {
    baseScore = 60 // Federal flood protection under construction
  } else if (floodZone.startsWith('A')) {
    baseScore = inSFHA ? 75 : 60
  } else if (floodZone === 'D') {
    baseScore = 35 // Undetermined but possible flood hazard
  } else if (floodZone === 'B' || floodZone === 'X500') {
    baseScore = 25 // Moderate flood hazard (500-yr floodplain)
  } else if (floodZone === 'X' || floodZone === 'C') {
    baseScore = 10 // Minimal flood hazard
  } else {
    baseScore = 20
  }

  // Boost score based on high annual flood chance from historical data
  if (annualChance != null && annualChance > 1.0) {
    const chanceBoost = Math.min((annualChance - 1.0) * 5, 15)
    baseScore = Math.min(100, baseScore + chanceBoost)
  }

  return baseScore
}

function computeFireScore(fireData: FireRiskExtended): number {
  const hazZone = fireData.fireHazardSeverityZone ?? null
  const wui = fireData.wildlandUrbanInterface ?? false
  const wuiClass = fireData.wuiClass ?? null
  const recentFires = fireData.recentFireCount ?? 0
  const nearestStation = fireData.nearestFireStation ?? null
  const vegetation = fireData.vegetationDensity ?? null

  // Base score from WUI classification
  let score: number
  if (wuiClass === 'Intermix') {
    score = 50 // Intermix is higher risk than Interface
  } else if (wuiClass === 'Interface') {
    score = 40
  } else if (wui) {
    score = 40 // Generic WUI (from Cal Fire or NIFC detection)
  } else {
    score = 15
  }

  // Override with hazard zone if present (Cal Fire or NIFC-derived)
  if (hazZone === 'EXTREME') score = Math.max(score, 90)
  else if (hazZone === 'VERY HIGH') score = Math.max(score, 75)
  else if (hazZone === 'HIGH') score = Math.max(score, 55)

  // Boost from recent historical fires nearby (NIFC perimeters)
  if (recentFires > 0) {
    const fireBoost = Math.min(recentFires * 3, 20)
    score = Math.min(100, score + fireBoost)
  }

  // Fire station distance penalty
  if (nearestStation != null) {
    if (nearestStation > 8) score = Math.min(100, score + 10) // Very remote
    else if (nearestStation > 5) score = Math.min(100, score + 5)
  }

  // Vegetation density boost
  if (vegetation === 'HIGH') score = Math.min(100, score + 8)
  else if (vegetation === 'MODERATE') score = Math.min(100, score + 3)

  // Esri Wildfire Hazard Potential boost
  const esriWhp = fireData.esriWildfireHazardPotential ?? null
  if (esriWhp === 'Very High') score = Math.max(score, 80)
  else if (esriWhp === 'High') score = Math.max(score, 60)
  else if (esriWhp === 'Moderate') score = Math.max(score, Math.min(score + 5, 100))

  // Esri Drought intensity boost — drought amplifies fire risk
  const droughtIntensity = fireData.esriDroughtIntensity ?? 0
  if (droughtIntensity >= 4) score = Math.min(100, score + 10) // Extreme/Exceptional drought
  else if (droughtIntensity >= 2) score = Math.min(100, score + 5) // Severe drought
  else if (droughtIntensity >= 1) score = Math.min(100, score + 2) // Moderate drought

  return score
}

function computeWindScore(windData: WindRiskExtended): number {
  const hurricaneRisk = windData.hurricaneRisk ?? false
  const tornadoRisk = windData.tornadoRisk ?? false
  const hailRisk = windData.hailRisk ?? false
  const sloshCategory = windData.sloshCategory ?? null
  const historicalTornado = windData.historicalTornadoCount ?? 0
  const historicalHail = windData.historicalHailCount ?? 0

  let score = 10

  // Hurricane risk with SLOSH category differentiation
  if (hurricaneRisk) {
    if (sloshCategory != null) {
      // SLOSH category: 1 (minimal surge) to 5 (catastrophic)
      // Cat 1 surge zone → score 55; Cat 5 → score 90
      score = Math.max(score, Math.min(100, 45 + sloshCategory * 9))
    } else {
      score = Math.max(score, 70) // Hurricane state but no SLOSH data
    }
    // Historical hurricane track proximity boosts further
    const historicalHurricane = windData.historicalHurricaneCount ?? 0
    if (historicalHurricane > 10) score = Math.min(100, score + 10)
    else if (historicalHurricane > 5) score = Math.min(100, score + 5)
  }

  // Tornado risk boosted by historical occurrence
  if (tornadoRisk) {
    let tornadoScore = 45
    if (historicalTornado > 10) tornadoScore = 70
    else if (historicalTornado > 5) tornadoScore = 60
    else if (historicalTornado > 0) tornadoScore = 55
    score = Math.max(score, tornadoScore)
  }

  // Hail risk boosted by historical occurrence
  if (hailRisk) {
    let hailScore = 30
    if (historicalHail > 20) hailScore = 55
    else if (historicalHail > 10) hailScore = 45
    else if (historicalHail > 0) hailScore = 40
    score = Math.max(score, hailScore)
  }

  // Esri hurricane category data — if max category is high, boost further
  const esriMaxCat = windData.esriHurricaneMaxCategory ?? null
  if (esriMaxCat != null && esriMaxCat >= 4) {
    score = Math.min(100, Math.max(score, 85))
  } else if (esriMaxCat != null && esriMaxCat >= 3) {
    score = Math.min(100, Math.max(score, 75))
  }

  return score
}

function computeEarthquakeScore(
  eqData: EarthquakeRiskExtended,
  historicalEq?: { count: number; maxMagnitude: number | null; significantCount: number } | null,
): number {
  const seismicZone = eqData.seismicZone ?? 'A'
  const ss = eqData.ss ?? null
  const nearestFault = eqData.nearestFaultLine ?? null

  let score: number

  // Use spectral acceleration for more granular scoring when available
  if (ss != null) {
    if (ss > 2.0) score = 90
    else if (ss > 1.5) score = 80
    else if (ss > 1.0) score = 65
    else if (ss > 0.75) score = 55
    else if (ss > 0.5) score = 40
    else if (ss > 0.25) score = 30
    else if (ss > 0.1) score = 15
    else score = 10
  } else {
    const zoneScores: Record<string, number> = { D: 80, C: 55, B: 30, A: 10 }
    score = zoneScores[seismicZone] ?? 15
  }

  // Proximity to known fault amplifies risk
  if (nearestFault != null) {
    if (nearestFault < 2) score = Math.min(100, score + 15)
    else if (nearestFault < 5) score = Math.min(100, score + 8)
    else if (nearestFault < 10) score = Math.min(100, score + 3)
  }

  // Historical earthquake activity boosts score
  if (historicalEq) {
    if (historicalEq.significantCount > 5) score = Math.min(100, score + 12)
    else if (historicalEq.significantCount > 0) score = Math.min(100, score + 6)
    else if (historicalEq.count > 20) score = Math.min(100, score + 4)

    if (historicalEq.maxMagnitude != null && historicalEq.maxMagnitude >= 6.0) {
      score = Math.min(100, score + 10)
    }
  }

  return score
}

function computeCrimeScore(crimeData: CrimeRiskExtended): { score: number; fromCensus: boolean } {
  if (crimeData.violentCrimeIndex != null && crimeData.propertyCrimeIndex != null) {
    const violentNorm = Math.min((crimeData.violentCrimeIndex / 760) * 50, 50)
    const propertyNorm = Math.min((crimeData.propertyCrimeIndex / 4220) * 50, 50)
    return {
      score: Math.round(violentNorm + propertyNorm),
      fromCensus: crimeData.dataSourceUsed === 'CENSUS_ACS',
    }
  }
  return { score: 0, fromCensus: false }
}

// ─── State modifier application ──────────────────────────────────────────────

interface RawScores {
  flood: number
  fire: number
  wind: number
  earthquake: number
  crime: number
}

function applyStateModifiers(
  rawScores: RawScores,
  stateCode: string,
): { scores: RawScores; overallBoost: number; stateContext: StateRiskContext | null } {
  const config = getStateRiskConfig(stateCode)
  if (!config) return { scores: rawScores, overallBoost: 0, stateContext: null }

  // Apply a single peril modifier (floor + multiplier) and return modifier metadata
  const adjustScore = (
    rawScore: number,
    cfg: PerilModifierConfig | undefined,
  ): { score: number; modifier: StatePerilModifier | undefined } => {
    if (!cfg) return { score: rawScore, modifier: undefined }
    const multiplied = Math.min(100, rawScore * (cfg.multiplier ?? 1.0))
    const floored = Math.max(cfg.floor ?? 0, multiplied)
    const finalScore = Math.round(floored)
    return {
      score: finalScore,
      modifier: {
        floor: cfg.floor,
        multiplier: cfg.multiplier,
        reason: cfg.reason,
        applied: finalScore !== rawScore,
      },
    }
  }

  const floodR = adjustScore(rawScores.flood, config.perils.flood)
  const fireR  = adjustScore(rawScores.fire,  config.perils.fire)
  const windR  = adjustScore(rawScores.wind,  config.perils.wind)
  const eqR    = adjustScore(rawScores.earthquake, config.perils.earthquake)

  // Building-code adjustment — weak or missing codes raise wind and earthquake risk because
  // structures built without enforceable standards are more vulnerable to damage.
  const codeBoostMap: Record<string, number> = { NONE: 12, WEAK: 8, MODERATE: 3, STRONG: 0 }
  const codeBoost = codeBoostMap[config.regulatory.buildingCodeStrength] ?? 0
  const windFinal = Math.min(100, windR.score + codeBoost)
  const eqFinal   = Math.min(100, eqR.score   + Math.round(codeBoost * 0.75))

  // Regulatory / market overall boost — hard/crisis markets and carrier exits represent
  // additional effective risk for the property owner (coverage harder or impossible to obtain).
  const marketBoostMap: Record<string, number> = { CRISIS: 8, HARD: 5, STRESSED: 3, STABLE: 0 }
  let overallBoost = marketBoostMap[config.market.condition] ?? 0
  if (config.market.carriersExiting) overallBoost += 3
  // In prior-approval states with carrier exits, rate suppression means premiums cannot
  // keep pace with actual risk — compounding effective risk for remaining policyholders.
  if (config.regulatory.rateRegulation === 'PRIOR_APPROVAL' && config.market.carriersExiting) {
    overallBoost += 2
  }

  // Build state context with applied flags
  const buildModifier = (
    base: StatePerilModifier | undefined,
    extraApplied: boolean,
    extraReason?: string,
  ): StatePerilModifier | undefined => {
    if (base) return { ...base, applied: base.applied || extraApplied }
    if (extraApplied && extraReason) return { reason: extraReason, applied: true }
    return undefined
  }

  const codeReason = `Building code strength (${config.regulatory.buildingCodeStrength}) affects structural vulnerability`
  const stateContext: StateRiskContext = {
    stateCode: stateCode.toUpperCase(),
    stateName: config.name,
    flood: floodR.modifier,
    fire:  fireR.modifier,
    wind:  buildModifier(windR.modifier, codeBoost > 0, codeReason),
    earthquake: buildModifier(eqR.modifier, codeBoost > 0, codeReason),
    market:     config.market,
    regulatory: config.regulatory,
    knownCatastrophicExposures: config.knownCatastrophicExposures,
    notes: config.notes,
  }

  return {
    scores: {
      flood:     floodR.score,
      fire:      fireR.score,
      wind:      windFinal,
      earthquake: eqFinal,
      crime:     rawScores.crime,
    },
    overallBoost,
    stateContext,
  }
}

// ─── Main service function ───────────────────────────────────────────────────

export async function getOrComputeRiskProfile(
  propertyId: string,
  forceRefresh = false,
): Promise<PropertyRiskProfile> {
  // L1 cache hit — no DB or external API call needed
  if (!forceRefresh) {
    const l1 = riskCache.get(propertyId)
    if (l1) return l1
  }

  // Deduplicate concurrent requests for the same property
  const dedupeKey = forceRefresh ? `${propertyId}:refresh` : propertyId
  return riskDeduplicator.dedupe(dedupeKey, async () => {
    // Single query: fetch property + existing risk profile together
    const property = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: { riskProfile: true },
    })

    const cached = property.riskProfile
    if (!forceRefresh && cached && cached.expiresAt > new Date()) {
      const dto = prismaProfileToDto(cached, propertyId, { stateContext: getStateContextOnly(property.state) })
      riskCache.set(propertyId, dto, cached.expiresAt.getTime() - Date.now())
      return dto
    }

    logger.info('Computing risk profile', { propertyId, forceRefresh, state: property.state })

    // Fetch all risk data sources in parallel (primary + supplemental).
    // Each source is individually caught so a single upstream failure
    // (timeout, DNS, JSON parse error) cannot crash the entire profile.
    const safe = <T>(fn: Promise<T>, fallback: T, label: string): Promise<T> =>
      fn.catch((err) => {
        logger.warn(`Risk data source "${label}" failed — using fallback`, {
          propertyId,
          error: err instanceof Error ? err.message : err,
        })
        return fallback
      })

    const [
      floodData, fireData, earthquakeData, windData, crimeData,
      elevation, historicalEq, fuelModel, nriData, sinkholeData, damData, superfundData,
      esriFloodHazard, esriLandslide, esriSvi,
      femaDisasters,
    ] = await Promise.all([
      // Primary sources
      safe(fetchFloodRisk(property.lat, property.lng, property.zip ?? ''), { floodZone: 'UNKNOWN', inSpecialFloodHazardArea: false }, 'FEMA Flood'),
      safe(fetchFireRisk(property.lat, property.lng, property.state), {}, 'Fire Risk'),
      safe(fetchEarthquakeRisk(property.lat, property.lng), {}, 'Earthquake'),
      safe(fetchWindRisk(property.lat, property.lng, property.state), {}, 'Wind'),
      safe(fetchCrimeRisk(property.lat, property.lng, property.zip ?? ''), {}, 'Crime'),
      // Supplemental sources
      safe(fetchElevation(property.lat, property.lng), null, 'Elevation'),
      safe(fetchHistoricalEarthquakes(property.lat, property.lng), null, 'Historical EQ'),
      safe(fetchLandfireFuelModel(property.lat, property.lng), null, 'LANDFIRE'),
      safe(fetchFemaNri(property.lat, property.lng), null, 'FEMA NRI'),
      safe(fetchSinkholeRisk(property.lat, property.lng), null, 'Sinkhole'),
      safe(fetchDamHazard(property.lat, property.lng), null, 'Dam Hazard'),
      safe(fetchSuperfundProximity(property.lat, property.lng), null, 'Superfund'),
      // Esri Living Atlas supplemental sources
      safe(fetchEsriFloodHazard(property.lat, property.lng), null, 'Esri Flood Hazard'),
      safe(fetchEsriLandslideRisk(property.lat, property.lng), null, 'Esri Landslide'),
      safe(fetchEsriSocialVulnerability(property.lat, property.lng), null, 'Esri CDC SVI'),
      // Federal disaster declaration history (last 10 years, state-level)
      safe(fetchOpenFemaDisasterHistory(property.lat, property.lng, property.state), null, 'OpenFEMA Disasters'),
    ])

    // Enhance flood score with elevation data (low elevation = higher risk)
    // Low elevation increases flooding vulnerability from storm surge, tidal flooding,
    // and poor drainage regardless of FEMA zone designation
    let elevationBoost = 0
    if (elevation != null && elevation < 15) {
      // Graduated boost: lower elevation = higher boost (0-15ft range → 1-8 or 1-12 points)
      const baseBoost = Math.round((15 - elevation) / 2)
      // SFHA properties get a higher multiplier (compounding risk)
      elevationBoost = floodData.inSpecialFloodHazardArea
        ? Math.min(12, Math.max(1, baseBoost))
        : Math.min(8, Math.max(1, baseBoost))
    }
    // Boost flood from dam hazard data
    let damBoost = 0
    if (damData && damData.nearbyHighHazardDams > 0) {
      const damCondition = damData.nearestDamCondition?.toUpperCase() ?? ''
      if (damCondition === 'UNSATISFACTORY' || damCondition === 'POOR') {
        damBoost = 15
      } else if (damData.nearbyHighHazardDams >= 3) {
        damBoost = 8
      } else {
        damBoost = 5
      }
    }

    const rawFloodScore = Math.min(100, computeFloodScore(
      floodData.floodZone,
      floodData.inSpecialFloodHazardArea ?? false,
      floodData.annualChanceOfFlooding ?? null,
    ) + elevationBoost + damBoost)

    // Enhance fire score with LANDFIRE fuel model
    const fireData2 = { ...fireData }
    if (fuelModel) {
      // High fuel models (timber, brush) boost fire risk
      const fuelDesc = (fuelModel.fuelDescription ?? '').toLowerCase()
      if (fuelDesc.includes('timber') || fuelDesc.includes('slash')) {
        fireData2.vegetationDensity = fireData2.vegetationDensity ?? 'HIGH'
      } else if (fuelDesc.includes('brush') || fuelDesc.includes('shrub')) {
        fireData2.vegetationDensity = fireData2.vegetationDensity ?? 'MODERATE'
      }
    }
    const rawFireScore = computeFireScore(fireData2)
    const rawWindScore = computeWindScore(windData)

    // Enhance earthquake score with historical events
    const rawEarthquakeScore = computeEarthquakeScore(earthquakeData, historicalEq)
    const crimeResult = computeCrimeScore(crimeData)
    const crimeScore = crimeResult.score

    // Apply state-level modifiers: peril floors/multipliers, building-code adjustments,
    // and market/regulatory overall boost
    const { scores: adjustedScores, overallBoost, stateContext } = applyStateModifiers(
      { flood: rawFloodScore, fire: rawFireScore, wind: rawWindScore, earthquake: rawEarthquakeScore, crime: crimeScore },
      property.state,
    )
    const floodScore     = adjustedScores.flood
    const fireScore      = adjustedScores.fire
    const windScore      = adjustedScores.wind
    const earthquakeScore = adjustedScores.earthquake

    // Weighted overall score — crime weight reduced when data unavailable
    const crimeWeight = crimeData.dataSourceUsed === 'NONE' ? 0.0 : 0.10
    const remainingWeight = 1.0 - crimeWeight
    // Distribute remaining weight proportionally if crime data unavailable
    const floodW = 0.30 * (crimeWeight === 0 ? remainingWeight / 0.90 : 1)
    const fireW = 0.25 * (crimeWeight === 0 ? remainingWeight / 0.90 : 1)
    const windW = 0.20 * (crimeWeight === 0 ? remainingWeight / 0.90 : 1)
    const eqW = 0.15 * (crimeWeight === 0 ? remainingWeight / 0.90 : 1)

    const overallScore = Math.min(
      100,
      Math.round(
        floodScore * floodW +
        fireScore * fireW +
        windScore * windW +
        earthquakeScore * eqW +
        crimeScore * crimeWeight +
        overallBoost,        // regulatory / market risk contribution
      ),
    )

    const expiresAt = new Date(Date.now() + RISK_CACHE_TTL_SECONDS * 1000)

    const profileData = {
      overallRiskLevel: scoreToLevel(overallScore),
      overallRiskScore: overallScore,
      floodRiskLevel: scoreToLevel(floodScore),
      floodRiskScore: floodScore,
      floodZone: floodData.floodZone ?? null,
      floodFirmPanelId: floodData.firmPanelId ?? null,
      floodBaseElevation: floodData.baseFloodElevation ?? null,
      inSFHA: floodData.inSpecialFloodHazardArea ?? false,
      floodAnnualChance: floodData.annualChanceOfFlooding ?? null,
      fireRiskLevel: scoreToLevel(fireScore),
      fireRiskScore: fireScore,
      fireHazardZone: fireData.fireHazardSeverityZone ?? null,
      wildlandUrbanInterface: fireData.wildlandUrbanInterface ?? false,
      nearestFireStation: fireData.nearestFireStation ?? null,
      windRiskLevel: scoreToLevel(windScore),
      windRiskScore: windScore,
      hurricaneRisk: windData.hurricaneRisk ?? false,
      tornadoRisk: windData.tornadoRisk ?? false,
      hailRisk: windData.hailRisk ?? false,
      designWindSpeed: windData.designWindSpeed ?? null,
      earthquakeRiskLevel: scoreToLevel(earthquakeScore),
      earthquakeRiskScore: earthquakeScore,
      seismicZone: earthquakeData.seismicZone ?? null,
      nearestFaultLine: earthquakeData.nearestFaultLine ?? null,
      crimeRiskLevel: scoreToLevel(crimeScore),
      crimeRiskScore: crimeScore,
      violentCrimeIndex: crimeData.violentCrimeIndex ?? 0,
      propertyCrimeIndex: crimeData.propertyCrimeIndex ?? 0,
      nationalAvgDiff: crimeData.nationalAverageDiff ?? 0,
      expiresAt,
    }

    const profile = await prisma.riskProfile.upsert({
      where: { propertyId },
      update: { ...profileData, generatedAt: new Date() },
      create: { propertyId, ...profileData },
    })

    const dto = prismaProfileToDto(profile, propertyId, {
      fireData: fireData2,
      earthquakeData,
      windData,
      crimeData,
      elevation,
      historicalEq,
      fuelModel,
      nriData,
      sinkholeData,
      damData,
      superfundData,
      esriFloodHazard,
      esriLandslide,
      esriSvi,
      femaDisasters,
      stateContext: stateContext ?? undefined,
    })
    riskCache.set(propertyId, dto, RISK_CACHE_TTL_SECONDS * 1000)
    return dto
  })
}

// ─── Prisma → DTO conversion ─────────────────────────────────────────────────

/** Build a StateRiskContext from static state data only (no applied-flag details).
 *  Used when loading a cached profile from the DB where raw scores are no longer available. */
function getStateContextOnly(stateCode: string): StateRiskContext | undefined {
  const config = getStateRiskConfig(stateCode)
  if (!config) return undefined
  return {
    stateCode: stateCode.toUpperCase(),
    stateName: config.name,
    flood:      config.perils.flood      ? { ...config.perils.flood }      : undefined,
    fire:       config.perils.fire       ? { ...config.perils.fire }       : undefined,
    wind:       config.perils.wind       ? { ...config.perils.wind }       : undefined,
    earthquake: config.perils.earthquake ? { ...config.perils.earthquake } : undefined,
    market:     config.market,
    regulatory: config.regulatory,
    knownCatastrophicExposures: config.knownCatastrophicExposures,
    notes: config.notes,
  }
}

interface EnrichmentData {
  fireData?: FireRiskExtended
  earthquakeData?: EarthquakeRiskExtended
  windData?: WindRiskExtended
  crimeData?: CrimeRiskExtended
  elevation?: number | null
  historicalEq?: { count: number; maxMagnitude: number | null; significantCount: number } | null
  fuelModel?: { fuelModel: string | null; fuelDescription: string | null } | null
  nriData?: NriResult | null
  sinkholeData?: { inKarstArea: boolean; karstType: string | null } | null
  damData?: { nearbyHighHazardDams: number; nearestDamName: string | null; nearestDamCondition: string | null; nearestDamDistance: number | null } | null
  superfundData?: { nearbySites: number; nearestSiteName: string | null; nearestSiteDistance: number | null } | null
  esriFloodHazard?: EsriFloodHazardResult | null
  esriLandslide?: EsriLandslideResult | null
  esriSvi?: EsriSviResult | null
  femaDisasters?: FemaDisasterHistory | null
  stateContext?: StateRiskContext
}

function prismaProfileToDto(
  p: Awaited<ReturnType<typeof prisma.riskProfile.findUniqueOrThrow>>,
  propertyId: string,
  enrichment?: EnrichmentData,
): PropertyRiskProfile {
  const now = new Date().toISOString()

  // Build rich detail arrays
  const floodDetails: string[] = [
    `Flood zone: ${p.floodZone ?? 'Unknown'}`,
    p.inSFHA
      ? 'Property is in a Special Flood Hazard Area (SFHA) — flood insurance mandatory for federally backed mortgages'
      : 'Property is not in a Special Flood Hazard Area',
  ]
  if (p.floodBaseElevation != null) {
    floodDetails.push(`Base Flood Elevation: ${p.floodBaseElevation} ft`)
  }
  if (p.floodAnnualChance != null) {
    floodDetails.push(`Estimated annual flood chance: ${p.floodAnnualChance.toFixed(1)}%`)
  }
  if (p.floodZone === 'D') {
    floodDetails.push('Zone D: Flood hazard undetermined — community not mapped by FEMA')
  }
  if (enrichment?.elevation != null) {
    floodDetails.push(`Property elevation: ${enrichment.elevation} ft (USGS 3DEP)`)
    if (enrichment.elevation < 15) {
      floodDetails.push('Low elevation increases vulnerability to flooding and storm surge')
    }
  }
  if (enrichment?.damData && enrichment.damData.nearbyHighHazardDams > 0) {
    floodDetails.push(`${enrichment.damData.nearbyHighHazardDams} high-hazard dam(s) within 25 miles`)
    if (enrichment.damData.nearestDamName) {
      floodDetails.push(`Nearest: ${enrichment.damData.nearestDamName} (${enrichment.damData.nearestDamDistance} mi, condition: ${enrichment.damData.nearestDamCondition ?? 'unknown'})`)
    }
  }
  if (enrichment?.sinkholeData?.inKarstArea) {
    floodDetails.push(`Located in karst terrain (${enrichment.sinkholeData.karstType ?? 'dissolution-prone geology'}) — sinkhole risk elevated`)
  }
  if (enrichment?.esriFloodHazard) {
    const esriZone = enrichment.esriFloodHazard.esriFloodZone
    if (esriZone) {
      floodDetails.push(`Esri USA Flood Hazard zone: ${esriZone}${enrichment.esriFloodHazard.esriZoneSubtype ? ` (${enrichment.esriFloodHazard.esriZoneSubtype})` : ''}`)
    }
  }
  if (enrichment?.esriLandslide?.susceptibility) {
    floodDetails.push(`Landslide susceptibility: ${enrichment.esriLandslide.susceptibility} (USGS via Esri)`)
  }

  const fireDetails: string[] = []
  if (p.fireHazardZone) fireDetails.push(`Fire hazard severity zone: ${p.fireHazardZone}`)
  else fireDetails.push('No state fire hazard zone designation')
  if (p.wildlandUrbanInterface) fireDetails.push('Located in Wildland-Urban Interface (WUI)')
  else fireDetails.push('Not in WUI')
  if (enrichment?.fireData?.wuiClass) {
    fireDetails.push(`WUI classification: ${enrichment.fireData.wuiClass}`)
  }
  if (enrichment?.fireData?.recentFireCount && enrichment.fireData.recentFireCount > 0) {
    fireDetails.push(`${enrichment.fireData.recentFireCount} historical wildfires within 5 miles`)
  }
  if (p.nearestFireStation != null) {
    fireDetails.push(`Nearest fire station: ${p.nearestFireStation} miles`)
  }
  if (enrichment?.fireData?.vegetationDensity) {
    fireDetails.push(`Surrounding vegetation density: ${enrichment.fireData.vegetationDensity}`)
  }
  if (enrichment?.fuelModel?.fuelDescription) {
    fireDetails.push(`LANDFIRE fuel model: ${enrichment.fuelModel.fuelDescription}`)
  }
  if (enrichment?.fireData?.esriWildfireHazardPotential) {
    fireDetails.push(`USDA Wildfire Hazard Potential: ${enrichment.fireData.esriWildfireHazardPotential} (Esri Living Atlas)`)
  }
  if (enrichment?.fireData?.esriBurningProbability != null) {
    fireDetails.push(`Annual burn probability: ${(enrichment.fireData.esriBurningProbability * 100).toFixed(4)}%`)
  }
  if (enrichment?.fireData?.esriFlameLength != null) {
    fireDetails.push(`Expected flame length: ${enrichment.fireData.esriFlameLength.toFixed(1)} ft`)
  }
  if (enrichment?.fireData?.esriDroughtLevel && enrichment.fireData.esriDroughtLevel !== 'None') {
    fireDetails.push(`Current drought: ${enrichment.fireData.esriDroughtLabel ?? enrichment.fireData.esriDroughtLevel} (US Drought Monitor via Esri)`)
  }

  const windDetails: string[] = []
  if (p.hurricaneRisk) {
    const sloshCat = enrichment?.windData?.sloshCategory
    if (sloshCat) {
      windDetails.push(`Hurricane surge zone: Category ${sloshCat} SLOSH model`)
    } else {
      windDetails.push('Located in hurricane-risk area')
    }
  }
  if (p.tornadoRisk) {
    const tornadoCount = enrichment?.windData?.historicalTornadoCount ?? 0
    windDetails.push(tornadoCount > 0
      ? `Tornado risk area — ${tornadoCount} historical events within 25 miles`
      : 'Tornado risk area based on state classification')
  }
  if (p.hailRisk) {
    const hailCount = enrichment?.windData?.historicalHailCount ?? 0
    windDetails.push(hailCount > 0
      ? `Hail risk area — ${hailCount} historical events within 25 miles`
      : 'Hail risk area based on state classification')
  }
  if (p.designWindSpeed) {
    windDetails.push(`ASCE 7 design wind speed: ${p.designWindSpeed} mph`)
  }
  const hurricaneCount = enrichment?.windData?.historicalHurricaneCount ?? 0
  if (hurricaneCount > 0) {
    windDetails.push(`${hurricaneCount} historical hurricane tracks within 75 miles`)
  }
  if (enrichment?.windData?.esriHurricaneMaxCategory != null) {
    windDetails.push(`Max historical hurricane category: ${enrichment.windData.esriHurricaneMaxCategory} (Esri IBTrACS)`)
  }
  if (enrichment?.windData?.esriHurricaneMostRecentYear != null) {
    windDetails.push(`Most recent hurricane: ${enrichment.windData.esriHurricaneMostRecentYear}`)
  }
  if (enrichment?.windData?.esriHurricaneStormNames && enrichment.windData.esriHurricaneStormNames.length > 0) {
    windDetails.push(`Notable storms: ${enrichment.windData.esriHurricaneStormNames.slice(0, 5).join(', ')}`)
  }
  if (windDetails.length === 0) {
    windDetails.push('Low wind hazard exposure')
  }

  const earthquakeDetails: string[] = []
  if (p.seismicZone) {
    earthquakeDetails.push(`Seismic design category: ${p.seismicZone}`)
  } else {
    earthquakeDetails.push('Seismic data unavailable')
  }
  if (enrichment?.earthquakeData?.ss != null) {
    earthquakeDetails.push(`Spectral acceleration (Ss): ${enrichment.earthquakeData.ss.toFixed(2)}g`)
  }
  if (enrichment?.earthquakeData?.pga != null) {
    earthquakeDetails.push(`Peak ground acceleration (PGA): ${enrichment.earthquakeData.pga.toFixed(3)}g`)
  }
  if (p.nearestFaultLine != null) {
    earthquakeDetails.push(`Nearest known fault: ${p.nearestFaultLine} miles (USGS Quaternary Fault Database)`)
  }
  if (enrichment?.earthquakeData?.soilType) {
    earthquakeDetails.push(`Soil classification: ${enrichment.earthquakeData.soilType}`)
  }
  if (enrichment?.earthquakeData?.liquefactionPotential) {
    earthquakeDetails.push(`Liquefaction potential: ${enrichment.earthquakeData.liquefactionPotential}`)
  }
  if (enrichment?.historicalEq && enrichment.historicalEq.count > 0) {
    earthquakeDetails.push(`${enrichment.historicalEq.count} earthquakes (M2.5+) within 50km in last 20 years`)
    if (enrichment.historicalEq.maxMagnitude != null) {
      earthquakeDetails.push(`Maximum recorded magnitude: M${enrichment.historicalEq.maxMagnitude.toFixed(1)}`)
    }
    if (enrichment.historicalEq.significantCount > 0) {
      earthquakeDetails.push(`${enrichment.historicalEq.significantCount} significant events (M4.0+)`)
    }
  }
  if (enrichment?.esriLandslide?.susceptibility) {
    earthquakeDetails.push(`Landslide susceptibility: ${enrichment.esriLandslide.susceptibility} (USGS via Esri Living Atlas)`)
    if (enrichment.esriLandslide.inclinationClass) {
      earthquakeDetails.push(`Slope classification: ${enrichment.esriLandslide.inclinationClass}`)
    }
  }

  const crimeDetails: string[] = [
    `Violent crime index: ${p.violentCrimeIndex} per 100k`,
    `Property crime index: ${p.propertyCrimeIndex} per 100k`,
  ]
  if (p.nationalAvgDiff !== 0) {
    const direction = p.nationalAvgDiff > 0 ? 'above' : 'below'
    crimeDetails.push(`${Math.abs(p.nationalAvgDiff).toFixed(0)}% ${direction} national average for violent crime`)
  }
  const crimeSource = enrichment?.crimeData?.dataSourceUsed
  if (crimeSource === 'CENSUS_ACS') {
    crimeDetails.push('Crime estimates derived from Census Bureau socioeconomic indicators (FBI data unavailable)')
  } else if (crimeSource === 'NONE') {
    crimeDetails.push('Crime data unavailable for this area')
  }
  if (enrichment?.crimeData?.esriSviRating) {
    crimeDetails.push(`CDC Social Vulnerability Index: ${enrichment.crimeData.esriSviRating} (${enrichment.crimeData.esriSviOverall?.toFixed(3) ?? 'N/A'}) via Esri`)
  }
  if (enrichment?.esriSvi?.overallSvi != null) {
    if (!enrichment?.crimeData?.esriSviRating) {
      crimeDetails.push(`CDC Social Vulnerability Index: ${enrichment.esriSvi.sviRating ?? 'N/A'} (${enrichment.esriSvi.overallSvi.toFixed(3)}) via Esri`)
    }
    if (enrichment.esriSvi.socioeconomicSvi != null) {
      crimeDetails.push(`Socioeconomic vulnerability: ${enrichment.esriSvi.socioeconomicSvi.toFixed(3)} (0=lowest, 1=highest)`)
    }
  }
  if (enrichment?.superfundData && enrichment.superfundData.nearbySites > 0) {
    crimeDetails.push(`${enrichment.superfundData.nearbySites} EPA Superfund/SEMS site(s) within 3 miles`)
    if (enrichment.superfundData.nearestSiteName) {
      crimeDetails.push(`Nearest: ${enrichment.superfundData.nearestSiteName} (${enrichment.superfundData.nearestSiteDistance} mi)`)
    }
  }

  // FEMA NRI enrichment — add to flood description if available
  const nri = enrichment?.nriData
  const nriSummary = nri?.riskRating
    ? `FEMA National Risk Index: ${nri.riskRating}` +
      (nri.expectedAnnualLoss != null ? ` (Expected Annual Loss: $${nri.expectedAnnualLoss.toLocaleString()})` : '')
    : null

  return {
    propertyId,
    overallRiskLevel: p.overallRiskLevel as RiskLevel,
    overallRiskScore: p.overallRiskScore,
    flood: {
      level: p.floodRiskLevel as RiskLevel,
      score: p.floodRiskScore,
      trend: 'STABLE' as RiskTrend,
      description: 'Flood risk based on FEMA NFHL, Esri USA Flood Hazard, OpenFEMA claims, USGS elevation, and dam hazard data',
      details: nriSummary ? [...floodDetails, nriSummary] : floodDetails,
      dataSource: 'FEMA NFHL / Esri Living Atlas / OpenFEMA / NOAA SLR / USGS 3DEP / NID / FEMA NRI',
      lastUpdated: now,
      floodZone: p.floodZone ?? 'UNKNOWN',
      firmPanelId: p.floodFirmPanelId,
      baseFloodElevation: p.floodBaseElevation,
      inSpecialFloodHazardArea: p.inSFHA,
      annualChanceOfFlooding: p.floodAnnualChance,
    },
    fire: {
      level: p.fireRiskLevel as RiskLevel,
      score: p.fireRiskScore,
      trend: 'STABLE' as RiskTrend,
      description: 'Wildfire risk based on Cal Fire FHSZ, USFS WUI, USDA Wildfire Risk (Esri), NIFC fire history, drought monitor, and vegetation analysis',
      details: fireDetails,
      dataSource: 'Cal Fire / USFS WUI / USDA WRC (Esri) / NIFC / HIFLD / USGS NLCD / LANDFIRE / US Drought Monitor (Esri)',
      lastUpdated: now,
      fireHazardSeverityZone: p.fireHazardZone,
      wildlandUrbanInterface: p.wildlandUrbanInterface,
      nearestFireStation: p.nearestFireStation,
      vegetationDensity: enrichment?.fireData?.vegetationDensity ?? null,
    },
    wind: {
      level: p.windRiskLevel as RiskLevel,
      score: p.windRiskScore,
      trend: 'STABLE' as RiskTrend,
      description: 'Wind hazard based on ASCE 7 design wind speeds, NOAA SLOSH hurricane surge, Esri IBTrACS hurricane tracks, and SPC storm history',
      details: windDetails,
      dataSource: 'ASCE 7 / NOAA SLOSH / Esri IBTrACS / NOAA Hurricane Tracks / SPC SVRGIS',
      lastUpdated: now,
      designWindSpeed: p.designWindSpeed,
      hurricaneRisk: p.hurricaneRisk,
      tornadoRisk: p.tornadoRisk,
      hailRisk: p.hailRisk,
    },
    earthquake: {
      level: p.earthquakeRiskLevel as RiskLevel,
      score: p.earthquakeRiskScore,
      trend: 'STABLE' as RiskTrend,
      description: 'Seismic risk based on USGS Design Maps (ASCE 7-22), Quaternary Fault Database, and USGS Landslide data (Esri)',
      details: earthquakeDetails,
      dataSource: 'USGS Design Maps / USGS QFaults / USGS Earthquake Catalog / USGS Landslide (Esri)',
      lastUpdated: now,
      seismicZone: p.seismicZone,
      nearestFaultLine: p.nearestFaultLine,
      soilType: enrichment?.earthquakeData?.soilType ?? null,
      liquefactionPotential: (enrichment?.earthquakeData?.liquefactionPotential as RiskLevel) ?? null,
    },
    crime: {
      level: p.crimeRiskLevel as RiskLevel,
      score: p.crimeRiskScore,
      trend: 'STABLE' as RiskTrend,
      description: 'Crime index based on FBI Crime Data Explorer, Census Bureau ACS indicators, and CDC Social Vulnerability Index (Esri)',
      details: crimeDetails,
      dataSource: crimeSource === 'CENSUS_ACS' ? 'Census Bureau ACS / CDC SVI (Esri)' : crimeSource === 'FBI_CDE' ? 'FBI UCR / CDE / CDC SVI (Esri)' : 'FBI UCR / CDC SVI (Esri)',
      lastUpdated: now,
      violentCrimeIndex: p.violentCrimeIndex,
      propertyCrimeIndex: p.propertyCrimeIndex,
      nationalAverageDiff: p.nationalAvgDiff,
    },
    stateContext: enrichment?.stateContext,
    generatedAt: p.generatedAt.toISOString(),
    cacheTtlSeconds: RISK_CACHE_TTL_SECONDS,
  }
}
