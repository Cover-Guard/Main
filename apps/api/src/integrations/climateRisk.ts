/**
 * Climate projection risk — heat & drought.
 *
 * - Heat: estimated from latitude + state baseline. NOAA/NWS does not publish
 *   a free per-coordinate climate-extremes API, so we use a coarse but
 *   defensible model (state averages + latitude scaling). This is good enough
 *   for triage / risk-flagging; high-accuracy clients should layer in a
 *   commercial climate dataset.
 * - Drought: pulled live from the US Drought Monitor (Esri-hosted) via the
 *   existing `fetchEsriDroughtMonitor` integration; subsidence (expansive-clay
 *   foundation risk) is layered on top from a state lookup.
 */

import type { RiskLevel } from '@coverguard/shared'

// ─── Heat ───────────────────────────────────────────────────────────────────

/** Average days/year ≥100°F by state (climatology, ~30-year normal). */
const STATE_EXTREME_HEAT_DAYS: Record<string, number> = {
  AZ: 110, NV: 95, CA: 35, TX: 80, OK: 50, KS: 35, NM: 45,
  FL: 12, LA: 35, MS: 30, AL: 28, GA: 22, SC: 20, NC: 12,
  AR: 30, TN: 18, KY: 12, MO: 22, VA: 8, WV: 4,
  IL: 12, IN: 10, OH: 6, MI: 4, WI: 4, MN: 4, IA: 12, NE: 18, ND: 6, SD: 10,
  CO: 18, UT: 30, WY: 8, MT: 6, ID: 12,
  WA: 4, OR: 6,
  PA: 4, NY: 2, NJ: 4, CT: 2, MA: 2, RI: 2, NH: 1, VT: 1, ME: 1, DE: 6, MD: 6,
  AK: 0, HI: 0,
}

const HOT_REGION_STATES = new Set(['AZ', 'NV', 'TX', 'OK', 'NM', 'CA', 'KS', 'LA', 'MS', 'AL', 'GA', 'SC', 'AR', 'FL'])

/**
 * Subsidence (expansive-clay foundation cracking) risk by state — informed by
 * USGS swelling-clay susceptibility maps.
 */
const STATE_SUBSIDENCE_RISK: Record<string, RiskLevel> = {
  TX: 'HIGH', OK: 'HIGH', MS: 'HIGH', LA: 'HIGH', AL: 'MODERATE',
  CO: 'HIGH', WY: 'MODERATE', MT: 'MODERATE', ND: 'MODERATE', SD: 'MODERATE',
  KS: 'MODERATE', NE: 'MODERATE', IA: 'MODERATE', MO: 'MODERATE',
  CA: 'MODERATE', NV: 'MODERATE', UT: 'MODERATE', AZ: 'MODERATE', NM: 'MODERATE',
  AR: 'MODERATE', TN: 'MODERATE', KY: 'LOW', GA: 'LOW',
}

export interface HeatRiskComputed {
  score: number
  level: RiskLevel
  extremeHeatDays: number
  projectedHeatDays2050: number | null
  urbanHeatIslandEffect: number | null
  coolingInfrastructureDeficit: boolean
}

/**
 * Map FEMA NRI HWAV_RISKR rating string → (score, level). FEMA ratings are
 * the authoritative census-tract source — use them when available.
 */
function nriHeatRatingToScore(rating: string | null | undefined): { score: number; level: RiskLevel } | null {
  if (!rating) return null
  const r = rating.trim().toLowerCase()
  if (r === 'very high') return { score: 90, level: 'EXTREME' }
  if (r === 'relatively high') return { score: 72, level: 'VERY_HIGH' }
  if (r === 'relatively moderate') return { score: 55, level: 'HIGH' }
  if (r === 'relatively low') return { score: 30, level: 'MODERATE' }
  if (r === 'very low') return { score: 12, level: 'LOW' }
  if (r === 'no rating' || r === 'not applicable' || r === 'insufficient data') return null
  return null
}

/**
 * Compute heat risk. Prefers FEMA NRI Heat Wave risk rating (HWAV_RISKR)
 * when available — the census-tract-level authoritative source. Falls back
 * to a state-climatology × latitude estimate when NRI data is missing
 * (triage quality, not property-level).
 */
export function computeHeatRisk(
  state: string | null | undefined,
  lat: number,
  nriHwavRisk: string | null = null,
): HeatRiskComputed {
  const code = (state ?? '').toUpperCase()
  const stateDays = STATE_EXTREME_HEAT_DAYS[code] ?? 8

  // Latitude adjustment: south of 32°N = +20%, 32–37 = baseline, north of 41 = −20%
  const latFactor =
    lat <= 32 ? 1.2 :
    lat <= 37 ? 1.0 :
    lat <= 41 ? 0.85 : 0.65
  const extremeHeatDays = Math.round(stateDays * latFactor)

  // Primary: NRI HWAV_RISKR when provided
  const nriScore = nriHeatRatingToScore(nriHwavRisk)

  // Fallback: climatology-based estimate. 0 days → 5; 30 days → 50; 100+ days → 95
  const computedScore = Math.max(5, Math.min(95, Math.round(extremeHeatDays * 0.9 + 5)))
  const computedLevel: RiskLevel =
    computedScore >= 80 ? 'EXTREME' :
    computedScore >= 65 ? 'VERY_HIGH' :
    computedScore >= 45 ? 'HIGH' :
    computedScore >= 25 ? 'MODERATE' : 'LOW'

  const score = nriScore?.score ?? computedScore
  const level = nriScore?.level ?? computedLevel

  // Projection: hot regions warm faster (RCP 4.5 / SSP2-4.5 ≈ +50% extreme days by 2050)
  const projectionMultiplier = HOT_REGION_STATES.has(code) ? 1.5 : 1.3
  const projectedHeatDays2050 = extremeHeatDays > 0
    ? Math.round(extremeHeatDays * projectionMultiplier)
    : null

  return {
    score,
    level,
    extremeHeatDays,
    projectedHeatDays2050,
    // Urban-heat-island intensity needs land-cover analysis we don't have here;
    // leave null so the UI doesn't display a misleading number.
    urbanHeatIslandEffect: null,
    // Same caveat for cooling-infra deficit — needs utility/census data.
    coolingInfrastructureDeficit: false,
  }
}

