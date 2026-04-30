/**
 * Display copy for the notification inbox.
 *
 * Centralised so the bell, future preferences page (PR 6), digest email
 * (PR 11), and any test snapshot read from one source. Avoids the trap of
 * "the bell says one thing, the email says another" that low-leverage
 * surfaces tend to drift into.
 */

import type {
  NotificationCategory,
  NotificationSeverity,
} from '../types/chat'

/** Short, sentence-case label for a category. Used in inbox section headers. */
export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  collaborative: 'Conversations',
  insight: 'Insights',
  system: 'System',
  lifecycle: 'Tips',
  transactional: 'Activity',
}

/**
 * One-line explanation that answers "why am I seeing this?" Surfaced as a
 * tooltip on each notification item. Designed to be readable on its own;
 * the tooltip does not depend on context.
 */
export const CATEGORY_REASON: Record<NotificationCategory, string> = {
  collaborative:
    'Sent because someone interacted with you (a message, mention, or assignment).',
  insight:
    'Sent because CoverGuard detected something worth your attention.',
  system:
    'Sent by CoverGuard about your account, billing, or platform updates.',
  lifecycle:
    'Sent to help you get the most out of CoverGuard.',
  transactional:
    'A confirmation that an action you took completed.',
}

/** Stable display order in the All tab. Most relevant categories first. */
export const CATEGORY_DISPLAY_ORDER: ReadonlyArray<NotificationCategory> = [
  'collaborative',
  'insight',
  'system',
  'lifecycle',
  'transactional',
]

/**
 * Tailwind class fragment for a small severity dot. Returned as a class
 * string so the bell can compose it without re-importing tailwind config.
 */
export function severityDotClass(severity: NotificationSeverity): string {
  switch (severity) {
    case 'urgent':
    case 'blocking':
      return 'bg-red-500'
    case 'actionable':
      return 'bg-indigo-600'
    case 'info':
    default:
      return 'bg-gray-300'
  }
}

/** Human label per severity, useful for tooltips and accessibility. */
export const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: 'Info',
  actionable: 'Action needed',
  urgent: 'Urgent',
  blocking: 'Blocking',
}
