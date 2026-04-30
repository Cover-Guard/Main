/**
 * Insurability Service
 *
 * Derives an InsurabilityStatus from the property's risk profile.
 * Insurability reflects how difficult it will be to obtain coverage,
 * based on aggregated risk scores and state-specific market conditions.
 *
 * Also computes per-category and overall insurability difficulty scores
 * (0–100, higher = harder to insure) by factoring in both risk scores and
 * the number of actively-writing carriers for each peril in the property's market.
 */

import type { InsurabilityStatus, CategoryInsurabilityScore, InsurabilityScoresByCategory, CoverageType } from '@coverguard/shared'
import type { RiskLevel } from '@coverguard/shared'
import { INSURABILITY_CACHE_TTL_SECONDS, RISK_SCORE_THRESHOLDS } from '@coverguard/shared'
import { prisma } from '../utils/prisma'
import { insurabilityCache, insurabilityDeduplicator } from '../utils/cache'
import { getCarriersForProperty } from './carriersService'
import { getStateProfile } from '../data/stateRiskProfiles'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreToLevel(score: number): RiskLevel {
  if (score > RISK_SCORE_THRESHOLDS.VERY_HIGH) return 'EXTREME'
  if (score > RISK_SCORE_THRESHOLDS.HIGH)      return 'VERY_HIGH'
  if (score > RISK_SCORE_THRESHOLDS.MODERATE)  return 'HIGH'
  if (score > RISK_SCORE_THRESHOLDS.LOW)        return 'MODERATE'
  return 'LOW'
}

/**
 * Penalty applied to the raw risk score based on how many carriers actively
 * write policies for a given peril.  Fewer active carriers → harder to insure.
 */
function carrierCountPenalty(activeCount: number): number {
  if (activeCount === 0)  return 20
  if (activeCount <= 2)   return 12
  if (activeCount <= 4)   return 6
  if (activeCount <= 7)   return 0
  return -5 // 8+ active carriers = slight market advantage
}

function buildCategoryScore(
  riskScore: number,
  carriers: { writingStatus: string; coverageTypes: string[] }[],
  coverageType: CoverageType,
): CategoryInsurabilityScore {
  const activeCarrierCount = carriers.filter(
    (c) => c.writingStatus === 'ACTIVELY_WRITING' && c.coverageTypes.includes(coverageType),
  ).length
  const rawScore = riskScore + carrierCountPenalty(activeCarrierCount)
  const score = Math.min(100, Math.max(0, Math.round(rawScore)))
  return { score, level: scoreToLevel(score), activeCarrierCount }
}

// ─── Main service function ────────────────────────────────────────────────────

