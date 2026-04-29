/**
 * Types for the comparison view (P1 #10).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #10 - Comparison
 * View") - "Pick 2-3 properties from history or watchlist; side-by-side
 * report layout; exportable as a single PDF."
 *
 * Forward-compat: ships the contract for a 2-3-way comparison so the
 * existing CompareDrawer (which is 2-up only) can later swap up to the
 * full 3-up flow without re-deriving the headline / winner rules.
 */

import type { PerilType } from './perilNarrative'
import type { Property } from './property'
import type { PropertyRiskProfile } from './risk'

/** Hard cap from the spec ("Pick 2-3 properties"). */
export const MAX_COMPARED_PROPERTIES = 3

/** Minimum compared count - one is just a single report, not a comparison. */
export const MIN_COMPARED_PROPERTIES = 2

/**
 * One property included in a comparison. Pairs the lightweight
 * {@link Property} card-data with the fully-loaded
 * {@link PropertyRiskProfile} so consumers don't need a second fetch.
 */
export interface ComparedProperty {
  property: Property
  profile: PropertyRiskProfile
}

/**
 * The set of properties under comparison. Always 2-3 long; assertion
 * helpers in the utils module enforce this.
 */
export interface ComparisonSet {
  /** Stable id for the comparison itself (uuid). */
  id: string
  /** Owner. */
  userId: string
  /** Compared entries, in display order. */
  entries: readonly ComparedProperty[]
  /** ISO-8601 timestamp the set was assembled. */
  createdAt: string
}

/**
 * One comparison row: the values for a single peril across N properties.
 * Used by the side-by-side layout and by the "winner" badge logic.
 */
export interface ComparisonRow {
  peril: PerilType
  /**
   * Score per compared property (0-100). Same length and order as
   * the parent {@link ComparisonSet}.entries; null entries mean the
   * profile didn't include that peril.
   */
  scores: ReadonlyArray<number | null>
  /**
   * Index of the property with the lowest (best) score, or `null`
   * when there's a tie or every score is null.
   */
  winnerIndex: number | null
}

/**
 * Aggregated comparison summary. The headline copy is what the
 * "Comparison summary" header on the share page renders.
 */
export interface ComparisonSummary {
  /** "3 properties · best on flood: 123 Main St" etc. */
  headline: string
  /** Per-peril rows. */
  rows: ComparisonRow[]
  /**
   * Overall winner index (lowest sum-of-peril-scores). Falls back to
   * `null` when the set is too small or every entry is incomparable.
   */
  overallWinnerIndex: number | null
}

/** Where the user wants to ship the comparison. */
export type ComparisonExportTarget = 'PDF' | 'PRINT' | 'SHARE_LINK'

/**
 * Persisted preferences for how the user wants to view the comparison.
 * (Sticky between visits, surfaced on the toolbar.)
 */
export interface ComparisonViewPreferences {
  /** Show winner badges. */
  highlightWinners: boolean
  /** Stack vs. side-by-side at narrow widths. */
  layoutBelow640px: 'STACK' | 'SCROLL'
}

export const DEFAULT_COMPARISON_VIEW_PREFERENCES: ComparisonViewPreferences = {
  highlightWinners: true,
  layoutBelow640px: 'STACK',
}
