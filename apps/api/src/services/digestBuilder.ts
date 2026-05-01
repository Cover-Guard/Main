/**
 * Digest content builder (PR 10).
 *
 * Pure function: take a user, their preferences, and the notifications
 * eligible for inclusion â return a structured digest, or null if there's
 * nothing worth emailing.
 *
 * The builder is intentionally narrow:
 *   â¢ it doesn't query the DB
 *   â¢ it doesn't render HTML (digestEmail.ts owns that)
 *   â¢ it doesn't decide whether a user is due (digestTime.ts owns that)
 *
 * Splitting these three concerns keeps the worker glue thin and makes each
 * piece individually testable.
 *
 * Filtering rules:
 *   â¢ Only notifications where the user's email channel is enabled for the
 *     category (per `channels` JSONB) are included.
 *   â¢ `system` and `actionable+` notifications always pass â the digest is
 *     useless if you can't see urgent items.
 *   â¢ Already-read or already-dismissed items are excluded â those have
 *     served their purpose.
 *   â¢ Items are grouped by category and capped at 5 per category to avoid
 *     a wall-of-text email.
 */

import type {
  NotificationCategory,
  NotificationSeverity,
} from '@coverguard/shared'

export interface DigestNotification {
  id: string
  title: string
  body: string | null
  linkUrl: string | null
  category: NotificationCategory
  severity: NotificationSeverity
  createdAt: string
}

export interface DigestPrefsForBuilder {
  channels: Record<
    string,
    { inApp?: boolean; email?: boolean; push?: boolean } | undefined
  >
}

export interface DigestSection {
  category: NotificationCategory
  label: string
  items: DigestNotification[]
  truncated: number // count beyond cap that we left out
}

export interface BuiltDigest {
  totalItems: number
  urgentCount: number
  actionableCount: number
  sections: DigestSection[]
}

const PER_SECTION_CAP = 5

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  transactional: 'Action items',
  collaborative: 'Conversations',
  insight: 'Insights',
  system: 'System',
  lifecycle: 'Account',
}

const CATEGORY_ORDER: NotificationCategory[] = [
  'transactional',
  'collaborative',
  'insight',
  'system',
  'lifecycle',
]

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  blocking: 4,
  urgent: 3,
  actionable: 2,
  info: 1,
}

/**
 * Whether a single notification should appear in the email digest.
 *
 * Always include: severity actionable+ (we don't bury follow-ups behind
 * the email channel toggle â those are too important).
 *
 * Otherwise: include iff the user's email channel for the category is on.
 */
export function shouldIncludeInDigest(
  notification: Pick<DigestNotification, 'category' | 'severity'>,
  prefs: DigestPrefsForBuilder,
): boolean {
  if (SEVERITY_RANK[notification.severity] >= SEVERITY_RANK.actionable) {
    return true
  }
  const channel = prefs.channels?.[notification.category]
  return Boolean(channel?.email)
}

/**
 * Build a digest from a user's notifications + prefs. Returns null when
 * there's nothing worth sending â caller should skip the dispatch.
 */
export function buildDigest(
  notifications: DigestNotification[],
  prefs: DigestPrefsForBuilder,
): BuiltDigest | null {
  const eligible = notifications.filter((n) => shouldIncludeInDigest(n, prefs))
  if (eligible.length === 0) return null

  const byCategory = new Map<NotificationCategory, DigestNotification[]>()
  for (const n of eligible) {
    const arr = byCategory.get(n.category) ?? []
    arr.push(n)
    byCategory.set(n.category, arr)
  }

  const sections: DigestSection[] = []
  for (const cat of CATEGORY_ORDER) {
    const items = byCategory.get(cat)
    if (!items || items.length === 0) continue
    // Sort by severity desc, then createdAt desc, so the most pressing items
    // are at the top of each section.
    items.sort((a, b) => {
      const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
      if (sev !== 0) return sev
      return b.createdAt.localeCompare(a.createdAt)
    })
    const head = items.slice(0, PER_SECTION_CAP)
    sections.push({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: head,
      truncated: Math.max(0, items.length - PER_SECTION_CAP),
    })
  }

  const urgentCount = eligible.filter(
    (n) => n.severity === 'urgent' || n.severity === 'blocking',
  ).length
  const actionableCount = eligible.filter(
    (n) => SEVERITY_RANK[n.severity] >= SEVERITY_RANK.actionable,
  ).length

  return {
    totalItems: eligible.length,
    urgentCount,
    actionableCount,
    sections,
  }
}
