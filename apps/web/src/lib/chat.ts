/**
 * Client-side data access for the two chat surfaces exposed on the Dashboard:
 *
 *  1. Agent chat (AI)        — persisted in `agent_chat_sessions` / `agent_chat_messages`.
 *                              Sending a user turn also calls the existing
 *                              /api/advisor/chat endpoint to generate a reply.
 *  2. Direct messages (DMs) — persisted in `direct_conversations` / `direct_messages`.
 *                              Inserts fire the `handle_new_direct_message` trigger
 *                              which writes a row to `notifications` for the recipient.
 *
 * All reads/writes go through the Supabase anon client and are gated by RLS,
 * so the only way to see or write another user's chat is to *be* that user.
 */

import type {
  AgentChatMessage,
  AgentChatSession,
  AppNotification,
  DirectConversationWithPeer,
  DirectMessage,
  NotificationMute,
  UserNotificationPreferences,
} from '@coverguard/shared'
import { createClient } from './supabase/client'

// ─── Agent (AI) chat ──────────────────────────────────────────────────────

/**
 * Returns (creating if necessary) the user's primary agent-chat session.
 * Each user gets a single long-running session unless we later add tabs.
 */
export async function getOrCreateAgentSession(): Promise<AgentChatSession> {
  const sb = createClient()
  const { data: userRes } = await sb.auth.getUser()
  const userId = userRes.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data: existing, error: fetchErr } = await sb
    .from('agent_chat_sessions')
    .select('*')
    .eq('userId', userId)
    .order('updatedAt', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (fetchErr) throw fetchErr
  if (existing) return existing as AgentChatSession

  const { data: inserted, error: insertErr } = await sb
    .from('agent_chat_sessions')
    .insert({ userId, title: 'Your Agent' })
    .select('*')
    .single()
  if (insertErr) throw insertErr
  return inserted as AgentChatSession
}

export async function fetchAgentMessages(sessionId: string): Promise<AgentChatMessage[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('agent_chat_messages')
    .select('*')
    .eq('sessionId', sessionId)
    .order('createdAt', { ascending: true })
  if (error) throw error
  return (data ?? []) as AgentChatMessage[]
}

export async function insertAgentMessage(input: {
  sessionId: string
  role: 'user' | 'assistant'
  content: string
}): Promise<AgentChatMessage> {
  const sb = createClient()
  const { data: userRes } = await sb.auth.getUser()
  const userId = userRes.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await sb
    .from('agent_chat_messages')
    .insert({
      sessionId: input.sessionId,
      userId,
      role: input.role,
      content: input.content,
    })
    .select('*')
    .single()
  if (error) throw error

  // Bump the session's updatedAt so it sorts correctly in lists.
  await sb
    .from('agent_chat_sessions')
    .update({ updatedAt: new Date().toISOString() })
    .eq('id', input.sessionId)

  return data as AgentChatMessage
}

/**
 * Subscribe to realtime inserts for this session's AI chat. Use this to live-update
 * the UI when the assistant reply lands.
 */
