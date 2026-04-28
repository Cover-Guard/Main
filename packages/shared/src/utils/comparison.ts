/**
 * Pure helpers for the comparison view (P1 #10).
 *
 * Side-by-side layout, winner badges, and headline copy live here so
 * the same rules cover the on-screen view and the PDF export.
 */

import type { PerilType } from '../types/perilNarrative'
import type { PropertyRiskProfile } from '../types/risk'
import type {
  ComparedProperty,
  ComparisonRow,
  ComparisonSummary,
} from '../types/comparison'
import {
  MAX_COMPARED_PROPERTIES,
  MIN_COMPARED_PROPERTIES,
} from '../types/comparison'

/** Stable order of perils in the comparison table. */
export const COMPARISON_PERILS: readonly PerilType[] = [
  'flood',
  'fire',
  'wind',
  'earthquake',
  'crime',
  'heat',
] as const

/**
 * Read the score for one peril off a {@link PropertyRiskProfile}.
 * Returns `null` when the field isn't populated (e.g. heat is optional).
 *
 * Inlined here so the comparison module has no cross-module dependency
 * on the report-narratives helper (which lives in a parallel PR).
 */
function perilScoreFromProfile(
  profile: PropertyRiskProfile,
  peril: PerilType,
): number | null {
  switch (peril) {
    case 'flood':      return profile.flood.score
    case 'fire':       return profile.fire.score
    case 'wind':       return profile.wind.score
    case 'earthquake': return profile.earthquake.score
    case 'crime':      return profile.crime.score
    case 'heat':       return profile.heat?.score ?? null
  }
}

/**
 * Validate the size of a comparison set. Spec calls for 2-3 entries.
 * Returns a structured result so the caller (form / API) can show a
 * useful error message.
 */
export function validateComparisonSize(
  count: number,
):
  | { ok: true }
  | { ok: false; reason: 'TOO_FEW' | 'TOO_MANY' } {
  if (count < MIN_COMPARED_PROPERTIES) return { ok: false, reason: 'TOO_FEW' }
  if (count > MAX_COMPARED_PROPERTIES) return { ok: false, reason: 'TOO_MANY' }
  return { ok: true }
}

/**
 * Pick the index of the property with the lowest (best) score in an
 * array. Returns `null` when:
 *  - the array is empty
 *  - the lowest score is tied across multiple properties
 *  - every score is null
 *
 * "Lower is better" matches our 0-100 peril-score convention (low
 * score = low risk = preferred outcome for the buyer).
 */
export function pickWinnerIndex(
  scores: ReadonlyArray<number | null>,
): number | null {
  let bestIdx: number | null = null
  let bestScore = Number.POSITIVE_INFINITY
  let tied = false

  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]
    if (s == null) continue
    if (s < bestScore) {
      bestScore = s
      bestIdx = i
      tied = false
    } else if (s === bestScore) {
      tied = true
    }
  }
  return tied ? null : bestIdx
}

/**
 * Build the per-peril rows. Each row carries scores and the winning
 * index so the UI can drop a winner chip without re-deriving.
 */
export function buildComparisonRows(
  entries: readonly ComparedProperty[],
): ComparisonRow[] {
  return COMPARISON_PERILS.map((peril) => {
    const scores = entries.map((e) => perilScoreFromProfile(e.profile, peril))
    return { peril, scores, winnerIndex: pickWinnerIndex(scores) }
  })
}

/**
 * Pick the overall winner: lowest sum of (non-null) peril scores.
 * Returns `null` when the input is empty or every entry has only nulls.
 */
export function pickOverallWinnerIndex(
  entries: readonly ComparedProperty[],
): number | null {
  if (entries.length === 0) return null
  const totals = entries.map((e) => {
    let total = 0
    let any = false
    for (const peril of COMPARISON_PERILS) {
      const s = perilScoreFromProfile(e.profile, peril)
      if (s != null) {
        total += s
        any = true
      }
    }
    return any ? total : null
  })
  return pickWinnerIndex(totals)
}

/**
 * Generate the human-readable headline for the comparison page.
 *
 * Examples:
 *  - "3 properties compared - best overall: 123 Main St"
 *  - "2 properties compared - tied on overall risk"
 */
export function comparisonHeadline(
  entries: readonly ComparedProperty[],
): string {
  const n = entries.length
  if (n === 0) return 'No properties compared'
  if (n === 1) return '1 property selected (need at least 2 to compare)'
  const winnerIdx = pickOverallWinnerIndex(entries)
  if (winnerIdx == null) {
    return `${n} properties compared - tied on overall risk`
  }
  return `${n} properties compared - best overall: ${entries[winnerIdx].property.address}`
}

/**
 * Roll the rows + headline + overall winner up into one
 * {@link ComparisonSummary}. The page renders it; the PDF export
 * serializes it.
 */
export function summarizeComparison(
  entries: readonly ComparedProperty[],
): ComparisonSummary {
  return {
    headline: comparisonHeadline(entries),
    rows: buildComparisonRows(entries),
    overallWinnerIndex: pickOverallWinnerIndex(entries),
  }
}
