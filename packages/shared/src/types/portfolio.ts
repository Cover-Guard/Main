/**
 * Types for the book-of-business / portfolio dashboard (P2 #16).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #16 â Book-of-Business /
 * Portfolio Dashboard").
 *
 * Today CoverGuard is a single-property tool. Producers, realtors, and
 * lenders eventually accumulate a *portfolio* of properties they care
 * about. This module ships the contract for the dashboard that surfaces
 * that portfolio â sourced from the AMS integration (P1 #6) and gated
 * on the alerts mechanics (P1 #8) for the daily change-alert batch.
 *
 * The dashboard has two halves:
 *
 *   1. The portfolio table â one row per in-force policy, with score +
 *      retention-risk indicator + filterable facets.
 *   2. The summary card â counts, average score, retention-risk
 *      breakdown, and the day-over-day delta (the P1 #8 dependency).
 *
 * Both are computed from the same `PortfolioPolicy[]` so the dashboard
 * can repaint instantly when filters change without a server round-trip
 * (the spec acceptance criterion is <2s for 5,000 policies).
 */

import type { AmsProvider } from './amsIntegration'

/** One in-force policy in the producer's book of business. */
export interface PortfolioPolicy {
  /** Stable id (typically `${provider}:${policyId}`). */
  id: string
  /** Which AMS this policy was sourced from. */
  provider: AmsProvider
  /** Provider's native policy id (so users can deep-link). */
  policyNumber: string
  /** Address fields â matches the rest of the codebase. */
  property: {
    addressLine1: string
    city: string
    state: string
    postalCode: string
  }
  /** The producer (agent) that owns this policy in the agency. */
  producerId: string
  /** Carrier the policy is bound to. */
  carrierName: string
  /** Composite insurability score (0-100). */
  insurabilityScore: number
  /**
   * The dominant peril for this property â used in the filter chips
   * so a producer can see "all my fire-prone Florida properties".
   */
  dominantPeril: PortfolioPeril
  /** Retention-risk classification (driven by `classifyRetentionRisk`). */
  retentionRisk: RetentionRiskLevel
  /** ISO-8601 timestamp the policy was last refreshed from the AMS. */
  lastSyncAt: string
  /** Annual premium in dollars (used for the agency-revenue rollup). */
  annualPremiumUsd: number
}

/** Dominant peril facets the dashboard filters on. */
export type PortfolioPeril =
  | 'WILDFIRE'
  | 'HURRICANE'
  | 'FLOOD'
  | 'HAIL'
  | 'WINDSTORM'
  | 'EARTHQUAKE'
  | 'CONVECTIVE_STORM'
  | 'NONE'

/**
 * Retention-risk classification. Drives the colored chip on each row
 * and the "at-risk count" in the summary card.
 *
 * The spec ties retention risk to two signals:
 *   1. carrier withdrawals from the property's market;
 *   2. peril-score changes that suggest non-renewal.
 *
 * Both are inputs to `classifyRetentionRisk` (see utils file).
 */
export type RetentionRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/**
 * Filter values applied to the table. Empty arrays = no filter on that
 * facet. The dashboard recomputes the rendered rows + summary whenever
 * any of these change.
 */
export interface PortfolioFilters {
  states: string[]
  perils: PortfolioPeril[]
  carriers: string[]
  producers: string[]
  /** Optional minimum retention-risk threshold. */
  minRetentionRisk: RetentionRiskLevel | null
  /** Optional fuzzy search across address + carrier + policy number. */
  searchQuery: string
}

/** Summary roll-up shown above the table. */
export interface PortfolioSummary {
  totalPolicies: number
  filteredPolicies: number
  averageScore: number | null
  /** Total annual premium across the filtered set, in dollars. */
  totalAnnualPremiumUsd: number
  /** Counts per retention-risk level. */
  retentionBreakdown: Record<RetentionRiskLevel, number>
  /** Counts per peril. */
  perilBreakdown: Record<PortfolioPeril, number>
}

/**
 * Day-over-day delta the daily change-alert batch sends out.
 *
 * The P1 #8 alerts mechanic owns the *delivery* (channels, quiet
 * hours, etc.); this struct is what gets handed to that pipeline.
 */
export interface PortfolioDeltaSummary {
  /** ISO-8601 timestamp of the snapshot we are diffing against. */
  asOf: string
  /** Number of policies whose score moved beyond {@link MATERIAL_SCORE_DELTA}. */
  scoreMoves: number
  /** Number of policies whose retention-risk classification changed. */
  retentionRiskChanges: number
  /** Number of policies whose carrier dropped them. */
  carrierDrops: number
  /** Five most-impacted policies (id + reason), capped for emails. */
  topImpacted: ReadonlyArray<{
    policyId: string
    reason: string
  }>
}

/**
 * Score-delta threshold above which a daily change is considered
 * material. The alerts batch only emits an entry if the score moved
 * by at least this many points.
 */
export const MATERIAL_SCORE_DELTA = 5

/** Performance budget. Spec: <2s for 5,000 policies. */
export const PORTFOLIO_LOAD_BUDGET_MS = 2000

/** Maximum size the dashboard will render without paginating. */
export const PORTFOLIO_MAX_ROWS_RENDERED = 5000

/** Number of "top impacted" entries the daily delta surfaces. */
export const TOP_IMPACTED_LIMIT = 5

/** Default filters â everything visible. */
export const DEFAULT_PORTFOLIO_FILTERS: PortfolioFilters = {
  states: [],
  perils: [],
  carriers: [],
  producers: [],
  minRetentionRisk: null,
  searchQuery: '',
}
