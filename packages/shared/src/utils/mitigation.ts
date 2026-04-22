import type {
  InsurabilityStatus,
  MitigationAction,
  MitigationPeril,
  MitigationPlan,
  MitigationSuggestion,
} from '../types/insurance'
import type { RiskLevel } from '../types/risk'
import { MITIGATION_CATALOG } from './mitigationCatalog'

/** Risk levels that justify recommending peril-specific mitigations. */
const ELEVATED_LEVELS: ReadonlySet<RiskLevel> = new Set<RiskLevel>([
  'MODERATE',
  'HIGH',
  'VERY_HIGH',
  'EXTREME',
])

/** How much worse the peril level, the higher the priority weight. */
const RISK_WEIGHT: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  VERY_HIGH: 3,
  EXTREME: 4,
}

export interface MitigationOptions {
  /** Max number of suggestions returned. Defaults to 3. */
  limit?: number
  /** Override the default catalog (useful for tests). */
  catalog?: MitigationAction[]
  /** Optional ISO timestamp — defaults to current time. */
  now?: string
}

/**
 * Build a ranked mitigation plan for a property.
 *
 * Algorithm:
 *   1. Filter the catalog to actions whose peril is elevated in this property's
 *      insurability profile (or `peril === 'general'`).
 *   2. Score each candidate by (risk weight × mid-point annual savings).
 *   3. Return the top N by payback-year ascending (fastest ROI first).
 *
 * Spec: docs/gtm/value-add-activities/06-mitigation-savings.md §5
 */
export function computeMitigationPlan(
  propertyId: string,
  insurability: InsurabilityStatus,
  baselineAnnualPremium: number,
  options: MitigationOptions = {},
): MitigationPlan {
  const { limit = 3, catalog = MITIGATION_CATALOG, now = new Date().toISOString() } = options

  const candidates = catalog.filter((action) => {
    if (action.peril === 'general') return true
    const level = perilLevel(insurability, action.peril)
    return ELEVATED_LEVELS.has(level)
  })

  const suggestions: MitigationSuggestion[] = candidates
    .map((action) => {
      const level = action.peril === 'general' ? 'MODERATE' : perilLevel(insurability, action.peril)
      const midDiscount = (action.estimatedDiscountMin + action.estimatedDiscountMax) / 2
      const midInvestment = (action.investmentCostMin + action.investmentCostMax) / 2
      const estimatedAnnualSavings = Math.round(baselineAnnualPremium * midDiscount)
      const paybackYears =
        estimatedAnnualSavings > 0
          ? Math.round((midInvestment / estimatedAnnualSavings) * 10) / 10
          : Number.POSITIVE_INFINITY
      return {
        action,
        estimatedAnnualSavings,
        estimatedInvestment: Math.round(midInvestment),
        paybackYears,
        rationale: rationaleFor(action, level),
        // sort keys (dropped before return)
        _score: (RISK_WEIGHT[level] || 1) * estimatedAnnualSavings,
        _payback: paybackYears,
      } as MitigationSuggestion & { _score: number; _payback: number }
    })
    // Highest (risk × savings) first; break ties on shorter payback.
    .sort((a, b) => b._score - a._score || a._payback - b._payback)
    .slice(0, limit)
    .map(({ _score, _payback, ...rest }) => {
      void _score
      void _payback
      return rest
    })

  const totalPotentialAnnualSavings = suggestions.reduce(
    (sum, s) => sum + s.estimatedAnnualSavings,
    0,
  )

  return {
    propertyId,
    baselineAnnualPremium,
    suggestions,
    totalPotentialAnnualSavings,
    disclaimer:
      'Estimates only. Actual premium reduction depends on carrier underwriting, inspection, and state filings. Mitigation work should be verified by a qualified contractor.',
    generatedAt: now,
  }
}

function perilLevel(insurability: InsurabilityStatus, peril: MitigationPeril): RiskLevel {
  if (peril === 'general') return 'MODERATE'
  const score = insurability.categoryScores[peril]
  return score ? score.level : 'LOW'
}

function rationaleFor(action: MitigationAction, level: RiskLevel): string {
  if (action.peril === 'general') {
    return 'Broad-coverage mitigation that qualifies for discounts with most carriers.'
  }
  const perilLabel =
    action.peril.charAt(0).toUpperCase() + action.peril.slice(1)
  if (level === 'LOW') {
    return `${perilLabel} exposure is modest — this is a low-lift upgrade.`
  }
  if (level === 'MODERATE') {
    return `${perilLabel} exposure is moderate — carriers frequently offer this credit.`
  }
  return `${perilLabel} exposure is elevated on this property — this is often required for bind.`
}
