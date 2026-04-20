'use client';

/**
 * Dashboard "Your Agent" panel.
 *
 * Two tabs:
 *  - AI Agent: talk to CoverGuard AI. User turns + assistant replies are
 *    persisted to `agent_chat_messages`, and the reply itself is generated
 *    by the existing /api/advisor/chat endpoint (Anthropic).
 *  - Message Agent: direct user↔user messaging, stored in `direct_messages`.
 *    Recipients get a row in `notifications` via a DB trigger, which the
 *    NotificationBell picks up over Supabase Realtime.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Send, Loader2, Plus } from 'lucide-react';
import type {
  AgentChatMessage,
  AgentChatSession,
  DirectConversationWithPeer,
  DirectMessage,
} from '@coverguard/shared';
import {
  fetchAgentMessages,
  fetchConversations,
  fetchMessages,
  findUserByEmail,
  getOrCreateAgentSession,
  getOrCreateConversation,
  insertAgentMessage,
  markConversationRead,
  nudgeDispatchNotification,
  sendDirectMessage,
  subscribeAgentMessages,
  subscribeDirectMessages,
} from '@/lib/chat';
import { createClient } from '@/lib/supabase/client';

type Tab = 'ai' | 'dm';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function peerDisplayName(peer: DirectConversationWithPeer['peer']): string {
  const full = [peer.firstName, peer.lastName].filter(Boolean).join(' ').trim();
  return full || peer.email;
}

export function HomeBuyerAgentPanel() {
  const [tab, setTab] = useState<Tab>('ai');
  const [meId, setMeId] = useState<string | null>(null);

  // AI state
  const [session, setSession] = useState<AgentChatSession | null>(null);
  const [aiMessages, setAiMessages] = useState<AgentChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // DM state
  const [conversations, setConversations] = useState<DirectConversationWithPeer[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [dmSending, setDmSending] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newModalBusy, setNewModalBusy] = useState(false);
  const [newModalError, setNewModalError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Resolve the current user id once on mount.
  useEffect(() => {
    (async () => {
      const { data } = await createClient().auth.getUser();
      setMeId(data.user?.id ?? null);
    })();
  }, []);

  // ── AI: load session + messages ────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'ai') return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const s = await getOrCreateAgentSession();
        setSession(s);
        const msgs = await fetchAgentMessages(s.id);
        setAiMessages(msgs);
        unsub = subscribeAgentMessages(s.id, (m) =>
          setAiMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m])),
        );
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
    })();
    return () => {
      unsub?.();
    };
  }, [tab]);

  // ── DMs: load conversation list ────────────────────────────────────────
  const refreshConversations = useCallback(async () => {
    try {
      const list = await fetchConversations();
      setConversations(list);
      // Auto-select the top conversation if none is selected yet.
      setActiveConvId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      setDmError(err instanceof Error ? err.message : 'Failed to load conversations');
    }
  }, []);

  useEffect(() => {
    if (tab !== 'dm') return;
    void refreshConversations();
  }, [tab, refreshConversations]);

  // ── DMs: load messages for the active conversation + realtime sub ──────
  useEffect(() => {
    if (tab !== 'dm' || !activeConvId) {
      setDmMessages([]);
      return;
    }
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const msgs = await fetchMessages(activeConvId);
        setDmMessages(msgs);
        await markConversationRead(activeConvId);
        unsub = subscribeDirectMessages(activeConvId, (m) => {
          setDmMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
          // If *we* are the recipient of this message, mark it read immediately since
          // the panel is open; and refresh the conversation list so unread counts update.
          if (meId && m.recipientId === meId) {
            void markConversationRead(activeConvId);
            void refreshConversations();
          }
        });
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Failed to load messages');
      }
    })();
    return () => {
      unsub?.();
    };
  }, [tab, activeConvId, meId, refreshConversations]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, dmMessages, tab]);

  // ── AI: send a message ─────────────────────────────────────────────────
  async function handleSendAi() {
    if (!aiInput.trim() || !session || aiSending) return;
    const content = aiInput.trim();
    setAiInput('');
    setAiSending(true);
    setAiError(null);

    // Optimistic render of the user's turn while we persist/resolve the reply.
    const optimistic: AgentChatMessage = {
      id: `tmp-${Date.now()}`,
      sessionId: session.id,
      userId: '', // filled in by DB
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setAiMessages((prev) => [...prev, optimistic]);

    try {
      // 1. Persist user turn. The realtime subscription will replace the optimistic row.
      await insertAgentMessage({ sessionId: session.id, role: 'user', content });

      // 2. Call the existing advisor/chat endpoint. We send the last ~20 turns
      //    for context, matching the server-side cap.
      const history = [...aiMessages, { ...optimistic, content }]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: history }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { text?: string };
        error?: { message?: string };
      };

      if (!res.ok || !json.success || !json.data?.text) {
        throw new Error(json.error?.message ?? 'AI agent is currently unavailable');
      }

      // 3. Persist assistant reply — realtime will surface it to any other tabs.
      await insertAgentMessage({
        sessionId: session.id,
        role: 'assistant',
        content: json.data.text,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to send message');
      // Keep the optimistic user turn visible so the user can retry.
    } finally {
      setAiSending(false);
    }
  }

  // ── DM: send a message ─────────────────────────────────────────────────
  async function handleSendDm() {
    if (!dmInput.trim() || !activeConvId || dmSending) return;
    const active = conversations.find((c) => c.id === activeConvId);
    if (!active) return;

    const content = dmInput.trim();
    setDmInput('');
    setDmSending(true);
    setDmError(null);

    try {
      const msg = await sendDirectMessage({
        conversationId: activeConvId,
        recipientId: active.peer.id,
        content,
      });
      // Fire-and-forget server nudge to send email + web push to the recipient.
      void nudgeDispatchNotification(msg.id);
      // Refresh conversation previews (lastMessage, ordering).
      void refreshConversations();
    } catch (err) {
      setDmError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setDmSending(false);
    }
  }

  // ── DM: start a new conversation by email ──────────────────────────────
  async function handleStartNewConversation() {
    setNewModalBusy(true);
    setNewModalError(null);
    try {
      const email = newEmail.trim().toLowerCase();
      if (!email) throw new Error('Enter an email address');
      const user = await findUserByEmail(email);
      if (!user) throw new Error('No CoverGuard user with that email');
      if (user.id === meId) throw new Error("You can't message yourself");
      const convId = await getOrCreateConversation(user.id);
      await refreshConversations();
      setActiveConvId(convId);
      setShowNewModal(false);
      setNewEmail('');
    } catch (err) {
      setNewModalError(err instanceof Error ? err.message : 'Could not start conversation');
    } finally {
      setNewModalBusy(false);
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div role="tablist" aria-label="Your Agent" className="flex gap-1 border-b border-gray-200 mb-2">
        <button
          role="tab"
          aria-selected={tab === 'ai'}
          onClick={() => setTab('ai')}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-t ${
            tab === 'ai'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bot size={11} /> AI Agent
        </button>
        <button
          role="tab"
          aria-selected={tab === 'dm'}
          onClick={() => setTab('dm')}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-t ${
            tab === 'dm'
              ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare size={11} /> Message Agent
        </button>
      </div>

      {/* ── AI Agent tab ──────────────────────────────────────────────── */}
      {tab === 'ai' && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
            {aiMessages.length === 0 && (
              <p className="text-[11px] text-gray-400 italic px-1">
                Ask your AI agent about a property, a carrier, or a risk score to get started.
              </p>
            )}
            {aiMessages.map((msg) => {
              const mine = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs rounded-lg px-2.5 py-1.5 ${
                      mine ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className={`text-xs font-medium mb-0.5 ${mine ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {mine ? 'You' : 'CoverGuard AI'}
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-0.5 ${mine ? 'text-indigo-300' : 'text-gray-400'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            {aiSending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {aiError && (
            <p className="text-[11px] text-red-600 mb-1 px-1" role="alert">
              {aiError}
            </p>
          )}
          <div className="flex gap-1.5 border-t pt-2">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendAi()}
              placeholder="Ask your AI agent..."
              disabled={aiSending}
              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              onClick={handleSendAi}
              disabled={aiSending || !aiInput.trim()}
              className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Direct Message tab ───────────────────────────────────────── */}
      {tab === 'dm' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Conversation selector */}
          <div className="flex items-center gap-1 mb-1.5">
            <select
              value={activeConvId ?? ''}
              onChange={(e) => setActiveConvId(e.target.value || null)}
              className="flex-1 text-[11px] border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              aria-label="Select conversation"
            >
              {conversations.length === 0 && <option value="">No conversations yet</option>}
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {peerDisplayName(c.peer)}
                  {c.unreadCount > 0 ? ` (${c.unreadCount})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewModal(true)}
              title="Start a new conversation"
              className="p-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
            {!activeConversation && (
              <p className="text-[11px] text-gray-400 italic px-1">
                Start a conversation to message another CoverGuard user directly. They&apos;ll get
                an in-app, email, and push notification.
              </p>
            )}
            {activeConversation && dmMessages.length === 0 && (
              <p className="text-[11px] text-gray-400 italic px-1">
                No messages yet — say hi to {peerDisplayName(activeConversation.peer)}.
              </p>
            )}
            {dmMessages.map((msg) => {
              const mine = msg.senderId === meId;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs rounded-lg px-2.5 py-1.5 ${
                      mine ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className={`text-xs font-medium mb-0.5 ${mine ? 'text-indigo-200' : 'text-gray-500'}`}>
                      {mine ? 'You' : activeConversation ? peerDisplayName(activeConversation.peer) : 'Them'}
                    </p>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-0.5 ${mine ? 'text-indigo-300' : 'text-gray-400'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          {dmError && (
            <p className="text-[11px] text-red-600 mb-1 px-1" role="alert">
              {dmError}
            </p>
          )}
          <div className="flex gap-1.5 border-t pt-2">
            <input
              type="text"
              value={dmInput}
              onChange={(e) => setDmInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendDm()}
              placeholder={
                activeConversation
                  ? `Message ${peerDisplayName(activeConversation.peer)}...`
                  : 'Pick a conversation to start messaging'
              }
              disabled={!activeConvId || dmSending}
              className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              onClick={handleSendDm}
              disabled={!activeConvId || dmSending || !dmInput.trim()}
              className="px-2.5 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── New-conversation modal ───────────────────────────────────── */}
      {showNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => (!newModalBusy ? setShowNewModal(false) : undefined)}
          role="dialog"
          aria-modal="true"
          aria-label="Start a new conversation"
        >
          <div
            className="bg-white rounded-lg shadow-lg p-4 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-2">New message</h3>
            <label htmlFor="new-conv-email" className="text-xs text-gray-600">
              Recipient email (another CoverGuard user)
            </label>
            <input
              id="new-conv-email"
              type="email"
              autoFocus
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !newModalBusy && handleStartNewConversation()}
              placeholder="agent@example.com"
              className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={newModalBusy}
            />
            {newModalError && (
              <p className="text-[11px] text-red-600 mt-1" role="alert">
                {newModalError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowNewModal(false)}
                disabled={newModalBusy}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleStartNewConversation}
                disabled={newModalBusy || !newEmail.trim()}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {newModalBusy ? 'Starting…' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
