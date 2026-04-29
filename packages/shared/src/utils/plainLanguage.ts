/**
 * Plain-language helpers for the Buyer view of the property risk report.
 *
 * Spec: docs/enhancements/p0/02-buyer-friendly-report.md (PR #311 P0 #2).
 *
 * The agent view uses the technical labels in `formatters.ts`
 * (`riskLevelToLabel` returns "Very High", "Extreme", etc.). A buyer with no
 * insurance background does not know what "Extreme" means in this domain.
 * These helpers translate the same data into language a first-time
 * homebuyer can act on.
 */

import type { RiskLevel } from '../types/risk'
import type { CarrierWritingStatus } from '../types/insurance'

/** Which audience a property report is being rendered for. */
export type ReportViewMode = 'agent' | 'buyer'

/**
 * Buyer-friendly translation of a peril risk level. The agent label is "Very
 * High"; the buyer label is "Hard to insure" — same information, different
 * vocabulary.
 */
export function plainLanguageRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'LOW':       return 'Easy to insure'
    case 'MODERATE':  return 'Standard'
    case 'HIGH':      return 'Pricier than average'
    case 'VERY_HIGH': return 'Hard to insure'
    case 'EXTREME':   return 'Very hard to insure'
  }
}

/**
 * One-sentence headline a buyer can read in two seconds. Returned text is
 * always a complete sentence ending in punctuation.
 */
export function plainLanguageRiskHeadline(level: RiskLevel, peril: string): string {
  switch (level) {
    case 'LOW':
      return `${peril} risk here is low — most carriers will write this property without surcharges.`
    case 'MODERATE':
      return `${peril} risk here is roughly average — expect standard carrier appetite and pricing.`
    case 'HIGH':
      return `${peril} risk is elevated — premiums typically run above average and some carriers may decline.`
    case 'VERY_HIGH':
      return `${peril} risk is high enough that several major carriers won't write this property.`
    case 'EXTREME':
      return `${peril} risk is severe — coverage usually requires a specialty or last-resort carrier.`
  }
}

/**
 * Buyer-friendly translation of a carrier's writing status. Agents see
 * "ACTIVELY_WRITING"; buyers see "Open for new policies".
 */
export function plainLanguageCarrierStatus(status: CarrierWritingStatus): string {
  switch (status) {
    case 'ACTIVELY_WRITING': return 'Open for new policies'
    case 'LIMITED':          return 'Open with restrictions'
    case 'SURPLUS_LINES':    return 'Available through specialty (surplus-lines) markets'
    case 'NOT_WRITING':      return 'Not currently quoting this address'
  }
}

/**
 * Whether to surface a particular technical detail in the buyer view. We
 * deliberately suppress jargon that requires domain context (FEMA flood
 * zone codes, Cal Fire FHSZ tiers, ASCE wind-speed numerics).
 */
export function shouldShowTechnicalDetailInBuyerView(detailKey: string): boolean {
  const technical = new Set([
    'firmPanelId',
    'fireHazardSeverityZone',
    'designWindSpeed',
    'soilType',
    'liquefactionPotential',
    'amBestRating',
  ])
  return !technical.has(detailKey)
}
