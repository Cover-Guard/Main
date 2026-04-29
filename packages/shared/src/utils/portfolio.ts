/**
 * Helpers for the book-of-business / portfolio dashboard (P2 #16).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Pure / I/O-free â the AMS-side fetch lives under
 * `apps/api/src/integrations/portfolio/`. This file is the shared
 * computation layer:
 *
 *   - apply filters to the row set;
 *   - classify retention risk from the inputs the AMS gives us;
 *   - summarize the filtered set for the summary card;
 *   - compute the day-over-day delta the alerts batch consumes;
 *   - measure performance against the spec's 2s budget.
 *
 * The dashboard re-runs `applyPortfolioFilters` + `summarizePortfolio`
 * on every filter change. Both walk the row set once, so a 5,000-row
 * book is well inside budget.
 */
import {
  type PortfolioFilters,
  type PortfolioPeril,
  type PortfolioPolicy,
  type PortfolioSummary,
  type PortfolioDeltaSummary,
  type RetentionRiskLevel,
  MATERIAL_SCORE_DELTA,
  PORTFOLIO_LOAD_BUDGET_MS,
  TOP_IMPACTED_LIMIT,
} from '../types/portfolio'

// =============================================================================
// Retention-risk classification
// =============================================================================

/** Inputs the AMS gives us for retention-risk classification. */
export interface RetentionRiskInputs {
  /** Did the carrier announce a withdrawal in this property's market? */
  carrierWithdrawing: boolean
  /** How much the insurability score moved in the last 30d (signed). */
  scoreDelta30d: number
  /** Months since the most-recent renewal. */
  monthsSinceRenewal: number
}

/**
 * Classify a policy's retention risk from the latest AMS signals.
 *
 * Rules (rolled up from the spec acceptance criteria):
 *   - Carrier withdrawal => CRITICAL regardless of score.
 *   - Score drop >= 15 within the last 30d => HIGH (or CRITICAL on top).
 *   - Score drop 5-14 within 30d => MEDIUM.
 *   - Approaching renewal (>= 9 months) with any negative score change => MEDIUM.
 *   - Otherwise LOW.
 */
export function classifyRetentionRisk(input: RetentionRiskInputs): RetentionRiskLevel {
  if (input.carrierWithdrawing) return 'CRITICAL'
  if (input.scoreDelta30d <= -15) return 'HIGH'
  if (input.scoreDelta30d <= -MATERIAL_SCORE_DELTA) return 'MEDIUM'
  if (input.monthsSinceRenewal >= 9 && input.scoreDelta30d < 0) return 'MEDIUM'
  return 'LOW'
}

/** Total ordering on retention-risk levels (used for filter thresholds). */
const RETENTION_RANK: Record<RetentionRiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

export function retentionRiskAtLeast(
  level: RetentionRiskLevel,
  threshold: RetentionRiskLevel,
): boolean {
  return RETENTION_RANK[level] >= RETENTION_RANK[threshold]
}

/** Display copy / chip variant per retention-risk level. */
export function retentionRiskCopy(level: RetentionRiskLevel): {
  label: string
  variant: 'success' | 'neutral' | 'warning' | 'danger'
} {
  switch (level) {
    case 'LOW':      return { label: 'Stable',      variant: 'success' }
    case 'MEDIUM':   return { label: 'Watch',       variant: 'neutral' }
    case 'HIGH':     return { label: 'At risk',     variant: 'warning' }
    case 'CRITICAL': return { label: 'Non-renewal', variant: 'danger'  }
  }
}

// =============================================================================
// Filtering
// =============================================================================

/**
 * Apply filters to the policy set. Returns a new array preserving the
 * caller's order â the table component sorts on top.
 *
 * The fuzzy search is case-insensitive across address line 1, city,
 * carrier, and policy number â what producers actually search.
 */
export function applyPortfolioFilters(
  policies: readonly PortfolioPolicy[],
  filters: PortfolioFilters,
): PortfolioPolicy[] {
  const q = filters.searchQuery.trim().toLowerCase()
  const out: PortfolioPolicy[] = []
  for (const p of policies) {
    if (filters.states.length > 0 && !filters.states.includes(p.property.state)) continue
    if (filters.perils.length > 0 && !filters.perils.includes(p.dominantPeril)) continue
    if (filters.carriers.length > 0 && !filters.carriers.includes(p.carrierName)) continue
    if (filters.producers.length > 0 && !filters.producers.includes(p.producerId)) continue
    if (filters.minRetentionRisk && !retentionRiskAtLeast(p.retentionRisk, filters.minRetentionRisk)) continue
    if (q.length > 0) {
      const hay = [
        p.property.addressLine1,
        p.property.city,
        p.carrierName,
        p.policyNumber,
      ]
        .join('|')
        .toLowerCase()
      if (!hay.includes(q)) continue
    }
    out.push(p)
  }
  return out
}

// =============================================================================
// Summary
// =============================================================================

const PERILS: PortfolioPeril[] = [
  'WILDFIRE', 'HURRICANE', 'FLOOD', 'HAIL', 'WINDSTORM',
  'EARTHQUAKE', 'CONVECTIVE_STORM', 'NONE',
]

const RETENTION_LEVELS: RetentionRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function emptyPerilBreakdown(): Record<PortfolioPeril, number> {
  return PERILS.reduce(
    (acc, p) => { acc[p] = 0; return acc },
    {} as Record<PortfolioPeril, number>,
  )
}

