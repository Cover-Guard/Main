/**
 * Types for the plain-language risk narrative (P1 #9).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #9 - Plain-Language
 * Risk Narrative").
 *
 * Forward-compat scaffold: ships the contract for narratives + eval +
 * fallback today so the LLM provider integration in a follow-up PR can
 * land without touching shared types or the report UI again.
 */

/**
 * The set of perils we render narratives for. Mirrors the keys on
 * {@link PerilProfileMap} in `./risk.ts` but exported as a union so it
 * can drive switch statements + Records.
 */
export type PerilType =
  | 'flood'
  | 'fire'
  | 'wind'
  | 'earthquake'
  | 'crime'
  | 'heat'

/**
 * Where a narrative came from. The dispatcher prefers REVIEWED >
 * LLM > TEMPLATE for display, and `narrative.source` is what the badge
 * surfaces in the UI.
 *
 *  - LLM      : model-generated, passed eval at deploy time
 *  - TEMPLATE : deterministic fallback string, used when the model
 *               fails / is out of distribution / fails eval
 *  - REVIEWED : a human accepted this narrative in the review queue
 */
export type NarrativeSource = 'LLM' | 'TEMPLATE' | 'REVIEWED'

/**
 * Status of a narrative in the human review queue. PENDING entries land
 * here when the model returns below {@link LOW_CONFIDENCE_THRESHOLD}.
 */
export type NarrativeReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

/**
 * One narrative for one peril on one property. The report renders an
 * array of these, one per peril.
 */
export interface RiskNarrative {
  /** Stable id (uuid). */
  id: string
  /** Property the narrative is about. */
  propertyId: string
  /** Which peril this paragraph explains. */
  peril: PerilType
  /** 0-100 peril score the narrative was built around. */
  score: number
  /** Where the body string came from. */
  source: NarrativeSource
  /**
   * 0..1 model confidence (or 1 for REVIEWED, 1 for TEMPLATE since
   * templates are deterministic). Used to gate the review queue.
   */
  confidence: number
  /** The plain-language paragraph itself. */
  body: string
  /** ISO-8601 timestamp the narrative was generated. */
  generatedAt: string
  /** When set, the human reviewer who approved/rejected this narrative. */
  reviewerId?: string | null
  /** Review queue state (only meaningful when source === 'LLM'). */
  reviewStatus?: NarrativeReviewStatus
}

/**
 * One row in the eval set: a labeled (peril, inputs) pair with the
 * expected narrative. The CI eval pass-rate is computed across these.
 */
export interface NarrativeEvalCase {
  id: string
  peril: PerilType
  /** Score + inputs used to drive the prompt. */
  fixture: {
    score: number
    notes: Record<string, string | number | boolean | null>
  }
  expected: string
}

/**
 * Result of running one eval case against the current model + prompt.
 * `passed` is true if a similarity score crossed the per-case threshold.
 */
export interface NarrativeEvalResult {
  caseId: string
  passed: boolean
  /** 0..1 similarity score between actual and expected. */
  similarity: number
  /** Truncated actual output, for debugging the failure. */
  actualPreview: string
}

/**
 * Aggregate eval-suite output. The CI gate compares
 * {@link aggregatePassRate} against {@link EVAL_PASS_THRESHOLD}.
 */
export interface NarrativeEvalSummary {
  totalCases: number
  passedCases: number
  /** 0..1 - passedCases / totalCases. */
  passRate: number
  /** Per-peril pass rates so we can spot regressions in one slice. */
  perPeril: Partial<Record<PerilType, number>>
}

/**
 * Below this confidence, an LLM narrative goes to the review queue
 * instead of the live report.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7

/**
 * Aggregate eval pass-rate must meet or exceed this for CI to deploy a
 * new model / prompt. Spec calls for >90%.
 */
export const EVAL_PASS_THRESHOLD = 0.9
