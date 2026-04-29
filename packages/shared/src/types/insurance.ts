import type { RiskLevel } from './risk'

export interface CategoryInsurabilityScore {
  /** 0–100 difficulty score: higher = harder to insure */
  score: number
  level: RiskLevel
  /** Number of carriers actively writing policies for this peril in this market */
  activeCarrierCount: number
}

export interface InsurabilityScoresByCategory {
  flood: CategoryInsurabilityScore
  fire: CategoryInsurabilityScore
  wind: CategoryInsurabilityScore
  earthquake: CategoryInsurabilityScore
  crime: CategoryInsurabilityScore
}

export interface InsuranceCoverageType {
  type: CoverageType
  required: boolean
  averageAnnualPremium: number
  lowEstimate: number
  highEstimate: number
  notes: string[]
}

export type CoverageType =
  | 'HOMEOWNERS'
  | 'FLOOD'
  | 'EARTHQUAKE'
  | 'WIND_HURRICANE'
  | 'UMBRELLA'
  | 'FIRE'

export interface InsuranceCostEstimate {
  propertyId: string
  estimatedAnnualTotal: number
  estimatedMonthlyTotal: number
  confidenceLevel: ConfidenceLevel
  coverages: InsuranceCoverageType[]
  keyRiskFactors: string[]
  recommendations: string[]
  disclaimers: string[]
  generatedAt: string
}

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface InsurabilityStatus {
  propertyId: string
  isInsurable: boolean
  difficultyLevel: RiskLevel
  potentialIssues: string[]
  recommendedActions: string[]
  /** Weighted overall insurability difficulty score (0–100). Higher = harder to insure. */
  overallInsurabilityScore: number
  /** Per-category insurability scores */
  categoryScores: InsurabilityScoresByCategory
}

export interface Carrier {
  id: string
  name: string
  amBestRating: string        // e.g. 'A+', 'A', 'B+'
  writingStatus: CarrierWritingStatus
  coverageTypes: CoverageType[]
  avgPremiumModifier: number  // multiplier vs market avg (1.0 = market rate)
  statesLicensed: string[]
  specialties: string[]
  notes: string | null
  /**
   * Provenance of this carrier's appetite signal — where the
   * `writingStatus` value came from. Surfaced in the UI so users can
   * judge how much to trust it.
   *
   * Spec: docs/enhancements/p0/01-carrier-appetite-freshness.md
   */
  appetiteSource: CarrierAppetiteSource
  /**
   * Confidence band derived from source, freshness, and how directly the
   * carrier confirmed the appetite. HIGH only ships when we have an
   * authoritative signal less than a day old.
   */
  appetiteConfidence: CarrierAppetiteConfidence
  /**
   * ISO timestamp of when this carrier's appetite signal was last refreshed.
   * Per-carrier — the global `CarriersResult.lastUpdated` reflects the
   * batch run; this field reflects the per-carrier source-of-truth.
   */
  appetiteUpdatedAt: string
}

export type CarrierWritingStatus = 'ACTIVELY_WRITING' | 'LIMITED' | 'NOT_WRITING' | 'SURPLUS_LINES'

export interface CarriersResult {
  propertyId: string
  carriers: Carrier[]
  marketCondition: MarketCondition
  lastUpdated: string
}

export type MarketCondition = 'SOFT' | 'MODERATE' | 'HARD' | 'CRISIS'

/**
 * Where a carrier's writing-status signal came from. Ordered roughly by
 * authoritativeness — `CARRIER_API` is a contracted feed, `INFERRED` is a
 * fallback when no fresh signal exists.
 *
 * Spec: docs/enhancements/p0/01-carrier-appetite-freshness.md
 */
export type CarrierAppetiteSource =
  | 'CARRIER_API'   // direct contracted feed from the carrier
  | 'AGGREGATOR'    // MGA / surplus-line aggregator
  | 'PUBLIC_FILING' // state DOI rate / form filings
  | 'INFERRED'      // derived from market conditions, no fresh upstream signal

/**
 * Confidence band CoverGuard surfaces alongside each appetite row. Computed
 * from `(source, age, signalCompleteness)` — the worst dimension wins.
 *
 *  - HIGH:   contracted source, < 24h old, complete signal
 *  - MEDIUM: aggregator/public, or a contracted source 24h–7d old
 *  - LOW:    inferred, or any signal > 7d old
 */
export type CarrierAppetiteConfidence = 'HIGH' | 'MEDIUM' | 'LOW'


