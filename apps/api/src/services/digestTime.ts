/**
 * Time-window helpers for the digest worker (PR 10).
 *
 * The worker runs every ~15 minutes (cron-driven). For each user with
 * `digestEnabled`, we need to decide: "is this run inside that user's digest
 * hour right now, and have we already sent today?"
 *
 * Pure functions only. No DB or env access â keeps the unit tests trivial.
 */

export interface DigestPreferences {
  digestEnabled: boolean
  digestHourLocal: number // 0-23, the user's local hour
  timezone: string // IANA tz name
  lastDigestSentAt: string | null // ISO-8601 UTC
}

/**
 * Convert a UTC date to the wall-clock hour and date string in the given IANA
 * timezone. Returns { hour, dateKey } where dateKey is `YYYY-MM-DD` in the
 * target timezone. We only need hour + date for the dedupe â minutes and
 * seconds don't matter.
 */
export function localHourAndDate(
  now: Date,
  timezone: string,
): { hour: number; dateKey: string } {
  // Intl.DateTimeFormat with timeZone gives us per-zone wall-clock parts
  // without pulling in a full IANA library. The values come back as strings;
  // we convert.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? ''
  const year = get('year')
  const month = get('month')
  const day = get('day')
  // Intl returns "24" for midnight in some locales/engines â normalise to 0.
  const rawHour = get('hour')
  const hour = rawHour === '24' ? 0 : parseInt(rawHour, 10)
  return { hour, dateKey: `${year}-${month}-${day}` }
}

/**
 * Decide whether a user is due for a digest right now.
 *
 * Returns true iff:
 *   1. digestEnabled is true
 *   2. their local hour matches digestHourLocal
 *   3. we haven't already sent a digest in their local "today"
 *
 * The dateKey check is the dedupe â running the worker every 15 minutes
 * inside the digest hour produces 4 attempts; only the first will pass.
 */
export function isDigestDueNow(
  now: Date,
  prefs: DigestPreferences,
): boolean {
  if (!prefs.digestEnabled) return false

  const tz = prefs.timezone || 'UTC'
  let local: { hour: number; dateKey: string }
  try {
    local = localHourAndDate(now, tz)
  } catch {
    // Malformed timezone â fall back to UTC rather than skip.
    local = localHourAndDate(now, 'UTC')
  }

  if (local.hour !== prefs.digestHourLocal) return false

  if (prefs.lastDigestSentAt) {
    let lastLocal: { hour: number; dateKey: string }
    try {
      lastLocal = localHourAndDate(new Date(prefs.lastDigestSentAt), tz)
    } catch {
      lastLocal = localHourAndDate(new Date(prefs.lastDigestSentAt), 'UTC')
    }
    if (lastLocal.dateKey === local.dateKey) {
      return false
    }
  }
  return true
}
