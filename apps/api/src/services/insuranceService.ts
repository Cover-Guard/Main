import { prisma } from '../utils/prisma'
import { insuranceCache, insuranceDeduplicator } from '../utils/cache'
import type { InsuranceCostEstimate } from '@coverguard/shared'
import { INSURANCE_ESTIMATE_CACHE_TTL_SECONDS } from '@coverguard/shared'
import { ConfidenceLevel } from '../generated/prisma/client'

interface InsuranceInputs {
  propertyId: string
  estimatedValue: number
  state: string
  yearBuilt: number
  squareFeet: number
  floodRiskScore: number
  fireRiskScore: number
  windRiskScore: number
  earthquakeRiskScore: number
  crimeRiskScore: number
  hurricaneRisk: boolean
  tornadoRisk: boolean
  hailRisk: boolean
  inSFHA: boolean
  wildlandUrbanInterface: boolean
  floodZone: string | null
  seismicZone: string | null
  designWindSpeed: number | null
  overallRiskScore: number
}

// ─── State premium multipliers (based on NAIC average premium data) ──────────

const STATE_MULTIPLIERS: Record<string, number> = {
  FL: 3.10, LA: 2.40, TX: 2.00, OK: 2.00, KS: 1.80, MS: 1.70, AR: 1.60,
  AL: 1.50, SC: 1.40, NC: 1.30, NE: 1.25, MO: 1.20, GA: 1.15, TN: 1.12,
  KY: 1.10, CT: 1.08, MA: 1.05, NJ: 1.05, NY: 1.05, RI: 1.02,
  SD: 1.00, ND: 1.00, MN: 0.95, WI: 0.95, MI: 0.95, PA: 0.95,
  CO: 0.90, AZ: 0.88, NM: 0.88, UT: 0.85, ID: 0.85,
  OR: 0.82, WA: 0.78, HI: 0.75, VT: 0.75, NH: 0.75, ME: 0.78,
  CA: 1.10, // CA is avg+ due to wildfire exposure
  // Previously missing states (NAIC avg premium data)
  AK: 1.15, WV: 1.10, NV: 0.90, IA: 1.05, IN: 1.00,
  OH: 0.98, IL: 1.02, DE: 1.00, VA: 0.95, MD: 1.05,
  WY: 0.90, DC: 1.10, MT: 0.92,
}

function computeHomeownersPremium(inputs: InsuranceInputs): {
  low: number
  high: number
  avg: number
} {
  // National average homeowners premium: ~$2,270/yr for ~$300k dwelling (NAIC 2023)
  // This translates to roughly $7.56 per $1,000 of coverage
  let baseRate = 7.56 // per $1,000 of insured value

  baseRate *= STATE_MULTIPLIERS[inputs.state] ?? 1.0

  // Building age factor
  if (inputs.yearBuilt < 1960) baseRate *= 1.35
  else if (inputs.yearBuilt < 1970) baseRate *= 1.25
  else if (inputs.yearBuilt < 1990) baseRate *= 1.10
  else if (inputs.yearBuilt >= 2010) baseRate *= 0.95

  // Fire risk factor
  if (inputs.fireRiskScore > 80) baseRate *= 1.50
  else if (inputs.fireRiskScore > 70) baseRate *= 1.40
  else if (inputs.fireRiskScore > 50) baseRate *= 1.20

  // Wind risk factor
  if (inputs.windRiskScore > 80) baseRate *= 1.40
  else if (inputs.windRiskScore > 70) baseRate *= 1.30
  else if (inputs.windRiskScore > 50) baseRate *= 1.10

  // Crime risk factor
  if (inputs.crimeRiskScore > 70) baseRate *= 1.15
  else if (inputs.crimeRiskScore > 50) baseRate *= 1.08

  // Square footage adjustment (larger homes cost more to insure)
  if (inputs.squareFeet > 3000) baseRate *= 1.10
  else if (inputs.squareFeet < 1200) baseRate *= 0.92

  const insuredValue = inputs.estimatedValue * 0.8
  const avg = Math.round((baseRate / 1000) * insuredValue)
  return { low: Math.round(avg * 0.75), high: Math.round(avg * 1.35), avg }
}

