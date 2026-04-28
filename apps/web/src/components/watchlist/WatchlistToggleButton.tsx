'use client'

import type { WatchlistTier } from '@coverguard/shared'
import { canAddToWatchlist, watchlistTierLimit } from '@coverguard/shared'
import { Bell, BellOff, Lock, Loader2 } from 'lucide-react'

/**
 * One-click "Watch this property" toggle for the property report (P1 #8).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #8 - Property Watchlist
 * + Change Alerts").
 *
 * Stateless - the parent owns the watchlist + the optimistic mutation.
 * This component just renders the right copy + tier-cap guard.
 *
 *  - watching        -> "Watching" + bell icon (click to remove)
 *  - not watching    -> "Add to watchlist" + bell-outline (click to add)
 *  - at tier cap     -> "Upgrade for more watches" + lock icon (disabled)
 *  - in flight       -> spinner
 */
export interface WatchlistToggleButtonProps {
  /** Are we currently watching this property? */
  isWatching: boolean
  /** How many items the user already watches (across all properties). */
  currentWatchCount: number
  /** User's plan tier - drives the cap copy. */
  tier: WatchlistTier
  /** Mutation in-flight. Disables the button + shows the spinner. */
  pending?: boolean
  /** Fired when the user clicks add/remove. */
  onToggle: (next: boolean) => void
  /** Fired when the user is at the cap and clicks upgrade. */
  onUpgrade?: () => void
}

export function WatchlistToggleButton({
  isWatching,
  currentWatchCount,
  tier,
  pending = false,
  onToggle,
  onUpgrade,
}: WatchlistToggleButtonProps) {
  const limit = watchlistTierLimit(tier)
  const atCap = !isWatching && !canAddToWatchlist(currentWatchCount, tier)

  if (pending) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500"
        aria-busy="true"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving…
      </button>
    )
  }

  if (atCap) {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        title={`You're watching ${currentWatchCount} of ${limit} on the ${tier} plan.`}
      >
        <Lock className="h-3 w-3" aria-hidden />
        Upgrade for more watches
      </button>
    )
  }

  if (isWatching) {
    return (
      <button
        type="button"
        onClick={() => onToggle(false)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        aria-pressed="true"
      >
        <Bell className="h-3 w-3" aria-hidden />
        Watching
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      aria-pressed="false"
    >
      <BellOff className="h-3 w-3" aria-hidden />
      Add to watchlist
    </button>
  )
}