/**
 * Carrier-availability snapshot for a ZIP at a point in time. The delta-detection
 * job diffs two snapshots to surface VA-01 carrier-exit / re-open alerts.
 *
 * Spec: docs/gtm/value-add-activities/01-carrier-exit-alert.md
 */
export interface CarrierAvailabilitySnapshot {
  zip: string
  capturedAt: string
  entries: CarrierAvailabilityEntry[]
}

export interface CarrierAvailabilityEntry {
  carrierId: string
  carrierName: string
  status: CarrierWritingStatus
}

export type CarrierExitEventKind =
  | 'EXIT'       // was ACTIVELY_WRITING, now NOT_WRITING / LIMITED / SURPLUS_LINES
  | 'REOPEN'     // was NOT_WRITING, now ACTIVELY_WRITING
  | 'RESTRICT'   // was ACTIVELY_WRITING, now LIMITED
  | 'LIFT_RESTRICTION' // was LIMITED, now ACTIVELY_WRITING

export interface CarrierExitEvent {
  zip: string
  carrierId: string
  carrierName: string
  kind: CarrierExitEventKind
  previousStatus: CarrierWritingStatus
  currentStatus: CarrierWritingStatus
  detectedAt: string
}

export interface CarrierExitAlert {
  id: string
  zip: string
  event: CarrierExitEvent
  /** How many of the agent's book policies live in this ZIP. Zero for pure-interest alerts. */
  affectedPolicyCount: number
  /** Derived headline — "State Farm closed 94103" etc. */
  headline: string
  /** Suggested next action shown on the alert. */
  callToAction: string
  /** Severity driven by kind + affected-policy count. */
  severity: AlertSeverity
  /** ISO timestamp. */
  createdAt: string
  /** Whether the agent has dismissed or acknowledged the alert. */
  acknowledged: boolean
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

/**
 * Bind-path indicator — compresses multi-peril risk + live carrier availability
 * into a single Green/Yellow/Red signal an agent, realtor, LO, or buyer can
 * read in under a second.
 *
 * Spec: docs/gtm/value-add-activities/04-bind-path-indicator.md
 */
export type BindPathLevel = 'GREEN' | 'YELLOW' | 'RED'

export interface BindPath {
  /** Classification level. */
  level: BindPathLevel
  /** Count of carriers actively writing in this market. */
  openCarrierCount: number
  /** Perils whose level is HIGH, VERY_HIGH, or EXTREME. */
  highRiskPerils: string[]
  /** Plain-English rationale for the classification. */
  reason: string
}

/**
 * Mitigation savings — actions a property owner can take to lower their
 * expected insurance premium. Drives a re-quote reason for the agent and a
 * tangible engagement loop for the buyer.
 *
 * Spec: docs/gtm/value-add-activities/06-mitigation-savings.md
 */

/** Which peril a mitigation action primarily addresses. */
export type MitigationPeril = 'flood' | 'fire' | 'wind' | 'earthquake' | 'crime' | 'general'

/** A single mitigation action the homeowner could take. */
export interface MitigationAction {
  /** Stable identifier for analytics + referencing. */
  id: string
  /** Short human-readable action name. */
  title: string
  /** One-sentence explainer rendered under the title. */
  description: string
  /** The primary peril this action targets. */
  peril: MitigationPeril
  /** Typical carrier discount band as a percentage of annual premium (0.05 = 5%). */
  estimatedDiscountMin: number
  estimatedDiscountMax: number
  /** Typical one-time investment cost in USD (band). */
  investmentCostMin: number
  investmentCostMax: number
  /** Optional attribution for the discount source (e.g. "FORTIFIED Roof"). */
  source?: string
}

/**
 * A personalized mitigation suggestion — a MitigationAction evaluated against
 * this specific property's premium and risk profile.
 */
export interface MitigationSuggestion {
  action: MitigationAction
  /** Mid-point annualized savings in USD at the current premium. */
  estimatedAnnualSavings: number
  /** Mid-point one-time investment in USD. */
  estimatedInvestment: number
  /** Payback window in years (investment ÷ annual savings), rounded to 1 decimal. */
  paybackYears: number
  /** Why this action was selected for this property (peril level, etc.). */
  rationale: string
}

/** A ranked bundle of mitigation suggestions for a property. */
export interface MitigationPlan {
  propertyId: string
  /** Baseline annual premium the savings were computed against. */
  baselineAnnualPremium: number
  /** Suggestions in priority order (best ROI first). */
  suggestions: MitigationSuggestion[]
  /** Sum of estimatedAnnualSavings across all suggestions. */
  totalPotentialAnnualSavings: number
  /** Required caveat — estimates, not a binding offer. */
  disclaimer: string
  generatedAt: string
}
