/**
 * Insurability Service
 *
 * Derives an InsurabilityStatus from the property's risk profile.
 * Insurability reflects how difficult it will be to obtain coverage,
 * based on aggregated risk scores and state-specific market conditions.
 */

import type { InsurabilityStatus } from '@coverguard/shared'
import { INSURABILITY_CACHE_TTL_SECONDS } from '@coverguard/shared'
import { prisma } from '../utils/prisma'
import { insurabilityCache, insurabilityDeduplicator } from '../utils/cache'

export async function getInsurabilityStatus(propertyId: string, forceRefresh = false): Promise<InsurabilityStatus> {
  // L1 cache hit — no DB call needed
  if (!forceRefresh) {
    const l1 = insurabilityCache.get(propertyId)
    if (l1) return l1
  }

  // Deduplicate concurrent requests for the same property
  const dedupeKey = forceRefresh ? `${propertyId}:refresh` : propertyId
  return insurabilityDeduplicator.dedupe(dedupeKey, async () => {
    const property = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: {
        state: true,
        riskProfile: {
          select: {
            overallRiskScore: true, floodRiskScore: true, fireRiskScore: true,
            windRiskScore: true, earthquakeRiskScore: true, inSFHA: true,
            hurricaneRisk: true, wildlandUrbanInterface: true,
          },
        },
      },
    })

    const risk = property.riskProfile
    const overall = risk?.overallRiskScore ?? 25
    const flood = risk?.floodRiskScore ?? 20
    const fire = risk?.fireRiskScore ?? 20
    const wind = risk?.windRiskScore ?? 20
    const eq = risk?.earthquakeRiskScore ?? 10
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

    // Wind / Hurricane
    if (hurricaneRisk && wind > 60) {
      potentialIssues.push('Hurricane exposure — wind/storm coverage may be excluded from standard homeowners policy.')
      recommendedActions.push('Obtain a separate wind/hurricane policy or FAIR Plan coverage.')
    }

    // Earthquake
    if (eq > 70) {
      potentialIssues.push('High seismic risk — earthquake damage is not covered by standard homeowners policies.')
      recommendedActions.push('Obtain a separate earthquake policy or CEA coverage if in California.')
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

    const result: InsurabilityStatus = {
      propertyId,
      isInsurable,
      difficultyLevel,
      potentialIssues,
      recommendedActions,
    }

    insurabilityCache.set(propertyId, result, INSURABILITY_CACHE_TTL_SECONDS * 1000)
    return result
  })
}