function computeFloodPremium(inputs: InsuranceInputs): {
  low: number
  high: number
  avg: number
} | null {
  if (!inputs.inSFHA && inputs.floodRiskScore < 30) return null

  const buildingCoverage = Math.min(inputs.estimatedValue * 0.8, 250_000)
  const contentCoverage = Math.min(inputs.estimatedValue * 0.3, 100_000)

  // NFIP Risk Rating 2.0 considers building characteristics + flood frequency
  let base: number
  if (inputs.inSFHA && inputs.floodZone?.startsWith('V')) {
    base = 3_200 // Coastal V zones are most expensive
  } else if (inputs.inSFHA) {
    base = 1_400
  } else {
    base = 600 // Preferred Risk Policy range
  }

  const scoreMult = 1 + (inputs.floodRiskScore / 100) * 1.5
  // NFIP minimum premium is ~$611/yr (Preferred Risk) or higher; apply floor
  // Coverage factor: weighted sum of building (70%) and contents (30%) coverage ratios
  const coverageFactor = 0.7 * (buildingCoverage / 250_000) + 0.3 * (contentCoverage / 100_000)
  const raw = base * scoreMult * coverageFactor
  const avg = Math.max(Math.round(raw), inputs.inSFHA ? 611 : 285)
  return { low: Math.round(avg * 0.6), high: Math.round(avg * 1.8), avg }
}

function computeWindPremium(inputs: InsuranceInputs): {
  low: number
  high: number
  avg: number
} | null {
  if (!inputs.hurricaneRisk && !inputs.tornadoRisk && inputs.windRiskScore < 50) return null

  const dwellingValue = inputs.estimatedValue * 0.8

  // Different base rates for hurricane vs tornado wind coverage
  let base: number
  if (inputs.hurricaneRisk) {
    base = dwellingValue * 0.005
    // High design wind speed states
    if (inputs.designWindSpeed && inputs.designWindSpeed > 150) base *= 1.3
  } else if (inputs.tornadoRisk) {
    base = dwellingValue * 0.003
  } else {
    base = dwellingValue * 0.002
  }

  const avg = Math.round(base * (1 + inputs.windRiskScore / 200))
  return { low: Math.round(avg * 0.7), high: Math.round(avg * 1.4), avg }
}

function computeEarthquakePremium(inputs: InsuranceInputs): {
  low: number
  high: number
  avg: number
} | null {
  if (inputs.earthquakeRiskScore < 40) return null

  const dwellingValue = inputs.estimatedValue * 0.8

  // CEA rates vary by seismic zone
  let baseRate: number
  if (inputs.seismicZone === 'D') baseRate = 0.005
  else if (inputs.seismicZone === 'C') baseRate = 0.003
  else baseRate = 0.002

  const base = dwellingValue * baseRate
  const avg = Math.round(base * (1 + inputs.earthquakeRiskScore / 150))
  return { low: Math.round(avg * 0.6), high: Math.round(avg * 1.5), avg }
}

function computeFirePremium(inputs: InsuranceInputs): {
  low: number
  high: number
  avg: number
} | null {
  if (inputs.fireRiskScore < 55) return null

  const dwellingValue = inputs.estimatedValue * 0.8

  // WUI properties face much higher fire insurance costs
  let baseRate = 0.004
  if (inputs.wildlandUrbanInterface) baseRate = 0.006
  if (inputs.fireRiskScore > 80) baseRate *= 1.5

  const base = dwellingValue * baseRate
  const avg = Math.round(base * (1 + inputs.fireRiskScore / 200))
  return { low: Math.round(avg * 0.65), high: Math.round(avg * 1.4), avg }
}

// ─── Key risk factors and confidence ─────────────────────────────────────────