export function subscribeAgentMessages(
  sessionId: string,
  onInsert: (msg: AgentChatMessage) => void,
): () => void {
  const sb = createClient()
  const channel = sb
    .channel(`agent_chat_messages:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'agent_chat_messages',
        filter: `sessionId=eq.${sessionId}`,
      },
      (payload) => onInsert(payload.new as AgentChatMessage),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}

// ─── Direct messages (user ↔ user) ────────────────────────────────────────

/**
 * Returns every conversation this user participates in, with peer info and an
 * unread count. Used to render the DM inbox.
 */
export async function fetchConversations(): Promise<DirectConversationWithPeer[]> {
  const sb = createClient()
  const { data: userRes } = await sb.auth.getUser()
  const me = userRes.user?.id
  if (!me) throw new Error('Not authenticated')

  // Two queries: threads + any counterpart users in one batch.
  const { data: convos, error: convErr } = await sb
    .from('direct_conversations')
    .select('*')
    .order('lastMessageAt', { ascending: false, nullsFirst: false })
  if (convErr) throw convErr

  const peerIds = Array.from(
    new Set((convos ?? []).map((c) => (c.userAId === me ? c.userBId : c.userAId))),
  )
  if (peerIds.length === 0) return []

  const [{ data: peers, error: peersErr }, { data: unreadRows, error: unreadErr }] =
    await Promise.all([
      sb
        .from('users')
        .select('id,firstName,lastName,email,role,avatarUrl')
        .in('id', peerIds),
      sb
        .from('direct_messages')
        .select('conversationId')
        .eq('recipientId', me)
        .is('readAt', null),
    ])
  if (peersErr) throw peersErr
  if (unreadErr) throw unreadErr

  const peerById = new Map((peers ?? []).map((p) => [p.id as string, p]))
  const unreadByConv = new Map<string, number>()
  ;(unreadRows ?? []).forEach((r: { conversationId: string }) => {
    unreadByConv.set(r.conversationId, (unreadByConv.get(r.conversationId) ?? 0) + 1)
  })

  return (convos ?? []).map((c) => {
    const peerId = c.userAId === me ? c.userBId : c.userAId
    const peer = peerById.get(peerId) ?? {
      id: peerId,
      firstName: null,
      lastName: null,
      email: 'unknown',
      role: 'UNKNOWN',
      avatarUrl: null,
    }
    return {
      ...(c as Record<string, unknown>),
      peer,
      unreadCount: unreadByConv.get(c.id) ?? 0,
    } as DirectConversationWithPeer
  })
}

/** Look up a user by email — used when starting a fresh conversation. */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('users')
    .select('id,email')
    .ilike('email', email.trim())
    .maybeSingle()
  if (error) throw error
  return (data as { id: string; email: string } | null) ?? null
}

/**
 * Ensures a conversation exists between the current user and `otherUserId` and
 * returns its ID. Thin wrapper around the `get_or_create_direct_conversation`
 * SQL helper — the SQL is authoritative so the canonical userA < userB
 * invariant is enforced in one place.
 */
export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const sb = createClient()
  const { data, error } = await sb.rpc('get_or_create_direct_conversation', {
    p_other_user: otherUserId,
  })
  if (error) throw error
  if (!data) throw new Error('Failed to create conversation')
  return data as string
}

export async function fetchMessages(conversationId: string): Promise<DirectMessage[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('direct_messages')
    .select('*')
    .eq('conversationId', conversationId)
    .order('createdAt', { ascending: true })
  if (error) throw error
  return (data ?? []) as DirectMessage[]
}

export async function sendDirectMessage(input: {
  conversationId: string
  recipientId: string
  content: string
}): Promise<DirectMessage> {
  const sb = createClient()
  const { data: userRes } = await sb.auth.getUser()
  const senderId = userRes.user?.id
  if (!senderId) throw new Error('Not authenticated')

  const { data, error } = await sb
    .from('direct_messages')
    .insert({
      conversationId: input.conversationId,
      senderId,
      recipientId: input.recipientId,
      content: input.content,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as DirectMessage
}

/**
 * Mark every message in a conversation as read for the current user (i.e.
 * messages where they are the recipient). Idempotent.
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  const sb = createClient()
  const { data: userRes } = await sb.auth.getUser()
  const me = userRes.user?.id
  if (!me) return

  await sb
    .from('direct_messages')
    .update({ readAt: new Date().toISOString() })
    .eq('conversationId', conversationId)
    .eq('recipientId', me)
    .is('readAt', null)
}

export function subscribeDirectMessages(
  conversationId: string,
  onInsert: (msg: DirectMessage) => void,
): () => void {
  const sb = createClient()
  const channel = sb
    .channel(`direct_messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `conversationId=eq.${conversationId}`,
      },
      (payload) => onInsert(payload.new as DirectMessage),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}

// ─── Notifications ────────────────────────────────────────────────────────

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const sb = createClient()
  await sb
    .from('notifications')
    .update({ readAt: new Date().toISOString() })
    .in('id', ids)
    .is('readAt', null)
}

