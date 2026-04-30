/**
 * Chat + messaging types shared by web + api.
 *
 * Two surfaces:
 *  - Agent chat (AI): an authenticated user talking to CoverGuard AI.
 *  - Direct messages: two users talking to each other (buyer ↔ agent, etc.)
 */

export type AgentMessageRole = 'user' | 'assistant' | 'system'

export interface AgentChatSession {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface AgentChatMessage {
  id: string
  sessionId: string
  userId: string
  role: AgentMessageRole
  content: string
  createdAt: string
}

export interface DirectConversation {
  id: string
  userAId: string
  userBId: string
  lastMessageAt: string | null
  lastMessageText: string | null
  createdAt: string
}

export interface DirectConversationWithPeer extends DirectConversation {
  /** The OTHER party in the conversation (from the current user's perspective). */
  peer: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
    role: string
    avatarUrl: string | null
  }
  /** Count of unread messages where the current user is the recipient. */
  unreadCount: number
}

export interface DirectMessage {
  id: string
  conversationId: string
  senderId: string
  recipientId: string
  content: string
  readAt: string | null
  createdAt: string
}

// Notifications ────────────────────────────────────────────────────────────
//
// Mirrors the DB enums defined in
// supabase/migrations/20260430120000_add_notification_taxonomy_and_prefs.sql
// Anything added here MUST be added to that enum (or a follow-up migration)
// or writes will fail at the DB.

export type NotificationType =
  | 'DM'
  | 'AGENT_REPLY'
  | 'SYSTEM'
  | 'INSIGHT'
  | 'BILLING'
  | 'LIFECYCLE'

export type NotificationSeverity = 'info' | 'actionable' | 'urgent' | 'blocking'

export type NotificationCategory =
  | 'transactional'
  | 'collaborative'
  | 'insight'
  | 'system'
  | 'lifecycle'

/** Subset of severities that should drive the badge count + toast. */
export const ACTIONABLE_SEVERITIES: ReadonlyArray<NotificationSeverity> = [
  'actionable',
  'urgent',
  'blocking',
]

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  severity: NotificationSeverity
  category: NotificationCategory
  title: string
  body: string | null
  linkUrl: string | null
  payload: Record<string, unknown>
  entityType: string | null
  entityId: string | null
  readAt: string | null
  dismissedAt: string | null
  createdAt: string
}

export interface NotificationChannelPrefs {
  inApp: boolean
  email: boolean
  push: boolean
}

export type NotificationChannelMatrix = Record<NotificationCategory, NotificationChannelPrefs>

export interface UserNotificationPreferences {
  userId: string
  channels: NotificationChannelMatrix
  digestEnabled: boolean
  digestHourLocal: number
  quietHoursStart: number | null
  quietHoursEnd: number | null
  timezone: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: Omit<
  UserNotificationPreferences,
  'userId' | 'createdAt' | 'updatedAt'
> = {
  channels: {
    transactional: { inApp: true, email: false, push: false },
    collaborative: { inApp: true, email: true, push: true },
    insight: { inApp: true, email: true, push: false },
    system: { inApp: true, email: true, push: true },
    lifecycle: { inApp: true, email: true, push: false },
  },
  digestEnabled: true,
  digestHourLocal: 9,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: 'UTC',
}

export interface NotificationMute {
  id: string
  userId: string
  entityType: string
  entityId: string
  expiresAt: string | null
  createdAt: string
}

export interface PushSubscriptionRecord {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
  createdAt: string
}