function buildKeyRiskFactors(inputs: InsuranceInputs): string[] {
  const factors: string[] = []

  if (inputs.inSFHA) {
    factors.push('Property is in a FEMA Special Flood Hazard Area — flood insurance required')
  } else if (inputs.floodRiskScore > 50) {
    factors.push('Elevated flood risk may increase insurance costs')
  }

  if (inputs.wildlandUrbanInterface) {
    factors.push('Wildland-Urban Interface location — many carriers restricting coverage')
  } else if (inputs.fireRiskScore > 70) {
    factors.push('High wildfire risk zone — expect premium surcharges')
  }

  if (inputs.hurricaneRisk && inputs.windRiskScore > 60) {
    factors.push('Hurricane exposure — wind coverage may be separate policy')
  } else if (inputs.tornadoRisk && inputs.windRiskScore > 50) {
    factors.push('Tornado corridor — higher wind/hail deductibles likely')
  }

  if (inputs.earthquakeRiskScore > 55) {
    factors.push('Significant seismic risk — separate earthquake policy recommended')
  }

  if (inputs.crimeRiskScore > 60) {
    factors.push('Above-average crime rate may affect theft/liability premiums')
  }

  if (inputs.yearBuilt < 1970) {
    factors.push('Older construction (pre-1970) increases replacement cost estimates')
  }

  if (inputs.overallRiskScore > 70) {
    factors.push('High overall risk profile — limited carrier availability expected')
  }

  return factors
}

function determineConfidence(inputs: InsuranceInputs, hasRealPropertyData: { estimatedValue: boolean; yearBuilt: boolean; squareFeet: boolean }): ConfidenceLevel {
  // Higher confidence when we have real data, not defaults
  let score = 0

  // Real property data (not defaults)
  if (hasRealPropertyData.estimatedValue) score++
  if (hasRealPropertyData.yearBuilt) score++
  if (hasRealPropertyData.squareFeet) score++

  // Risk data available (scores above baseline defaults indicate real data)
  if (inputs.floodRiskScore > 20) score++  // default is 20
  if (inputs.fireRiskScore > 20) score++   // default is 20
  if (inputs.windRiskScore > 20) score++   // default is 20
  if (inputs.earthquakeRiskScore > 10) score++ // default is 10
  if (inputs.crimeRiskScore > 0) score++

  if (score >= 6) return ConfidenceLevel.HIGH
  if (score >= 3) return ConfidenceLevel.MEDIUM
  return ConfidenceLevel.LOW
}

// ─── Main service function ───────────────────────────────────────────────────

