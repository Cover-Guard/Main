/**
 * Re-exports the pure evaluator primitives from @coverguard/shared so
 * detector files import them from one place. Server-side composite helpers
 * that depend on Supabase live in this file.
 */

export {
  evaluateThreshold,
  evaluateAnomaly,
  evaluateMilestone,
  type ThresholdComparison,
  type ThresholdResult,
  type AnomalyResult,
  type MilestoneResult,
} from '@coverguard/shared'
