/**
 * Types for the agent-directory + referral-handoff feature (P2 #18).
 *
 * Spec: docs/enhancements/P2-enhancements.md
 * ("P2 #18 — Agent Directory / Referral Handoff").
 *
 * A buyer who runs a free CoverGuard insurability check today has nowhere
 * to go to find an agent who can quote them. CoverGuard's flywheel turns
 * that wasted intent into a paid lead-gen channel:
 *
 *   1. Producer opts in to the directory (state coverage, property types,
 *      weekly lead cap, payout rails — depends on P0 #5 self-serve
 *      checkout for the billing infra).
 *   2. Buyer requests a quote on a property → CoverGuard matches a
 *      producer in <5s using opt-in coverage + composite score.
 *   3. Producer accepts / declines within 24h. Accepted handoffs are
 *      billed; declined / expired handoffs are not.
 *   4. Refund-eligibility window: 7 days post-acceptance for "bad lead"
 *      claims (wrong state, wrong property type, etc.).
 *
 * This module ships the shared contract pieces used across the buyer
 * UI, the producer dashboard, and the matching service.
 */

/**
 * Property types a producer can opt in to quote. Matches the existing
 * P&C taxonomy used in P0 #1 / P1 #9 narratives.
 */
export type DirectoryPropertyType =
  | 'SINGLE_FAMILY'
  | 'CONDO'
  | 'MULTI_FAMILY'
  | 'COMMERCIAL'
  | 'LAND'

/**
 * Tier the directory uses to rank producers + price handoffs.
 *
 *   TOP    → high rating + high acceptance + sufficient sample size
 *   GOOD   → meets thresholds but not top tier
 *   NEW    → not enough leads to score yet (cold start)
 *   RISK   → either too low rating, too many declines, or
 *            historical refund rate above the policy cap
 */
export type ProducerTier = 'TOP' | 'GOOD' | 'NEW' | 'RISK'

/**
 * Producer record as it appears in the directory.
 *
 * `licenseStates` and `propertyTypes` are the opt-in coverage matrix.
 * `leadCapPerWeek` is enforced by the matcher; producers above their
 * cap are excluded from `eligibleProducers`.
 */
export interface Producer {
  id: string
  name: string
  brokerageId: string
  brokerageName: string
  /** US state codes (uppercased two-letter). */
  licenseStates: readonly string[]
  /** Property types the producer is willing to quote. */
  propertyTypes: readonly DirectoryPropertyType[]
  /**
   * Average response time across the last 30 days of accepted leads.
   * Used in the composite score.
   */
  avgResponseHours: number
  /**
   * Fraction of offered handoffs the producer accepts (0..1). Sub-50%
   * acceptance kicks producers into RISK tier even with high ratings.
   */
  leadAcceptanceRate: number
  /** Buyer rating, 1.0..5.0. */
  rating1to5: number
  /** Sample size behind `rating1to5`. Used to differentiate NEW vs scored. */
  ratingCount: number
  /** Maximum new leads per ISO week. */
  leadCapPerWeek: number
  /** Leads received in the trailing 7 days (rolling cap-check). */
  leadCount7d: number
  /** Producer can be present but currently paused (e.g., on vacation). */
  optedIn: boolean
}

/**
 * Buyer's request for a quote — the input to the matcher.
 */
export interface BuyerLead {
  id: string
  propertyId: string
  /** US state code (uppercased two-letter). */
  propertyState: string
  propertyType: DirectoryPropertyType
  buyerEmail: string
  buyerFullName: string | null
  requestedAt: string
  /**
   * URN of the underlying CoverGuard report. Present on the handoff
   * row for compliance audit (P2 #14 audit trail integration).
   */
  reportUrn: string
}

/**
 * Lifecycle of a single handoff between (lead, producer).
 *
 *   PENDING  → matcher picked the producer; awaiting accept/decline
 *   ACCEPTED → producer claimed the lead; billable
 *   DECLINED → producer declined; not billable; matcher tries next pick
 *   EXPIRED  → 24h TTL elapsed without accept/decline
 *   REFUNDED → producer claimed refund within the 7-day window
 */
export type LeadHandoffStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'REFUNDED'

export interface LeadHandoff {
  id: string
  leadId: string
  producerId: string
  status: LeadHandoffStatus
  /** Price the producer pays if ACCEPTED, in USD cents. */
  priceCents: number
  createdAt: string
  acceptedAt: string | null
  declinedAt: string | null
  expiresAt: string
  refundedAt: string | null
  /** Free-form note from the producer on a refund claim. */
  refundReason: string | null
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Spec acceptance criterion: matcher must produce a candidate in under
 * 5 seconds. We treat anything above this as a SLOW match in the
 * dashboard chips.
 */
export const LEAD_MATCH_TARGET_SECONDS = 5

/**
 * Default sticker price for a single accepted lead, in USD cents.
 * The matcher applies tier multipliers on top of this.
 */
export const DEFAULT_LEAD_PRICE_CENTS = 2500

/**
 * How long a producer has to accept or decline a handoff before it
 * expires and the matcher moves to the next pick.
 */
export const LEAD_HANDOFF_TTL_HOURS = 24

/**
 * Refund-eligibility window in days, counted from `acceptedAt`.
 */
export const REFUND_WINDOW_DAYS = 7

/**
 * Minimum (rating, sample-size) thresholds for the GOOD / TOP tiers.
 * NEW (cold start) is anyone below `MIN_RATING_COUNT_FOR_SCORING`.
 */
export const MIN_RATING_COUNT_FOR_SCORING = 5
export const MIN_RATING_FOR_GOOD = 3.5
export const MIN_RATING_FOR_TOP = 4.5
export const MIN_ACCEPTANCE_FOR_GOOD = 0.6
export const MIN_ACCEPTANCE_FOR_TOP = 0.85

/** Tier multipliers applied to `DEFAULT_LEAD_PRICE_CENTS`. */
export const TIER_PRICE_MULTIPLIER: Record<ProducerTier, number> = {
  TOP: 1.5,
  GOOD: 1.0,
  NEW: 0.6,
  RISK: 0.0, // RISK producers are excluded entirely; multiplier is symbolic.
}