export async function getOrComputeInsuranceEstimate(
  propertyId: string,
  forceRefresh = false,
): Promise<InsuranceCostEstimate> {
  // L1 cache hit
  if (!forceRefresh) {
    const l1 = insuranceCache.get(propertyId)
    if (l1) return l1
  }

  // Deduplicate concurrent requests
  const dedupeKey = forceRefresh ? `${propertyId}:refresh` : propertyId
  return insuranceDeduplicator.dedupe(dedupeKey, async () => {
    // Single query: fetch only the fields needed for premium computation
    const property = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: {
        estimatedValue: true, state: true, yearBuilt: true, squareFeet: true,
        riskProfile: {
          select: {
            floodRiskScore: true, fireRiskScore: true, windRiskScore: true,
            earthquakeRiskScore: true, crimeRiskScore: true, overallRiskScore: true,
            hurricaneRisk: true, tornadoRisk: true, hailRisk: true,
            inSFHA: true, wildlandUrbanInterface: true,
            floodZone: true, seismicZone: true, designWindSpeed: true,
          },
        },
        insuranceEstimate: true,
      },
    })

    // Return DB-cached estimate if still valid
    const cached = property.insuranceEstimate
    if (!forceRefresh && cached && cached.expiresAt > new Date()) {
      // Rebuild keyRiskFactors from stored risk data so they're not empty on cache hits
      const risk = property.riskProfile
      const cachedInputs: InsuranceInputs = {
        propertyId,
        estimatedValue: property.estimatedValue ?? 400_000,
        state: property.state,
        yearBuilt: property.yearBuilt ?? 1990,
        squareFeet: property.squareFeet ?? 1_800,
        floodRiskScore: risk?.floodRiskScore ?? 20,
        fireRiskScore: risk?.fireRiskScore ?? 20,
        windRiskScore: risk?.windRiskScore ?? 20,
        earthquakeRiskScore: risk?.earthquakeRiskScore ?? 10,
        crimeRiskScore: risk?.crimeRiskScore ?? 0,
        hurricaneRisk: risk?.hurricaneRisk ?? false,
        tornadoRisk: risk?.tornadoRisk ?? false,
        hailRisk: risk?.hailRisk ?? false,
        inSFHA: risk?.inSFHA ?? false,
        wildlandUrbanInterface: risk?.wildlandUrbanInterface ?? false,
        floodZone: risk?.floodZone ?? null,
        seismicZone: risk?.seismicZone ?? null,
        designWindSpeed: risk?.designWindSpeed ?? null,
        overallRiskScore: risk?.overallRiskScore ?? 25,
      }
      const dto = prismaEstimateToDto(cached, propertyId, buildKeyRiskFactors(cachedInputs))
      insuranceCache.set(propertyId, dto, cached.expiresAt.getTime() - Date.now())
      return dto
    }

    const risk = property.riskProfile
    const inputs: InsuranceInputs = {
      propertyId,
      estimatedValue: property.estimatedValue ?? 400_000,
      state: property.state,
      yearBuilt: property.yearBuilt ?? 1990,
      squareFeet: property.squareFeet ?? 1_800,
      floodRiskScore: risk?.floodRiskScore ?? 20,
      fireRiskScore: risk?.fireRiskScore ?? 20,
      windRiskScore: risk?.windRiskScore ?? 20,
      earthquakeRiskScore: risk?.earthquakeRiskScore ?? 10,
      crimeRiskScore: risk?.crimeRiskScore ?? 0,
      hurricaneRisk: risk?.hurricaneRisk ?? false,
      tornadoRisk: risk?.tornadoRisk ?? false,
      hailRisk: risk?.hailRisk ?? false,
      inSFHA: risk?.inSFHA ?? false,
      wildlandUrbanInterface: risk?.wildlandUrbanInterface ?? false,
      floodZone: risk?.floodZone ?? null,
      seismicZone: risk?.seismicZone ?? null,
      designWindSpeed: risk?.designWindSpeed ?? null,
      overallRiskScore: risk?.overallRiskScore ?? 25,
    }

    const homeowners = computeHomeownersPremium(inputs)
    const flood = computeFloodPremium(inputs)
    const wind = computeWindPremium(inputs)
    const earthquake = computeEarthquakePremium(inputs)
    const fire = computeFirePremium(inputs)

    const annualTotal = homeowners.avg + (flood?.avg ?? 0) + (wind?.avg ?? 0) + (earthquake?.avg ?? 0) + (fire?.avg ?? 0)
    const expiresAt = new Date(Date.now() + INSURANCE_ESTIMATE_CACHE_TTL_SECONDS * 1000)
    const confidenceLevel = determineConfidence(inputs, {
      estimatedValue: property.estimatedValue != null,
      yearBuilt: property.yearBuilt != null,
      squareFeet: property.squareFeet != null,
    })

    const estimateData = {
      estimatedAnnualTotal: annualTotal,
      estimatedMonthlyTotal: Math.round(annualTotal / 12),
      confidenceLevel,
      homeownersLow: homeowners.low,
      homeownersHigh: homeowners.high,
      homeownersAvg: homeowners.avg,
      floodRequired: inputs.inSFHA && !!flood,
      floodLow: flood?.low ?? null,
      floodHigh: flood?.high ?? null,
      floodAvg: flood?.avg ?? null,
      windRequired: !!wind,
      windLow: wind?.low ?? null,
      windHigh: wind?.high ?? null,
      windAvg: wind?.avg ?? null,
      earthquakeRequired: !!earthquake,
      earthquakeLow: earthquake?.low ?? null,
      earthquakeHigh: earthquake?.high ?? null,
      earthquakeAvg: earthquake?.avg ?? null,
      fireRequired: !!fire,
      fireLow: fire?.low ?? null,
      fireHigh: fire?.high ?? null,
      fireAvg: fire?.avg ?? null,
      expiresAt,
    }

    const estimate = await prisma.insuranceEstimate.upsert({
      where: { propertyId },
      update: estimateData,
      create: { propertyId, ...estimateData },
    })

    const dto = prismaEstimateToDto(estimate, propertyId, buildKeyRiskFactors(inputs))
    insuranceCache.set(propertyId, dto, INSURANCE_ESTIMATE_CACHE_TTL_SECONDS * 1000)
    return dto
  })
}

