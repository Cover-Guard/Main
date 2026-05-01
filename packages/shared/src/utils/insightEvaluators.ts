/**
 * Evaluator primitives for the insights detector framework (PR 7).
 *
 * Pure, dependency-free helpers that detectors compose to make their decision
 * logic readable. Lives in @coverguard/shared so both the api detectors and
 * jest can import them. The runner and DetectorContext stay server-side
 * because they touch Supabase.
 *
 * The set is deliberately small. Detectors that need richer logic should
 * compose these or write their own predicate; the goal is consistency for
 * the common cases (threshold, anomaly, milestone) so the PR 8 detectors
 * read like business rules rather than ad-hoc math.
 */

export type ThresholdComparison = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export interface ThresholdResult {
  fired: boolean
  /** The actual value evaluated. Useful for the insight body. */
  value: number
  /** The threshold the value was compared against. */
  threshold: number
  comparison: ThresholdComparison
}

/**
 * Returns whether a value crosses a threshold under the given comparison.
 *
 * Use for "X is above/below Y" insights — quota approaching, error rate
 * exceeding 1%, deal stage stuck more than 7 days.
 */
export function evaluateThreshold(
  value: number,
  threshold: number,
  comparison: ThresholdComparison,
): ThresholdResult {
  let fired: boolean
  switch (comparison) {
    case 'gt':
      fired = value > threshold
      break
    case 'gte':
      fired = value >= threshold
      break
    case 'lt':
      fired = value < threshold
      break
    case 'lte':
      fired = value <= threshold
      break
    case 'eq':
      fired = value === threshold
      break
  }
  return { fired, value, threshold, comparison }
}

export interface AnomalyResult {
  fired: boolean
  /** Z-score of the current value against the baseline. */
  zScore: number
  /** Mean of the baseline window, useful for the insight body. */
  mean: number
  /** Standard deviation of the baseline window. */
  stdDev: number
}

/**
 * Returns whether a current value is anomalous against a baseline window.
 *
 * Computes the z-score: how many standard deviations the current value sits
 * away from the baseline mean. The detector typically pre-fetches the last N
 * days of a metric and passes them as `baseline`. `sigmaMultiple` defaults
 * to 2 — anything past 2σ is "unusual" by the empirical 95% rule.
 *
 * Returns `fired: false` if the baseline has fewer than 3 samples or zero
 * variance — both cases are too noisy to call an anomaly safely.
 */
export function evaluateAnomaly(
  baseline: ReadonlyArray<number>,
  current: number,
  sigmaMultiple = 2,
): AnomalyResult {
  if (baseline.length < 3) {
    return { fired: false, zScore: 0, mean: 0, stdDev: 0 }
  }
  const mean = baseline.reduce((s, v) => s + v, 0) / baseline.length
  const variance =
    baseline.reduce((s, v) => s + (v - mean) ** 2, 0) / baseline.length
  const stdDev = Math.sqrt(variance)
  if (stdDev === 0) {
    return { fired: false, zScore: 0, mean, stdDev: 0 }
  }
  const zScore = (current - mean) / stdDev
  const fired = Math.abs(zScore) >= sigmaMultiple
  return { fired, zScore, mean, stdDev }
}

export interface MilestoneResult<M extends number> {
  /** True when the previous count was below the milestone and current is at or above. */
  fired: boolean
  /** The milestone the user just crossed; null when none. */
  milestoneHit: M | null
}

/**
 * Returns whether the user crossed a milestone since the last evaluation.
 *
 * Use for celebratory insights — first deal closed, 10 properties saved,
 * 100 quotes generated. The detector tracks the previous count
 * (typically in payload metadata or a counters table) so we know exactly
 * which threshold was crossed.
 *
 * `milestones` should be sorted ascending. The result reports the highest
 * single milestone crossed in this evaluation; multi-step jumps still fire
 * once with the highest crossed milestone, which is the right UX for users
 * who do something noteworthy in bulk.
 */
export function evaluateMilestone<M extends number>(
  previousCount: number,
  currentCount: number,
  milestones: ReadonlyArray<M>,
): MilestoneResult<M> {
  // Highest milestone in (previousCount, currentCount].
  let hit: M | null = null
  for (const m of milestones) {
    if (m > previousCount && m <= currentCount) hit = m
  }
  return { fired: hit !== null, milestoneHit: hit }
}