export async function markAllNotificationsRead(): Promise<void> {
  const sb = createClient()
  const { data: userRes } = await sb.auth.getUser()
  const me = userRes.user?.id
  if (!me) return
  await sb
    .from('notifications')
    .update({ readAt: new Date().toISOString() })
    .eq('userId', me)
    .is('readAt', null)
}

export function subscribeNotifications(
  userId: string,
  onInsert: (n: AppNotification) => void,
): () => void {
  const sb = createClient()
  const channel = sb
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `userId=eq.${userId}`,
      },
      (payload) => onInsert(payload.new as AppNotification),
    )
    .subscribe()
  return () => {
    void sb.removeChannel(channel)
  }
}

// ─── Server-side nudge (email + web push) ─────────────────────────────────

/**
 * After inserting a direct_message, call this to trigger email + web push fan-out
 * on the API side. The API validates that the caller actually sent the message
 * before dispatching.
 *
 * This is "best-effort" — the notification row is already committed in the DB
 * by the trigger, so the recipient still gets the in-app notification even if
 * this call fails (e.g. because the user closed the tab during sending).
 */
export async function nudgeDispatchNotification(messageId: string): Promise<void> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) return

  try {
    await fetch('/api/notifications/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messageId }),
      keepalive: true,
    })
  } catch {
    // Non-fatal: the in-app notification is already persisted by the DB trigger.
  }
}

/**
 * Mute notifications for a specific (entityType, entityId) tuple. Optimistic;
 * the caller can fire-and-forget. The trigger short-circuits future inserts
 * for muted threads, so already-existing notifications are unaffected.
 *
 * Throws on network failure so callers can surface a toast.
 */
export async function muteEntity(input: {
  entityType: string
  entityId: string
  /** Optional ISO timestamp; omit for an indefinite mute. */
  expiresAt?: string
}): Promise<void> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/notifications/mute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Mute failed (${res.status}): ${txt.slice(0, 200)}`)
  }
}

/**
 * Remove a mute. Idempotent — deleting a non-existent mute is a no-op
 * server-side. Throws on network failure for symmetry with `muteEntity`.
 */
export async function unmuteEntity(input: {
  entityType: string
  entityId: string
}): Promise<void> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const params = new URLSearchParams({
    entityType: input.entityType,
    entityId: input.entityId,
  })
  const res = await fetch(`/api/notifications/mute?${params.toString()}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Unmute failed (${res.status}): ${txt.slice(0, 200)}`)
  }
}

// ─── Notification preferences (PR 6) ─────────────────────────────────────

/**
 * Read the current user's notification preferences. The server returns
 * defaults when the user has no row, so callers can render immediately.
 */
export async function fetchNotificationPreferences(): Promise<UserNotificationPreferences> {
  const sb = createClient()
  const { data: sessionData } = await sb.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/notifications/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Read prefs failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const json = (await res.json()) as { success: true; data: UserNotificationPreferences }
  return json.data
}

/**
 * Partial update of preferences. Send only the fields you're changing — the
 * server merges with the existing row (or defaults if none) to keep
 * unspecified fields intact.
 */
export async function updateNotificationPreferences(
  patch: Partial<
    Pick<
      UserNotificationPreferences,
      | 'channels'
      | 'digestEnabled'
      | 'digestHourLocal'
      | 'quietHoursStart'
      | 'quietHoursEnd'
      | 'timezone'
    >
  >,
): Promise<UserNotificationPreferences> {
  const sb = createClient()
  const { data: sessionData } = await sb.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/notifications/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Update prefs failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const json = (await res.json()) as { success: true; data: UserNotificationPreferences }
  return json.data
}

/**
 * List the caller's active (non-expired) mutes. Used by the preferences page
 * to render the "Muted threads" section with an unmute button per row.
 */
export async function fetchActiveMutes(): Promise<NotificationMute[]> {
  const sb = createClient()
  const { data: sessionData } = await sb.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Not authenticated')

  const res = await fetch('/api/notifications/mutes', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`List mutes failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const json = (await res.json()) as { success: true; data: NotificationMute[] }
  return json.data
}
