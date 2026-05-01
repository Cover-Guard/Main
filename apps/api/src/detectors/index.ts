export type { Detector, DetectorContext, Insight, RunResult } from './types'
export {
  evaluateThreshold,
  evaluateAnomaly,
  evaluateMilestone,
  type ThresholdComparison,
  type ThresholdResult,
  type AnomalyResult,
  type MilestoneResult,
} from './evaluators'
export { runDetectorsForUser } from './runner'
export { smokeDetector } from './smokeDetector'

import type { Detector } from './types'
import { smokeDetector } from './smokeDetector'

/**
 * The active detector set. PR 7 ships only the smoke detector; PR 8 will
 * extend this list. Order doesn't matter for correctness — the runner
 * iterates each one independently.
 */
export const ALL_DETECTORS: ReadonlyArray<Detector> = [smokeDetector]
