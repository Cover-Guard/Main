/**
 * Web push dispatcher â pure helpers (PR 11).
 *
 * Generalises push fan-out for every notification category. Three pieces:
 *
 *   1. `shouldPushNotification` â pure predicate using prefs + severity.
 *      Mirrors PR 10's email digest rules so behaviour is consistent
 *      across channels.
 *
 *   2. `buildPushPayload` â pure renderer producing the JSON the client
 *      service worker expects. Title/body/url/tag derive from the
 *      notification.
 *
 *   3. `isInQuietHours` â timezone-aware quiet-hours check used by
 *      `shouldPushNotification`.
 *
 * The I/O part â actually posting to the push service â lives in
 * `pushTransport.ts`. Splitting them lets the helpers be unit-tested
 * without pulling `web-push` into the test sandbox.
 */

import type {
  NotificationCategory,
  NotificationSeverity,
} from '@coverguard/shared'

export interface PushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPrefsForDispatcher {
  channels: Record<
    string,
    { inApp?: boolean; email?: boolean; push?: boolean } | undefined
  >
  /** Optional quiet-hours bounds (0-23). When inside, only urgent+ pushes. */
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
  timezone?: string
}

export interface PushNotification {
  id: string
  title: string
  body: string | null
  linkUrl: string | null
  category: NotificationCategory
  severity: NotificationSeverity
  /** Optional grouping key for the platform's "replace previous" behaviour. */
  entityType?: string | null
  entityId?: string | null
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
  notificationId: string
  severity: NotificationSeverity
  category: NotificationCategory
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  blocking: 4,
  urgent: 3,
  actionable: 2,
  info: 1,
}

/**
 * Given a notification + the user's preferences, decide whether to push.
 *
 * Rules:
 *   â¢ Severity actionable+ always pushes â these are the "this needs you
 *     now" items. Hiding them behind a channel toggle is a footgun.
 *   â¢ Otherwise: push iff the per-category push channel is enabled.
 *   â¢ Quiet hours: when set, only severity urgent+ punches through.
 */
export function shouldPushNotification(
  notification: Pick<PushNotification, 'category' | 'severity'>,
  prefs: PushPrefsForDispatcher,
  now: Date = new Date(),
): boolean {
  const sevRank = SEVERITY_RANK[notification.severity]
  const inQuietHours = isInQuietHours(now, prefs)

  if (inQuietHours) {
    // Inside quiet hours: only urgent+ punches through.
    return sevRank >= SEVERITY_RANK.urgent
  }

  if (sevRank >= SEVERITY_RANK.actionable) return true

  const channel = prefs.channels?.[notification.category]
  return Boolean(channel?.push)
}

/**
 * Whether `now` falls inside the user's configured quiet hours window.
 * Returns false if either bound is null. Handles wrap-around (e.g. 22â7).
 */
export function isInQuietHours(
  now: Date,
  prefs: Pick<PushPrefsForDispatcher, 'quietHoursStart' | 'quietHoursEnd' | 'timezone'>,
): boolean {
  const start = prefs.quietHoursStart
  const end = prefs.quietHoursEnd
  if (start === null || start === undefined) return false
  if (end === null || end === undefined) return false

  const tz = prefs.timezone || 'UTC'
  let hour: number
  try {
    hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        hour: '2-digit',
      }).formatToParts(now).find((p) => p.type === 'hour')?.value ?? '0',
      10,
    )
  } catch {
    hour = now.getUTCHours()
  }
  if (Number.isNaN(hour) || hour === 24) hour = 0

  if (start < end) {
    // Same-day window, e.g. 13 â 17
    return hour >= start && hour < end
  }
  // Wrap-around window, e.g. 22 â 7
  return hour >= start || hour < end
}

/**
 * Build the JSON payload the service worker receives. Body is title-cased
 * for the lock screen; URL falls back to a deep link if linkUrl is null.
 */
export function buildPushPayload(
  notification: PushNotification,
  baseUrl: string,
): PushPayload {
  const url =
    notification.linkUrl ?? `${baseUrl}/dashboard?notification=${notification.id}`

  // Tag groups related notifications on the device â re-pushing the same
  // entity replaces the old one rather than stacking.
  const tag =
    notification.entityType && notification.entityId
      ? `${notification.entityType}:${notification.entityId}`
      : `notif:${notification.id}`

  // Strip the body to a reasonable lockscreen length â most platforms
  // truncate at ~120 chars anyway.
  const body = (notification.body ?? '').slice(0, 200) || ''

  return {
    title: notification.title,
    body,
    url,
    tag,
    notificationId: notification.id,
    severity: notification.severity,
    category: notification.category,
  }
}
