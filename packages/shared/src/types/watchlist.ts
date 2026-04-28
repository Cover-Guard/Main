/**
 * Types for the property watchlist + change alerts (P1 #8).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #8 - Property Watchlist
 * + Change Alerts").
 *
 * Forward-compat scaffold: defines the shape of a watchlist entry, the
 * material-change events it can emit, and the user notification prefs.
 * The actual cron / email / push adapters land in a follow-up PR - this
 * file ships the contract everyone agrees on.
 */

/**
 * A watchlisted property. Owned by exactly one user; the same property
 * can appear on many users' watchlists.
 */
export interface WatchlistItem {
  /** Stable id (uuid) - not the report id, since reports refresh. */
  id: string
  /** Owner. */
  userId: string
  /** Property the watchlist is tracking. */
  propertyId: string
  /** Address shown in the UI list view. */
  addressLabel: string
  /** ISO-8601 timestamp the user added the property. */
  addedAt: string
  /** ISO-8601 timestamp the watcher last evaluated the property. */
  lastEvaluatedAt: string | null
  /** When set, paused entries skip cron evaluation but stay in the list. */
  pausedAt?: string | null
}

/**
 * The kinds of "material change" the spec defines:
 *  - PERIL_SCORE_DELTA           : peril score moved by >10 points
 *  - FEMA_ZONE_CHANGE            : FEMA flood-zone reclassified
 *  - CARRIER_APPETITE_CHANGE     : a carrier's appetite flipped
 *  - WILDFIRE_PERIMETER_INTERSECT: new wildfire perimeter intersects parcel
 */
export type WatchlistChangeKind =
  | 'PERIL_SCORE_DELTA'
  | 'FEMA_ZONE_CHANGE'
  | 'CARRIER_APPETITE_CHANGE'
  | 'WILDFIRE_PERIMETER_INTERSECT'

/**
 * Severity of an emitted change event. Matches the notification routing
 * table - HIGH goes to email + in-app, MEDIUM to in-app only, LOW is
 * surfaced inside the report when the user next opens it.
 */
export type WatchlistChangeSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * One material-change event recorded by the watcher.
 *
 * The watcher writes one of these per detected change; the notification
 * dispatcher reads them and decides whether to email the user (gated on
 * quiet hours + their notification prefs).
 */
export interface WatchlistChangeEvent {
  id: string
  watchlistItemId: string
  /** Property the change was detected on (denormalized for the inbox UI). */
  propertyId: string
  addressLabel: string
  kind: WatchlistChangeKind
  severity: WatchlistChangeSeverity
  /** ISO-8601 timestamp the change was detected. */
  detectedAt: string
  /** Human-readable headline ("Wildfire perimeter expanded within 0.4 mi"). */
  headline: string
  /** Optional structured detail (delta numbers, zone codes, carrier id). */
  detail?: Record<string, string | number | boolean | null>
}

/**
 * Per-user notification preferences. The dispatcher honors `email` /
 * `inApp` flags AND the quiet-hours window before sending.
 */
export interface NotificationPreferences {
  /** Send email summary on material change events. */
  email: boolean
  /** Push in-app notifications. */
  inApp: boolean
  /** Hour-of-day (0-23) when quiet hours START - default 21 (9pm). */
  quietHoursStart: number
  /** Hour-of-day (0-23) when quiet hours END - default 7 (7am). */
  quietHoursEnd: number
  /** IANA timezone name for the quiet-hours window. */
  timezone: string
}

/** Default prefs match spec ("no notifications outside 7am-9pm"). */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  inApp: true,
  quietHoursStart: 21,
  quietHoursEnd: 7,
  timezone: 'America/Los_Angeles',
}

/**
 * Watchlist size cap by plan tier. The spec calls for "capped per plan
 * tier" - here are the defaults the product team can wire up to billing
 * later.
 */
export type WatchlistTier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'

export const WATCHLIST_TIER_LIMITS: Record<WatchlistTier, number> = {
  FREE: 3,
  PRO: 25,
  TEAM: 100,
  ENTERPRISE: Number.POSITIVE_INFINITY,
}

/**
 * Default threshold for a "material" peril-score delta. Spec calls for
 * >10 points - exposed as a const so callers can tune in tests.
 */
export const MATERIAL_PERIL_DELTA_THRESHOLD = 10
