/**
 * Pure helpers for the plain-language risk narrative (P1 #9).
 *
 * These are I/O-free: callers (the model adapter, the eval runner, the
 * report UI) hand in inputs and get classifications / strings back. The
 * actual LLM call lives in a follow-up PR.
 */

import {
  EVAL_PASS_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  type NarrativeEvalResult,
  type NarrativeEvalSummary,
  type NarrativeSource,
  type PerilType,
  type RiskNarrative,
} from '../types/perilNarrative'

/**
 * Decide which narrative source the report should display.
 *
 * Rules (in priority order):
 *  - If the user has a REVIEWED narrative on file, prefer it.
 *  - Else if the LLM is available AND the eval suite passed at deploy
 *    AND the model returned a confidence >= LOW_CONFIDENCE_THRESHOLD,
 *    use the LLM output.
 *  - Else fall back to the deterministic TEMPLATE.
 *
 * This guarantees the spec acceptance criterion: "no model output ever
 * shipped without either eval-pass or template fallback."
 */
export function selectNarrativeSource({
  hasReviewed,
  llmAvailable,
  evalPassed,
  modelConfidence,
}: {
  hasReviewed: boolean
  llmAvailable: boolean
  evalPassed: boolean
  modelConfidence: number
}): NarrativeSource {
  if (hasReviewed) return 'REVIEWED'
  if (llmAvailable && evalPassed && modelConfidence >= LOW_CONFIDENCE_THRESHOLD) {
    return 'LLM'
  }
  return 'TEMPLATE'
}

/**
 * Should a narrative be queued for human review?
 *
 * Returns true for LLM narratives whose confidence falls below the
 * {@link LOW_CONFIDENCE_THRESHOLD}. TEMPLATE / REVIEWED narratives are
 * never queued.
 */
export function narrativeRequiresReview(
  narrative: Pick<RiskNarrative, 'source' | 'confidence'>,
): boolean {
  if (narrative.source !== 'LLM') return false
  return narrative.confidence < LOW_CONFIDENCE_THRESHOLD
}

/**
 * Bucket a confidence number into a UI label. Used by the badge that
 * sits next to a narrative on the report.
 */
export function confidenceLabel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence < LOW_CONFIDENCE_THRESHOLD) return 'low'
  if (confidence < 0.9) return 'medium'
  return 'high'
}

/**
 * Bucket a 0-100 peril score into a coarse band the templates branch on.
 */
export function perilScoreBand(score: number): 'low' | 'moderate' | 'high' | 'extreme' {
  if (score < 25) return 'low'
  if (score < 50) return 'moderate'
  if (score < 75) return 'high'
  return 'extreme'
}

/** Per-peril copy used by the deterministic fallback. */
const TEMPLATE_COPY: Record<
  PerilType,
  Record<ReturnType<typeof perilScoreBand>, string>
> = {
  flood: {
    low:      'Flood risk is low at this address. Standard policies usually cover it.',
    moderate: 'Some flood exposure here - review the FEMA zone before binding.',
    high:     'Elevated flood risk. The lender will likely require flood insurance.',
    extreme:  'High flood hazard zone. Flood insurance is almost certainly required and pricing reflects it.',
  },
  fire: {
    low:      'Wildfire exposure is low. Standard markets remain available.',
    moderate: 'Some wildfire exposure. Confirm carrier appetite before quoting.',
    high:     'Elevated wildfire risk - admitted markets may decline. Consider non-admitted alternates.',
    extreme:  'High wildfire severity zone. Expect E&S placements and significant premiums.',
  },
  wind: {
    low:      'Wind/hail exposure is low.',
    moderate: 'Moderate wind exposure - typical of the region.',
    high:     'Elevated wind risk. Higher hurricane / hail deductibles likely.',
    extreme:  'Severe wind exposure. Coastal carriers and deductible buy-downs are central to the conversation.',
  },
  earthquake: {
    low:      'Seismic risk is low.',
    moderate: 'Some seismic exposure - earthquake coverage is optional but worth quoting.',
    high:     'Elevated seismic risk. Earthquake coverage is a meaningful conversation here.',
    extreme:  'High seismic risk. Earthquake coverage is strongly recommended; deductibles are significant.',
  },
  crime: {
    low:      'Crime indices are below the national average.',
    moderate: 'Crime indices are near the national average.',
    high:     'Property crime indices run above the national average. Loss-mitigation discounts can help.',
    extreme:  'Crime indices are substantially elevated. Plan for higher liability + theft pricing.',
  },
  heat: {
    low:      'Extreme-heat exposure is limited.',
    moderate: 'Some extreme-heat exposure. Cooling failure is an emerging consideration.',
    high:     'Elevated extreme-heat exposure. Service-line / equipment-breakdown matters.',
    extreme:  'Severe extreme-heat exposure. Expect carriers to scrutinize cooling systems and infrastructure.',
  },
}

/**
 * Deterministic fallback narrative.
 *
 * Hand-written, peril-specific copy that we ship when the LLM is
 * unavailable / out of distribution / fails eval. Always a safe bet -
 * never blocks the report from rendering.
 */
export function generateTemplateNarrative(
  peril: PerilType,
  score: number,
): string {
  const band = perilScoreBand(score)
  return TEMPLATE_COPY[peril][band]
}

/**
 * Compute the eval summary across a set of per-case results.
 *
 * Returns the aggregate pass rate plus per-peril slices so we can spot
 * a regression on a single peril.
 */
export function summarizeEvalResults(
  results: readonly NarrativeEvalResult[],
  caseIndex: ReadonlyMap<string, PerilType>,
): NarrativeEvalSummary {
  const totalCases = results.length
  const passedCases = results.filter((r) => r.passed).length
  const passRate = totalCases === 0 ? 0 : passedCases / totalCases

  const perPerilTotals = new Map<PerilType, { passed: number; total: number }>()
  for (const r of results) {
    const peril = caseIndex.get(r.caseId)
    if (!peril) continue
    const bucket = perPerilTotals.get(peril) ?? { passed: 0, total: 0 }
    bucket.total += 1
    if (r.passed) bucket.passed += 1
    perPerilTotals.set(peril, bucket)
  }

  const perPeril: Partial<Record<PerilType, number>> = {}
  for (const [peril, { passed, total }] of perPerilTotals) {
    perPeril[peril] = total === 0 ? 0 : passed / total
  }

  return { totalCases, passedCases, passRate, perPeril }
}

/**
 * Did the eval suite clear the deploy-gate threshold (>90%)?
 *
 * This is what CI calls before deploying a new model / prompt.
 */
export function meetsEvalThreshold(summary: NarrativeEvalSummary): boolean {
  return summary.passRate >= EVAL_PASS_THRESHOLD
}
