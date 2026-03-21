import { prisma } from '../utils/prisma'
import type { InsuranceCostEstimate } from '@coverguard/shared'
import { INSURANCE_ESTIMATE_CACHE_TTL_SECONDS } from '@coverguard/shared'
import { ConfidenceLevel } from '@prisma/client'

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
  hurricaneRisk: boolean
  inSFHA: boolean
}

function computeHomeownersPremium(inputs: InsuranceInputs): { low: number; high: number; avg: number } {
  // Base rate per $1000 of insured value (national average ~$1.11/yr per $1000)
  let baseRate = 1.11

  // State surcharges
  const stateMultipliers: Record<string, number> = {
    FL: 3.1, LA: 2.4, TX: 2.0, OK: 2.0, KS: 1.8, MS: 1.7, AR: 1.6, AL: 1.5,
    SC: 1.4, NC: 1.3, MO: 1.2, CO: 0.9, UT: 0.8, OR: 0.8, WA: 0.75,
  }
  baseRate *= stateMultipliers[inputs.state] ?? 1.0

  // Age surcharge
  if (inputs.yearBuilt < 1970) baseRate *= 1.25
  else if (inputs.yearBuilt < 1990) baseRate *= 1.10

  // Fire surcharge
  if (inputs.fireRiskScore > 70) baseRate *= 1.4
  else if (inputs.fireRiskScore > 50) baseRate *= 1.2

  // Wind surcharge
  if (inputs.windRiskScore > 70) baseRate *= 1.3

  const insuredValue = inputs.estimatedValue * 0.8 // dwelling coverage ≈ 80% of value
  const avg = Math.round((baseRate / 1000) * insuredValue)
  return { low: Math.round(avg * 0.75), high: Math.round(avg * 1.35), avg }
}

function computeFloodPremium(inSFHA: boolean, floodScore: number, estimatedValue: number): { low: number; high: number; avg: number } | null {
  if (!inSFHA && floodScore < 30) return null // Not required, low risk

  const contentValue = estimatedValue * 0.3
  const buildingCoverage = Math.min(estimatedValue * 0.8, 250000) // NFIP max $250k building
  const contentCoverageMax = Math.min(contentValue, 100000) // NFIP max $100k contents

  // NFIP average rate (simplified): ~$1,000/yr for building + contents in SFHA
  const base = inSFHA ? 1400 : 600
  const scoreMult = 1 + (floodScore / 100) * 1.5
  const avg = Math.round(base * scoreMult * (buildingCoverage / 250000) * (contentCoverageMax / 100000))

  return { low: Math.round(avg * 0.6), high: Math.round(avg * 1.8), avg }
}

function computeWindPremium(hurricaneRisk: boolean, windScore: number, estimatedValue: number): { low: number; high: number; avg: number } | null {
  if (!hurricaneRisk && windScore < 50) return null

  const dwellingValue = estimatedValue * 0.8
  const base = hurricaneRisk ? (dwellingValue * 0.005) : (dwellingValue * 0.002)
  const avg = Math.round(base * (1 + windScore / 200))
  return { low: Math.round(avg * 0.7), high: Math.round(avg * 1.4), avg }
}