function prismaEstimateToDto(
  e: Awaited<ReturnType<typeof prisma.insuranceEstimate.findUniqueOrThrow>>,
  propertyId: string,
  riskFactors?: string[],
): InsuranceCostEstimate {
  const recommendations: string[] = [
    'Get quotes from at least 3 insurers for the most competitive rates',
    'Ask about bundling home and auto insurance for potential discounts',
  ]
  if (e.floodRequired) {
    recommendations.push('Compare NFIP flood insurance with private flood carriers (e.g., Neptune, Wright)')
  }
  if (e.fireRequired) {
    recommendations.push('Contact a surplus lines broker if admitted carriers decline fire coverage')
    recommendations.push('Consider FAIR Plan as a last-resort option for fire coverage')
  }
  if (e.windRequired) {
    recommendations.push('Evaluate separate wind/hurricane policy vs. all-perils coverage')
  }
  if (e.earthquakeRequired) {
    recommendations.push('Compare CEA earthquake insurance with private earthquake carriers')
  }
  recommendations.push('Review policy exclusions carefully — standard policies often exclude flood, earthquake, and wind')

  return {
    propertyId,
    estimatedAnnualTotal: e.estimatedAnnualTotal,
    estimatedMonthlyTotal: e.estimatedMonthlyTotal,
    confidenceLevel: e.confidenceLevel,
    coverages: [
      {
        type: 'HOMEOWNERS',
        required: true,
        averageAnnualPremium: e.homeownersAvg,
        lowEstimate: e.homeownersLow,
        highEstimate: e.homeownersHigh,
        notes: ['Required by most mortgage lenders', 'Covers dwelling, personal property, and liability'],
      },
      ...(e.floodAvg != null
        ? [
            {
              type: 'FLOOD' as const,
              required: e.floodRequired,
              averageAnnualPremium: e.floodAvg,
              lowEstimate: e.floodLow!,
              highEstimate: e.floodHigh!,
              notes: e.floodRequired
                ? [
                    'Required for federally backed mortgages in SFHA',
                    'Available through NFIP or private insurers',
                    'NFIP Risk Rating 2.0 pricing considers property-level flood risk',
                  ]
                : [
                    'Recommended based on elevated flood risk score',
                    'Available through NFIP or private insurers',
                    'Not legally required but strongly advised',
                  ],
            },
          ]
        : []),
      ...(e.windRequired && e.windAvg != null
        ? [
            {
              type: 'WIND_HURRICANE' as const,
              required: true,
              averageAnnualPremium: e.windAvg,
              lowEstimate: e.windLow!,
              highEstimate: e.windHigh!,
              notes: [
                'May be excluded from standard homeowners policy in high-risk areas',
                'Hurricane deductibles are typically 2-5% of dwelling coverage',
              ],
            },
          ]
        : []),
      ...(e.earthquakeRequired && e.earthquakeAvg != null
        ? [
            {
              type: 'EARTHQUAKE' as const,
              required: false,
              averageAnnualPremium: e.earthquakeAvg,
              lowEstimate: e.earthquakeLow!,
              highEstimate: e.earthquakeHigh!,
              notes: [
                'Not included in standard homeowners policy',
                'Available through CEA (California) or private insurers',
                'Typical deductibles: 10-20% of dwelling coverage',
              ],
            },
          ]
        : []),
      ...(e.fireRequired && e.fireAvg != null
        ? [
            {
              type: 'FIRE' as const,
              required: false,
              averageAnnualPremium: e.fireAvg,
              lowEstimate: e.fireLow!,
              highEstimate: e.fireHigh!,
              notes: [
                'Separate wildfire policy may be required in high-risk zones',
                'FAIR Plan available as insurer of last resort',
                'Defensible space improvements may reduce premiums',
              ],
            },
          ]
        : []),
    ],
    keyRiskFactors: riskFactors ?? [],
    recommendations,
    disclaimers: [
      'Estimates are based on publicly available risk data and may not reflect actual premium quotes.',
      'Actual insurance costs depend on property condition, claims history, credit score, and insurer pricing.',
      'This is not a binding insurance quote. Contact a licensed insurance agent for accurate pricing.',
      'Premium estimates reflect current market conditions and may change based on carrier availability.',
    ],
    generatedAt: e.generatedAt.toISOString(),
  }
}
