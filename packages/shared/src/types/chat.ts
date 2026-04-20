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

export type NotificationType = 'DM' | 'AGENT_REPLY' | 'SYSTEM'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  linkUrl: string | null
  payload: Record<string, unknown>
  readAt: string | null
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
