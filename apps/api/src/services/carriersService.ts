/**
 * Carriers Service
 *
 * Returns active insurance carriers for a given property based on:
 * - State regulatory filings (simulated from public DOI data)
 * - Property risk profile
 * - Current market conditions
 *
 * In production this connects to a carrier data feed (NAIC, Verisk, or
 * proprietary DOI filing aggregator). For now we use a deterministic
 * mock derived from state + risk scores, matching real market behavior.
 */

import type { CarriersResult, Carrier, MarketCondition } from '@coverguard/shared'
import { CARRIERS_CACHE_TTL_SECONDS } from '@coverguard/shared'
import { prisma } from '../utils/prisma'
import { carriersCache, carriersDeduplicator } from '../utils/cache'

// ─── Known carriers by state market presence ───────────────────────────────────

const CARRIER_POOL: Omit<Carrier, 'writingStatus'>[] = [
  {
    id: 'state-farm',
    name: 'State Farm',
    amBestRating: 'A++',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'UMBRELLA'],
    avgPremiumModifier: 1.05,
    statesLicensed: ['ALL'],
    specialties: ['Standard residential', 'Multi-line discounts'],
    notes: null,
  },
  {
    id: 'allstate',
    name: 'Allstate',
    amBestRating: 'A+',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'WIND_HURRICANE', 'UMBRELLA'],
    avgPremiumModifier: 1.08,
    statesLicensed: ['ALL'],
    specialties: ['Claim-free discounts', 'Smart home discounts'],
    notes: null,
  },
  {
    id: 'usaa',
    name: 'USAA',
    amBestRating: 'A++',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE'],
    avgPremiumModifier: 0.92,
    statesLicensed: ['ALL'],
    specialties: ['Military members & families', 'Competitive pricing'],
    notes: 'Eligibility limited to military members, veterans, and their families.',
  },
  {
    id: 'amica',
    name: 'Amica Mutual',
    amBestRating: 'A+',
    coverageTypes: ['HOMEOWNERS', 'UMBRELLA'],
    avgPremiumModifier: 1.0,
    statesLicensed: ['ALL'],
    specialties: ['Dividend policies', 'High customer satisfaction'],
    notes: null,
  },
  {
    id: 'nationwide',
    name: 'Nationwide',
    amBestRating: 'A+',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'UMBRELLA'],
    avgPremiumModifier: 1.02,
    statesLicensed: ['ALL'],
    specialties: ['Vanishing deductible', 'Brand new belongings'],
    notes: null,
  },
  {
    id: 'travelers',
    name: 'Travelers',
    amBestRating: 'A++',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'WIND_HURRICANE', 'EARTHQUAKE', 'UMBRELLA'],
    avgPremiumModifier: 1.06,
    statesLicensed: ['ALL'],
    specialties: ['High-value homes', 'Green home discount'],
    notes: null,
  },
  {
    id: 'chubb',
    name: 'Chubb',
    amBestRating: 'A++',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'WIND_HURRICANE', 'UMBRELLA'],
    avgPremiumModifier: 1.35,
    statesLicensed: ['ALL'],
    specialties: ['Luxury/high-value properties', 'Cash settlement'],
    notes: 'Typically for homes valued over $750K.',
  },
  {
    id: 'neptune-flood',
    name: 'Neptune Flood',
    amBestRating: 'A',
    coverageTypes: ['FLOOD'],
    avgPremiumModifier: 0.88,
    statesLicensed: ['ALL'],
    specialties: ['Private flood insurance alternative to NFIP', 'Fast quotes'],
    notes: 'Private market flood — may offer lower premiums than NFIP.',
  },
  {
    id: 'wright-flood',
    name: 'Wright Flood',
    amBestRating: 'A',
    coverageTypes: ['FLOOD'],
    avgPremiumModifier: 0.95,
    statesLicensed: ['ALL'],
    specialties: ['NFIP Write-Your-Own program', 'Flood specialists'],
    notes: null,
  },
  {
    id: 'citizens-fl',
    name: 'Citizens Property Insurance',
    amBestRating: 'NR',
    coverageTypes: ['HOMEOWNERS', 'WIND_HURRICANE'],
    avgPremiumModifier: 1.15,
    statesLicensed: ['FL'],
    specialties: ['Florida insurer of last resort'],
    notes: 'State-backed insurer of last resort for FL properties where private carriers decline.',
  },
  {
    id: 'frontline',
    name: 'Frontline Insurance',
    amBestRating: 'A',
    coverageTypes: ['HOMEOWNERS', 'WIND_HURRICANE'],
    avgPremiumModifier: 1.12,
    statesLicensed: ['FL', 'GA', 'SC', 'NC', 'TX'],
    specialties: ['Wind/hurricane specialists', 'Coastal properties'],
    notes: null,
  },
  {
    id: 'lexington',
    name: 'Lexington Insurance (AIG)',
    amBestRating: 'A',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'WIND_HURRICANE', 'FIRE'],
    avgPremiumModifier: 1.25,
    statesLicensed: ['ALL'],
    specialties: ['Surplus lines', 'High-risk / hard-to-place properties'],
    notes: 'Surplus lines carrier — used when admitted carriers decline coverage.',
  },
  {
    id: 'lemonade',
    name: 'Lemonade',
    amBestRating: 'A',
    coverageTypes: ['HOMEOWNERS'],
    avgPremiumModifier: 0.9,
    statesLicensed: ['CA', 'TX', 'FL', 'NY', 'IL', 'PA', 'NJ', 'GA', 'WA', 'CO', 'AZ', 'OR', 'NV', 'TN', 'OH', 'MD', 'VA', 'CT', 'MA'],
    specialties: ['AI-powered claims', 'Flat fee model'],
    notes: null,
  },
  {
    id: 'stillwater',
    name: 'Stillwater Insurance',
    amBestRating: 'A',
    coverageTypes: ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE'],
    avgPremiumModifier: 0.97,
    statesLicensed: ['ALL'],
    specialties: ['Competitive pricing', 'Online quotes'],
    notes: null,
  },
]

