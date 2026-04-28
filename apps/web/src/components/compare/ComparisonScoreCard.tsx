'use client'

import type { ComparisonRow, PerilType } from '@coverguard/shared'
import { Trophy } from 'lucide-react'

/**
 * Single peril row in the side-by-side comparison view (P1 #10).
 *
 * Stateless. Takes a {@link ComparisonRow} (precomputed on the page
 * via `buildComparisonRows`) plus the human-readable property labels
 * and renders the score chips with a winner badge on the lowest
 * (best) value.
 *
 * Mobile-first: stacks the chips vertically below 640px, side-by-side
 * above. Pairs with the P1 #7 responsive overhaul.
 */
export interface ComparisonScoreCardProps {
  row: ComparisonRow
  /** Human-readable labels for each compared property, same order as row.scores. */
  propertyLabels: readonly string[]
  /** Show the trophy badge on the winner. Default true. */
  highlightWinner?: boolean
}

const PERIL_LABEL: Record<PerilType, string> = {
  flood:      'Flood',
  fire:       'Wildfire',
  wind:       'Wind & hail',
  earthquake: 'Earthquake',
  crime:      'Crime',
  heat:       'Extreme heat',
}

export function ComparisonScoreCard({
  row,
  propertyLabels,
  highlightWinner = true,
}: ComparisonScoreCardProps) {
  const heading = PERIL_LABEL[row.peril]
  return (
    <article
      aria-label={`${heading} comparison`}
      className="rounded-xl border border-gray-200 bg-white p-3"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
          {heading}
        </h3>
        {highlightWinner && row.winnerIndex == null && (
          <span className="text-[10px] font-medium text-gray-400">No winner</span>
        )}
      </header>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {row.scores.map((score, i) => {
          const isWinner = highlightWinner && row.winnerIndex === i
          const variant = isWinner
            ? 'bg-emerald-50 ring-emerald-200 text-emerald-900'
            : 'bg-gray-50 ring-gray-200 text-gray-700'
          return (
            <li
              key={i}
              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs ring-1 ${variant}`}
            >
              <span className="min-w-0 truncate font-medium">
                {propertyLabels[i] ?? `#${i + 1}`}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                {isWinner && <Trophy className="h-3 w-3" aria-hidden />}
                {score == null ? '—' : Math.round(score)}
              </span>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
