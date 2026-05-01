export type { Detector, DetectorContext, Insight } from './types'
export type { RunResult } from './runner'
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
export { dealStuckDetector } from './dealStuckDetector'
export { trialEndingSoonDetector } from './trialEndingSoonDetector'
export { checklistOverdueDetector } from './checklistOverdueDetector'
export { estimateReadyDetector } from './estimateReadyDetector'
export { savedPropertiesMilestoneDetector } from './savedPropertiesMilestoneDetector'

import type { Detector } from './types'
import { smokeDetector } from './smokeDetector'
import { dealStuckDetector } from './dealStuckDetector'
import { trialEndingSoonDetector } from './trialEndingSoonDetector'
import { checklistOverdueDetector } from './checklistOverdueDetector'
import { estimateReadyDetector } from './estimateReadyDetector'
import { savedPropertiesMilestoneDetector } from './savedPropertiesMilestoneDetector'

/**
 * The active detector set. PR 7 shipped only the smoke detector; PR 8 adds
 * the production set. Order doesn't matter for correctness â the runner
 * iterates each one independently and dedupe is per-detector via dedupeKey.
 */
export const ALL_DETECTORS: ReadonlyArray<Detector> = [
  smokeDetector,
  dealStuckDetector,
  trialEndingSoonDetector,
  checklistOverdueDetector,
  estimateReadyDetector,
  savedPropertiesMilestoneDetector,
]
