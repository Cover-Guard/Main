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
