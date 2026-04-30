/**
 * Default {category, severity} per NotificationType.
 *
 * Source of truth for any code path that creates a notification. The DM
 * trigger sets these in the DB directly (see migration
 * 20260430130000_set_notification_severity_category_on_dm.sql); this map
 * exists for application-layer writers added in later PRs (insights
 * detectors, lifecycle nudges, billing events) and for tests.
 *
 * If you add a NotificationType, you MUST add an entry here.
 */

import type {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../types/chat'

export interface NotificationDefaults {
  category: NotificationCategory
  severity: NotificationSeverity
}

export const NOTIFICATION_DEFAULTS: Record<NotificationType, NotificationDefaults> = {
  // User <-> user. A DM expects a response.
  DM:          { category: 'collaborative', severity: 'actionable' },
  // The agent replied to the user; we want them to see it but it's not blocking.
  AGENT_REPLY: { category: 'collaborative', severity: 'info' },
  // Generic system events default to info; raise severity at the call site
  // for things like outages, security alerts, etc.
  SYSTEM:      { category: 'system',        severity: 'info' },
  // Insights are surfaced in their own lane; default to info because not
  // every insight is actionable. PR 8 detectors will set 'actionable' where
  // appropriate.
  INSIGHT:     { category: 'insight',       severity: 'info' },
  // Billing events default to actionable — the user almost always needs to
  // do something (renew, update card, approve charge).
  BILLING:     { category: 'system',        severity: 'actionable' },
  // Lifecycle nudges (welcome, milestone, retention) are info by design.
  LIFECYCLE:   { category: 'lifecycle',     severity: 'info' },
}

/**
 * Compose a notification's metadata with the right defaults.
 * Call sites can override either field; the rest of the schema (title, body,
 * linkUrl, payload, entityType, entityId) is the caller's responsibility.
 */
export function notificationMetaFor(
  type: NotificationType,
  overrides?: Partial<NotificationDefaults>,
): NotificationDefaults {
  const base = NOTIFICATION_DEFAULTS[type]
  return {
    category: overrides?.category ?? base.category,
    severity: overrides?.severity ?? base.severity,
  }
}