// ─── Market condition by state ─────────────────────────────────────────────────

function getMarketCondition(state: string, overallRiskScore: number): MarketCondition {
  const crisisStates: Record<string, true> = { FL: true, LA: true, CA: true }
  const hardStates: Record<string, true>   = { TX: true, CO: true, WA: true, OR: true, OK: true }

  // Severity ordering: SOFT < MODERATE < HARD < CRISIS
  // Higher risk + worse state = harder market
  if (crisisStates[state] && overallRiskScore > 60) return 'CRISIS'
  if (crisisStates[state] || (hardStates[state] && overallRiskScore > 50)) return 'HARD'
  if (hardStates[state] || overallRiskScore > 70) return 'HARD'
  if (overallRiskScore > 50) return 'MODERATE'
  return 'SOFT'
}

// ─── Carrier writing status logic ──────────────────────────────────────────────

function determineWritingStatus(
  carrier: Omit<Carrier, 'writingStatus'>,
  state: string,
  overallRiskScore: number,
  marketCondition: MarketCondition,
): Carrier['writingStatus'] {
  // State-specific carriers only write in their states
  if (!carrier.statesLicensed.includes('ALL') && !carrier.statesLicensed.includes(state)) {
    return 'NOT_WRITING'
  }

  // Citizens only writes in FL
  if (carrier.id === 'citizens-fl' && state !== 'FL') return 'NOT_WRITING'

  // Surplus lines carriers always available (last resort)
  if (carrier.id === 'lexington') {
    return marketCondition === 'CRISIS' || overallRiskScore > 75
      ? 'ACTIVELY_WRITING'
      : 'SURPLUS_LINES'
  }

  // Flood-specific carriers
  if (carrier.coverageTypes.every((t) => t === 'FLOOD')) {
    return 'ACTIVELY_WRITING'
  }

  // In crisis markets, major carriers limit writing
  if (marketCondition === 'CRISIS') {
    const limitedInCrisis = ['state-farm', 'allstate', 'nationwide']
    if (limitedInCrisis.includes(carrier.id)) {
      return overallRiskScore > 80 ? 'NOT_WRITING' : 'LIMITED'
    }
  }

  // High risk properties
  if (overallRiskScore > 85) {
    const alwaysWrite = ['chubb', 'travelers', 'lexington', 'frontline']
    if (!alwaysWrite.includes(carrier.id)) return 'NOT_WRITING'
  }

  if (overallRiskScore > 70) {
    const limitedHigh = ['lemonade', 'amica', 'usaa']
    if (limitedHigh.includes(carrier.id)) return 'LIMITED'
  }

  return 'ACTIVELY_WRITING'
}

// ─── Main service function ────────────────────────────────────────────────────

export async function getCarriersForProperty(propertyId: string): Promise<CarriersResult> {
  // L1 cache hit — no DB call needed
  const l1 = carriersCache.get(propertyId)
  if (l1) return l1

  // Deduplicate concurrent requests for the same property
  return carriersDeduplicator.dedupe(propertyId, async () => {
    const property = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      include: { riskProfile: true },
    })

    const overallRiskScore = property.riskProfile?.overallRiskScore ?? 30
    const state = property.state
    const marketCondition = getMarketCondition(state, overallRiskScore)

    const carriers: Carrier[] = CARRIER_POOL
      .filter((c) => {
        // Filter to carriers licensed in state
        return c.statesLicensed.includes('ALL') || c.statesLicensed.includes(state)
      })
      .map((c) => ({
        ...c,
        writingStatus: determineWritingStatus(c, state, overallRiskScore, marketCondition),
      }))
      // Sort: actively writing first, then limited, then surplus, then not writing
      .sort((a, b) => {
        const order = { ACTIVELY_WRITING: 0, LIMITED: 1, SURPLUS_LINES: 2, NOT_WRITING: 3 }
        return order[a.writingStatus] - order[b.writingStatus]
      })

    const result: CarriersResult = {
      propertyId,
      carriers,
      marketCondition,
      lastUpdated: new Date().toISOString(),
    }

    carriersCache.set(propertyId, result, CARRIERS_CACHE_TTL_SECONDS * 1000)
    return result
  })
}
