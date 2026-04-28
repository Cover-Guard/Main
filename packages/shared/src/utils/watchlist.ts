/**
 * Pure helpers for the watchlist + change alerts (P1 #8).
 *
 * These are intentionally I/O-free: callers (a cron worker, a Jest test,
 * the inbox UI) hand in current/previous data and get classifications
 * back. Storage, scheduling, and email delivery live elsewhere.
 */

import {
  MATERIAL_PERIL_DELTA_THRESHOLD,
  WATCHLIST_TIER_LIMITS,
  type NotificationPreferences,
  type WatchlistChangeKind,
  type WatchlistChangeSeverity,
  type WatchlistTier,
} from '../types/watchlist'

/**
 * Decide whether a peril-score delta crosses the spec's "material"
 * threshold (>10 points). Returns:
 *  - 'MATERIAL'   when the absolute delta exceeds the threshold
 *  - 'IMMATERIAL' otherwise
 *
 * Either input can be null (e.g. first evaluation) - we treat null as
 * IMMATERIAL since there's no prior to compare against.
 */
export function classifyPerilScoreDelta(
  previous: number | null,
  current: number | null,
  threshold: number = MATERIAL_PERIL_DELTA_THRESHOLD,
): 'MATERIAL' | 'IMMATERIAL' {
  if (previous == null || current == null) return 'IMMATERIAL'
  return Math.abs(current - previous) > threshold ? 'MATERIAL' : 'IMMATERIAL'
}

/**
 * Map a {@link WatchlistChangeKind} to its default severity. The
 * dispatcher uses this when the kind alone fully determines routing
 * (e.g. a wildfire intersect is always HIGH).
 *
 * For PERIL_SCORE_DELTA the caller must pass `delta` so we can scale
 * severity with magnitude (>20 -> HIGH, >10 -> MEDIUM, else LOW).
 */
export function defaultSeverityForChange(
  kind: WatchlistChangeKind,
  delta?: number,
): WatchlistChangeSeverity {
  switch (kind) {
    case 'WILDFIRE_PERIMETER_INTERSECT':
      return 'HIGH'
    case 'FEMA_ZONE_CHANGE':
      return 'HIGH'
    case 'CARRIER_APPETITE_CHANGE':
      return 'MEDIUM'
    case 'PERIL_SCORE_DELTA': {
      const abs = Math.abs(delta ?? 0)
      if (abs > 20) return 'HIGH'
      if (abs > MATERIAL_PERIL_DELTA_THRESHOLD) return 'MEDIUM'
      return 'LOW'
    }
  }
}

/** Human-readable label for a change kind. */
export function changeKindLabel(kind: WatchlistChangeKind): string {
  switch (kind) {
    case 'PERIL_SCORE_DELTA':
      return 'Peril score change'
    case 'FEMA_ZONE_CHANGE':
      return 'FEMA flood zone reclassified'
    case 'CARRIER_APPETITE_CHANGE':
      return 'Carrier appetite changed'
    case 'WILDFIRE_PERIMETER_INTERSECT':
      return 'Wildfire perimeter intersect'
  }
}

/**
 * Is the user inside their quiet-hours window right now?
 *
 * The spec defines quiet hours as "outside 7am-9pm local". This helper
 * returns `true` while the user is in the do-not-disturb window so the
 * dispatcher can hold the notification (or route it to the in-app inbox
 * instead of email).
 *
 * Supports wrap-around windows where `quietHoursStart > quietHoursEnd`
 * (e.g. 21 -> 7 the next morning).
 *
 * `localHourOfDay` should be 0-23 in the user's timezone. Caller is
 * expected to compute it via `Intl.DateTimeFormat` etc; we keep this
 * helper purely arithmetic to stay test-friendly.
 */
export function isWithinQuietHours(
  localHourOfDay: number,
  prefs: Pick<NotificationPreferences, 'quietHoursStart' | 'quietHoursEnd'>,
): boolean {
  const { quietHoursStart, quietHoursEnd } = prefs
  if (quietHoursStart === quietHoursEnd) return false // window disabled
  if (quietHoursStart < quietHoursEnd) {
    // Same-day window (e.g. 13 -> 17)
    return localHourOfDay >= quietHoursStart && localHourOfDay < quietHoursEnd
  }
  // Wrap-around window (e.g. 21 -> 7): we're quiet if hour is >= start OR < end
  return localHourOfDay >= quietHoursStart || localHourOfDay < quietHoursEnd
}

/**
 * Should we send a notification right now, given user prefs and clock?
 *
 *  - Returns `false` if the user has disabled the channel.
 *  - Returns `false` if we're inside quiet hours.
 *  - Otherwise `true`.
 */
export function shouldNotify(
  channel: 'email' | 'inApp',
  prefs: NotificationPreferences,
  localHourOfDay: number,
): boolean {
  if (channel === 'email' && !prefs.email) return false
  if (channel === 'inApp' && !prefs.inApp) return false
  return !isWithinQuietHours(localHourOfDay, prefs)
}

/**
 * Cap on the user's watchlist size for their plan tier.
 *
 * Returns Infinity for ENTERPRISE so callers can `if (size < limit)`
 * without a special-case branch.
 */
export function watchlistTierLimit(tier: WatchlistTier): number {
  return WATCHLIST_TIER_LIMITS[tier]
}

/**
 * Can the user add another item to their watchlist?
 *
 * Returns `true` while the user is under the cap for their tier.
 */
export function canAddToWatchlist(
  currentSize: number,
  tier: WatchlistTier,
): boolean {
  return currentSize < watchlistTierLimit(tier)
}