function emptyRetentionBreakdown(): Record<RetentionRiskLevel, number> {
  return RETENTION_LEVELS.reduce(
    (acc, l) => { acc[l] = 0; return acc },
    {} as Record<RetentionRiskLevel, number>,
  )
}

/**
 * Roll-up the filtered set into the summary card. Walks the rows once
 * (so it stays inside the 2s budget for 5,000 policies).
 */
export function summarizePortfolio(
  totalCount: number,
  filtered: readonly PortfolioPolicy[],
): PortfolioSummary {
  const retention = emptyRetentionBreakdown()
  const perils = emptyPerilBreakdown()
  let scoreSum = 0
  let premiumSum = 0
  for (const p of filtered) {
    retention[p.retentionRisk]++
    perils[p.dominantPeril]++
    scoreSum += p.insurabilityScore
    premiumSum += p.annualPremiumUsd
  }
  return {
    totalPolicies: totalCount,
    filteredPolicies: filtered.length,
    averageScore: filtered.length === 0 ? null : Math.round(scoreSum / filtered.length),
    totalAnnualPremiumUsd: premiumSum,
    retentionBreakdown: retention,
    perilBreakdown: perils,
  }
}

// =============================================================================
// Day-over-day delta
// =============================================================================

/** Snapshot of the fields we diff against from the prior day's batch. */
export interface PolicySnapshot {
  policyId: string
  insurabilityScore: number
  retentionRisk: RetentionRiskLevel
  carrierName: string
}

/**
 * Compute the day-over-day delta. Used by the daily change-alert batch
 * (P1 #8 owns the delivery channel; this builds the payload).
 *
 * `current` and `prior` are keyed by policyId. Policies in `current`
 * but missing from `prior` are treated as "new" and not counted as a
 * change (they will be the producer's first encounter).
 */
export function computePortfolioDelta(
  asOf: string,
  prior: ReadonlyMap<string, PolicySnapshot>,
  current: readonly PortfolioPolicy[],
): PortfolioDeltaSummary {
  let scoreMoves = 0
  let retentionRiskChanges = 0
  let carrierDrops = 0
  const impacted: { policyId: string; reason: string; magnitude: number }[] = []

  for (const cur of current) {
    const prev = prior.get(cur.id)
    if (!prev) continue
    const scoreDelta = cur.insurabilityScore - prev.insurabilityScore
    if (Math.abs(scoreDelta) >= MATERIAL_SCORE_DELTA) {
      scoreMoves++
      impacted.push({
        policyId: cur.id,
        reason: `Score moved ${scoreDelta >= 0 ? '+' : ''}${scoreDelta}`,
        magnitude: Math.abs(scoreDelta),
      })
    }
    if (cur.retentionRisk !== prev.retentionRisk) {
      retentionRiskChanges++
      impacted.push({
        policyId: cur.id,
        reason: `Retention ${prev.retentionRisk} -> ${cur.retentionRisk}`,
        magnitude:
          Math.abs(RETENTION_RANK[cur.retentionRisk] - RETENTION_RANK[prev.retentionRisk]) * 10,
      })
    }
    if (cur.carrierName !== prev.carrierName) {
      carrierDrops++
      impacted.push({
        policyId: cur.id,
        reason: `Carrier changed ${prev.carrierName} -> ${cur.carrierName}`,
        magnitude: 100, // carrier change always tops the list
      })
    }
  }

  // Sort by magnitude desc, dedupe by policy (first reason wins), cap.
  impacted.sort((a, b) => b.magnitude - a.magnitude)
  const seen = new Set<string>()
  const topImpacted: { policyId: string; reason: string }[] = []
  for (const e of impacted) {
    if (seen.has(e.policyId)) continue
    seen.add(e.policyId)
    topImpacted.push({ policyId: e.policyId, reason: e.reason })
    if (topImpacted.length >= TOP_IMPACTED_LIMIT) break
  }

  return { asOf, scoreMoves, retentionRiskChanges, carrierDrops, topImpacted }
}

// =============================================================================
// Performance
// =============================================================================

/** Whether the dashboard rendered inside the spec budget. */
export function isPortfolioRenderWithinBudget(elapsedMs: number): boolean {
  return elapsedMs <= PORTFOLIO_LOAD_BUDGET_MS
}

/** Display copy bucket. Centralized for the dashboard footer + telemetry. */
export type PortfolioPerformanceBucket = 'FAST' | 'OK' | 'SLOW'

export function classifyPortfolioRender(elapsedMs: number): PortfolioPerformanceBucket {
  if (elapsedMs > PORTFOLIO_LOAD_BUDGET_MS) return 'SLOW'
  if (elapsedMs > PORTFOLIO_LOAD_BUDGET_MS / 2) return 'OK'
  return 'FAST'
}

// =============================================================================
// Display copy
// =============================================================================

export function perilLabel(peril: PortfolioPeril): string {
  switch (peril) {
    case 'WILDFIRE':         return 'Wildfire'
    case 'HURRICANE':        return 'Hurricane'
    case 'FLOOD':            return 'Flood'
    case 'HAIL':             return 'Hail'
    case 'WINDSTORM':        return 'Windstorm'
    case 'EARTHQUAKE':       return 'Earthquake'
    case 'CONVECTIVE_STORM': return 'Convective storm'
    case 'NONE':             return 'No dominant peril'
  }
}

/** Human currency formatter shared with the summary card. */
export function formatPortfolioPremium(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`
  if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(1)}K`
  return `$${Math.round(usd)}`
}