// ─── Drought ────────────────────────────────────────────────────────────────

/** Projected change in annual precipitation by 2050 (%, from IPCC AR6 regional). */
const STATE_PRECIP_CHANGE_2050: Record<string, number> = {
  AZ: -10, NV: -10, NM: -10, UT: -8, CA: -7, CO: -5, TX: -5,
  OK: -3, KS: -3, NE: -2, WY: -3, MT: -2, ID: -2, OR: -2, WA: -1,
  // Northeast / Midwest / South generally see modest precipitation increases
  ME: 7, NH: 7, VT: 7, NY: 6, MA: 6, CT: 5, RI: 5, NJ: 5, PA: 5,
  OH: 4, MI: 4, WI: 4, MN: 4, IL: 4, IN: 4, IA: 3,
  AL: 2, GA: 2, FL: 1, MS: 2, LA: 2, AR: 2, TN: 2, KY: 3, MO: 3,
  NC: 3, SC: 2, VA: 4, WV: 4, MD: 4, DE: 4,
}

export interface DroughtRiskComputed {
  score: number
  level: RiskLevel
  palmerDroughtIndex: number | null
  droughtMonitorCategory: 'NONE' | 'D0' | 'D1' | 'D2' | 'D3' | 'D4'
  projectedPrecipitationChange2050: number | null
  subsidenceRisk: RiskLevel | null
}

/**
 * Compute drought risk from the live US Drought Monitor reading + state-level
 * subsidence and precipitation projections.
 *
 * @param state          two-letter state code
 * @param droughtLevel   `D0`-`D4` or `'None'` from `fetchEsriDroughtMonitor`
 * @param droughtIntensity 0-5 from the Esri monitor (0 = none, 5 = exceptional)
 */
export function computeDroughtRisk(
  state: string | null | undefined,
  droughtLevel: string | null,
  droughtIntensity: number,
): DroughtRiskComputed {
  const code = (state ?? '').toUpperCase()

  // Map Esri intensity (0–5) → drought monitor category. Esri returns 0 = D0,
  // 1 = D1, ... 4 = D4 (with intensity = dm + 1, so 5 = D4 here too).
  let category: DroughtRiskComputed['droughtMonitorCategory'] = 'NONE'
  if (droughtLevel === 'D0' || droughtIntensity === 1) category = 'D0'
  else if (droughtLevel === 'D1' || droughtIntensity === 2) category = 'D1'
  else if (droughtLevel === 'D2' || droughtIntensity === 3) category = 'D2'
  else if (droughtLevel === 'D3' || droughtIntensity === 4) category = 'D3'
  else if (droughtLevel === 'D4' || droughtIntensity >= 5) category = 'D4'

  // Map current monitor category to base score
  const baseScore =
    category === 'D4' ? 90 :
    category === 'D3' ? 75 :
    category === 'D2' ? 55 :
    category === 'D1' ? 35 :
    category === 'D0' ? 20 : 5

  // Precipitation projection adds chronic-risk weight (drying climates)
  const precipChange = STATE_PRECIP_CHANGE_2050[code] ?? 0
  const projectionBoost = precipChange < 0 ? Math.min(15, Math.abs(precipChange) * 1.5) : 0

  // Subsidence (expansive clay) adds property-damage tail risk
  const subsidence = STATE_SUBSIDENCE_RISK[code] ?? null
  const subsidenceBoost = subsidence === 'HIGH' ? 8 : subsidence === 'MODERATE' ? 4 : 0

  const score = Math.max(5, Math.min(95, baseScore + projectionBoost + subsidenceBoost))
  const level: RiskLevel =
    score >= 80 ? 'EXTREME' :
    score >= 65 ? 'VERY_HIGH' :
    score >= 45 ? 'HIGH' :
    score >= 25 ? 'MODERATE' : 'LOW'

  // Palmer Drought Severity Index: rough mapping from monitor category.
  // PDSI: −4 = extreme drought, 0 = normal, +4 = extreme wet
  const palmerIndex =
    category === 'D4' ? -4.5 :
    category === 'D3' ? -3.5 :
    category === 'D2' ? -2.5 :
    category === 'D1' ? -1.5 :
    category === 'D0' ? -0.5 :
    droughtLevel == null ? null : 0

  return {
    score,
    level,
    palmerDroughtIndex: palmerIndex,
    droughtMonitorCategory: category,
    projectedPrecipitationChange2050: code in STATE_PRECIP_CHANGE_2050 ? precipChange : null,
    subsidenceRisk: subsidence,
  }
}