export async function getInsurabilityStatus(propertyId: string, forceRefresh = false): Promise<InsurabilityStatus> {
  // L1 cache hit — no DB call needed
  if (!forceRefresh) {
    const l1 = insurabilityCache.get(propertyId)
    if (l1) return l1
  }

  // Deduplicate concurrent requests for the same property
  const dedupeKey = forceRefresh ? `${propertyId}:refresh` : propertyId
  return insurabilityDeduplicator.dedupe(dedupeKey, async () => {
    const [property, carriersResult] = await Promise.all([
      prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: {
          state: true,
          riskProfile: {
            select: {
              overallRiskScore: true, floodRiskScore: true, fireRiskScore: true,
              windRiskScore: true, earthquakeRiskScore: true, crimeRiskScore: true,
              inSFHA: true, hurricaneRisk: true, wildlandUrbanInterface: true,
            },
          },
        },
      }),
      // Carrier data is used for insurability scores; the carriers service has its own
      // L1 cache + deduplicator so this is cheap when called from the /report endpoint.
      getCarriersForProperty(propertyId, forceRefresh),
    ])

    const risk = property.riskProfile
    const overall = risk?.overallRiskScore ?? 25
    const flood = risk?.floodRiskScore ?? 20
    const fire = risk?.fireRiskScore ?? 20
    const wind = risk?.windRiskScore ?? 20
    const eq = risk?.earthquakeRiskScore ?? 10
    const crime = risk?.crimeRiskScore ?? 20
    const inSFHA = risk?.inSFHA ?? false
    const hurricaneRisk = risk?.hurricaneRisk ?? false
    const wildlandUI = risk?.wildlandUrbanInterface ?? false

    const potentialIssues: string[] = []
    const recommendedActions: string[] = []

    // Flood
    if (inSFHA) {
      potentialIssues.push('Property is in a FEMA Special Flood Hazard Area (SFHA) — flood insurance required for federally backed mortgages.')
      recommendedActions.push('Obtain flood insurance through NFIP or a private carrier before placing an offer.')
    } else if (flood > 50) {
      potentialIssues.push('Elevated flood risk — flood insurance strongly recommended even if not in SFHA.')
    }

    // Fire
    if (wildlandUI) {
      potentialIssues.push('Property is in a Wildland-Urban Interface zone — many admitted carriers are non-renewing or not writing in this area.')
      recommendedActions.push('Obtain a fire insurance quote before bidding; coverage may require surplus lines carrier.')
    } else if (fire > 70) {
      potentialIssues.push('High fire risk score — expect elevated homeowners premiums or exclusions.')
    }

    // Resolve residual-market / state-backed programs once so wind & EQ
    // recommendations name the program that actually exists in this state.
    const stateProfile = getStateProfile(property.state ?? 'XX')
    const residualPrograms = stateProfile.compliance.residualMarketPrograms
    const fairPlan = residualPrograms.find((p) => p.type === 'FAIR_PLAN')
    const windPool = residualPrograms.find(
      (p) => p.type === 'BEACH_WIND_POOL' || p.type === 'STATE_BACKED'
    )
    const isCA = property.state === 'CA'

    // Wind / Hurricane
    if (hurricaneRisk && wind > 60) {
      potentialIssues.push('Hurricane exposure — wind/storm coverage may be excluded from standard homeowners policy.')
      const windFallback = windPool?.name ?? fairPlan?.name
      recommendedActions.push(
        windFallback
          ? `Obtain a separate wind/hurricane policy${windFallback ? `; ${windFallback} is available in ${stateProfile.stateName} if voluntary carriers decline.` : '.'}`
          : 'Obtain a separate wind/hurricane policy from a surplus-lines carrier if voluntary carriers decline.'
      )
    }

    // Earthquake
    if (eq > 70) {
      potentialIssues.push('High seismic risk — earthquake damage is not covered by standard homeowners policies.')
      recommendedActions.push(
        isCA
          ? 'Obtain a separate earthquake policy through the California Earthquake Authority (CEA) or a private earthquake carrier.'
          : 'Obtain a separate earthquake policy from a specialty earthquake carrier (e.g., Palomar, GeoVera).'
      )
    }

    // Overall market
    if (overall > 80) {
      potentialIssues.push('Very high overall risk score — limited admitted carrier options; surplus lines may be required.')
      recommendedActions.push('Work with a surplus lines broker to identify available coverage.')
    }

    if (recommendedActions.length === 0) {
      recommendedActions.push('Standard insurance should be readily available. Compare quotes from at least 3 carriers.')
    }

    // Derive difficulty level
    let difficultyLevel: InsurabilityStatus['difficultyLevel']
    let isInsurable = true

    if (overall >= 90) {
      difficultyLevel = 'EXTREME'
      isInsurable = false
    } else if (overall >= 75 || (wildlandUI && fire > 70)) {
      difficultyLevel = 'VERY_HIGH'
    } else if (overall >= 55 || inSFHA || hurricaneRisk) {
      difficultyLevel = 'HIGH'
    } else if (overall >= 35) {
      difficultyLevel = 'MODERATE'
    } else {
      difficultyLevel = 'LOW'
    }

    // ─── Insurability scores ─────────────────────────────────────────────────
    // Each category score = risk score adjusted by carrier market depth.
    // Crime uses HOMEOWNERS carriers as a proxy (no dedicated crime coverage type).
    const carriers = carriersResult.carriers

    const categoryScores: InsurabilityScoresByCategory = {
      flood:      buildCategoryScore(flood, carriers, 'FLOOD'),
      fire:       buildCategoryScore(fire,  carriers, 'FIRE'),
      wind:       buildCategoryScore(wind,  carriers, 'WIND_HURRICANE'),
      earthquake: buildCategoryScore(eq,    carriers, 'EARTHQUAKE'),
      crime:      buildCategoryScore(crime, carriers, 'HOMEOWNERS'),
    }

    // Overall weighted score (same weights as risk algorithm)
    const overallInsurabilityScore = Math.min(
      100,
      Math.round(
        categoryScores.flood.score      * 0.30 +
        categoryScores.fire.score       * 0.25 +
        categoryScores.wind.score       * 0.20 +
        categoryScores.earthquake.score * 0.15 +
        categoryScores.crime.score      * 0.10,
      ),
    )

    const result: InsurabilityStatus = {
      propertyId,
      isInsurable,
      difficultyLevel,
      potentialIssues,
      recommendedActions,
      overallInsurabilityScore,
      categoryScores,
    }

    insurabilityCache.set(propertyId, result, INSURABILITY_CACHE_TTL_SECONDS * 1000)
    return result
  })
}