export async function getOrComputeInsuranceEstimate(
  propertyId: string
): Promise<InsuranceCostEstimate> {
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
    include: { riskProfile: true },
  })

  // Return cached if valid
  const cached = await prisma.insuranceEstimate.findUnique({ where: { propertyId } })
  if (cached && cached.expiresAt > new Date()) {
    return prismaEstimateToDto(cached, propertyId)
  }

  const risk = property.riskProfile
  const inputs: InsuranceInputs = {
    propertyId,
    estimatedValue: property.estimatedValue ?? 400000,
    state: property.state,
    yearBuilt: property.yearBuilt ?? 1990,
    squareFeet: property.squareFeet ?? 1800,
    floodRiskScore: risk?.floodRiskScore ?? 20,
    fireRiskScore: risk?.fireRiskScore ?? 20,
    windRiskScore: risk?.windRiskScore ?? 20,
    earthquakeRiskScore: risk?.earthquakeRiskScore ?? 10,
    hurricaneRisk: risk?.hurricaneRisk ?? false,
    inSFHA: risk?.inSFHA ?? false,
  }

  const homeowners = computeHomeownersPremium(inputs)
  const flood = computeFloodPremium(inputs.inSFHA, inputs.floodRiskScore, inputs.estimatedValue)
  const wind = computeWindPremium(inputs.hurricaneRisk, inputs.windRiskScore, inputs.estimatedValue)

  const annualTotal = homeowners.avg + (flood?.avg ?? 0) + (wind?.avg ?? 0)

  const expiresAt = new Date(Date.now() + INSURANCE_ESTIMATE_CACHE_TTL_SECONDS * 1000)

  const estimate = await prisma.insuranceEstimate.upsert({
    where: { propertyId },
    update: {
      estimatedAnnualTotal: annualTotal,
      estimatedMonthlyTotal: Math.round(annualTotal / 12),
      confidenceLevel: ConfidenceLevel.MEDIUM,
      homeownersLow: homeowners.low,
      homeownersHigh: homeowners.high,
      homeownersAvg: homeowners.avg,
      floodRequired: !!flood,
      floodLow: flood?.low ?? null,
      floodHigh: flood?.high ?? null,
      floodAvg: flood?.avg ?? null,
      windRequired: !!wind,
      windLow: wind?.low ?? null,
      windHigh: wind?.high ?? null,
      windAvg: wind?.avg ?? null,
      expiresAt,
    },
    create: {
      propertyId,
      estimatedAnnualTotal: annualTotal,
      estimatedMonthlyTotal: Math.round(annualTotal / 12),
      confidenceLevel: ConfidenceLevel.MEDIUM,
      homeownersLow: homeowners.low,
      homeownersHigh: homeowners.high,
      homeownersAvg: homeowners.avg,
      floodRequired: !!flood,
      floodLow: flood?.low ?? null,
      floodHigh: flood?.high ?? null,
      floodAvg: flood?.avg ?? null,
      windRequired: !!wind,
      windLow: wind?.low ?? null,
      windHigh: wind?.high ?? null,
      windAvg: wind?.avg ?? null,
      expiresAt,
    },
  })

  return prismaEstimateToDto(estimate, propertyId)
}

function prismaEstimateToDto(
  e: Awaited<ReturnType<typeof prisma.insuranceEstimate.findUniqueOrThrow>>,
  propertyId: string
): InsuranceCostEstimate {
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
        notes: ['Required by most mortgage lenders'],
      },
      ...(e.floodRequired && e.floodAvg != null ? [{
        type: 'FLOOD' as const,
        required: true,
        averageAnnualPremium: e.floodAvg,
        lowEstimate: e.floodLow!,
        highEstimate: e.floodHigh!,
        notes: ['Required for federally backed mortgages in SFHA', 'Available through NFIP or private insurers'],
      }] : []),
      ...(e.windRequired && e.windAvg != null ? [{
        type: 'WIND_HURRICANE' as const,
        required: true,
        averageAnnualPremium: e.windAvg,
        lowEstimate: e.windLow!,
        highEstimate: e.windHigh!,
        notes: ['May be excluded from standard homeowners policy in high-risk areas'],
      }] : []),
    ],
    keyRiskFactors: [],
    recommendations: [
      'Get quotes from at least 3 insurers',
      'Ask about bundling discounts',
      e.floodRequired ? 'Consider private flood insurance as NFIP alternative' : '',
    ].filter(Boolean),
    disclaimers: [
      'Estimates are based on publicly available risk data and may not reflect actual premium quotes.',
      'Actual insurance costs depend on property condition, claims history, credit score, and insurer pricing.',
      'This is not a binding insurance quote.',
    ],
    generatedAt: e.generatedAt.toISOString(),
  }
}
