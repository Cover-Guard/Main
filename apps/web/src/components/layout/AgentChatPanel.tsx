'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Send, Sparkles, RefreshCw } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { chatWithAdvisor } from '@/lib/api'
import { useAgentDrawer } from './AgentDrawerContext'

/**
 * Right-side AI Agent drawer content.
 *
 * Reuses the AIAdvisor chat infrastructure (`chatWithAdvisor` against
 * /api/advisor/chat) so the same model + prompt that powers the bottom-right
 * floating bot also powers this drawer — no second pipeline to maintain.
 *
 * On top of the chat, this panel layers a few proactive behaviors:
 *
 *  1. **Page-aware suggested questions.** The "Suggested for this page"
 *     chips swap based on `usePathname()`. The agent meets the user where
 *     they are: dashboard prompts on `/dashboard`, address-lookup prompts on
 *     `/check`, etc.
 *
 *  2. **Insight on route change.** When the user navigates to a new top-level
 *     route, the agent surfaces a one-line tip in the chat itself ("💡 …"),
 *     so it acts like a proactive assistant rather than a passive Q&A box.
 *
 *  3. **Context-grounded user turns.** Each user message is silently prefixed
 *     with "[Context: user is currently on /<route>.]" before being sent,
 *     so the model can ground its answer in what the user is doing.
 *
 * Polish wins layered on top to make the experience feel seamless:
 *
 *  - **Persistence** across page reloads and drawer toggles via localStorage
 *    (versioned key, fails open if storage isn't available).
 *  - **Auto-focus** on the input whenever the drawer opens.
 *  - **Smart auto-scroll** — only follows new messages when the user is
 *    already near the bottom; respects manual scroll-up.
 *  - **New chat reset** button in the header.
 *  - **Disabled chips** while a request is in flight so a frantic clicker
 *    can't fire two requests in parallel.
 */

type Message = { role: 'user' | 'advisor'; text: string }

const STORAGE_KEY = 'cg_agent_chat_v1'
const STORAGE_LIMIT = 100 // cap stored history to keep localStorage tidy

const WELCOME: Message = {
  role: 'advisor',
  text:
    "Hi! I'm your CoverGuard AI Agent. I'll keep an eye on what you're working on and surface insights as you go. Ask me anything about flood zones, fire risk, carriers, FAIR Plans, or the property you're looking at.",
}

// Page-specific suggestions. Falls back to GENERAL when no prefix matches.
const PAGE_SUGGESTIONS: Record<string, string[]> = {
  '/dashboard/help': [
    'How do I add a new property?',
    'How do exits affect my carrier list?',
    'How are insurability scores calculated?',
    'How do I share a report with my client?',
  ],
  '/dashboard': [
    'What changed across my portfolio in the last 30 days?',
    'Which of my properties has the highest risk score right now?',
    'Where am I most exposed to wildfire risk?',
    'Draft a weekly client update from my dashboard data.',
  ],
  '/check': [
    'What does a flood risk score of 72 mean?',
    'Which carriers write in high-fire-risk zones?',
    'How do I read this insurability score?',
    'What disclosures should I share with a buyer in this area?',
  ],
  '/toolkit': [
    'How do I explain risk to a first-time buyer?',
    'Generate a one-page risk summary I can send to a client.',
    "What's the difference between admitted and surplus lines?",
    'Build a script for an insurability conversation.',
  ],
  '/help': [
    'How do I add a new property?',
    'How do exits affect my carrier list?',
    'How are insurability scores calculated?',
    'How do I share a report with my client?',
  ],
  '/account': [
    'How do I update my notification preferences?',
    'What does my plan include?',
    'How do I add a teammate to my workspace?',
  ],
}

const GENERAL_SUGGESTIONS = [
  'What does a flood risk score of 72 mean?',
  'Which carriers write in high-fire-risk zones?',
  'What is a surplus lines carrier?',
  'How do I explain insurance risk to a buyer?',
]

function pickSuggestions(pathname: string): string[] {
  for (const [prefix, qs] of Object.entries(PAGE_SUGGESTIONS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return qs
  }
  return GENERAL_SUGGESTIONS
}

// Pro-active tip the agent volunteers when the user lands on a top-level route.
function pageInsight(pathname: string): string | null {
  if (pathname.startsWith('/dashboard/help'))
    return "Ask me how anything in CoverGuard works — I'll explain it without sending you to docs."
  if (pathname.startsWith('/dashboard'))
    return "I'm watching your portfolio — ask me to flag what changed since your last visit, or to surface your highest-risk property."
  if (pathname.startsWith('/check'))
    return 'Tell me an address and I can pull insurer availability, flood/fire scores, and a buyer-friendly summary.'
  if (pathname.startsWith('/toolkit'))
    return 'I can draft client-ready one-pagers, comparison tables, and talking-point scripts from any property in your account.'
  if (pathname.startsWith('/help'))
    return "Ask me how anything in CoverGuard works — I'll explain it without sending you to docs."
  if (pathname.startsWith('/account'))
    return 'I can walk you through plan settings, billing, and team access if you tell me what you want to change.'
  return null
}

// Bucket pathname into a top-level route key so we don't fire a new insight for
// every nested route (e.g. /dashboard/foo/bar shouldn't re-prompt).
function routeKey(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0] ?? ''
  return '/' + seg
}

function formatAdvisorText(text: string) {
  // Lightweight bold rendering — same convention AIAdvisor uses.
  return text.split('**').map((part, j) =>
    j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>,
  )
}

// --- Persistence helpers ----------------------------------------------------
// Stored shape is intentionally tiny — `{ messages: Message[], seenRoutes:
// string[] }`. The version is encoded in the key itself (STORAGE_KEY) so a
// future shape change just bumps the suffix and orphans the old payload.

type StoredChat = { messages: Message[]; seenRoutes: string[] }

function loadStored(): StoredChat | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredChat>
    if (!parsed || !Array.isArray(parsed.messages)) return null
    return {
      messages: parsed.messages.filter(
        (m): m is Message =>
          !!m &&
          (m.role === 'user' || m.role === 'advisor') &&
          typeof m.text === 'string',
      ),
      seenRoutes: Array.isArray(parsed.seenRoutes) ? parsed.seenRoutes : [],
    }
  } catch {
    // localStorage unavailable (private mode, sandboxed iframe) or payload
    // corrupt — fall back to a fresh session, never crash the chat.
    return null
  }
}

function saveStored(chat: StoredChat) {
  if (typeof window === 'undefined') return
  try {
    const trimmed: StoredChat = {
      messages: chat.messages.slice(-STORAGE_LIMIT),
      seenRoutes: chat.seenRoutes,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // Quota exceeded or storage disabled — silently skip persistence.
  }
}

function clearStored() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function AgentChatPanel() {
  const pathname = usePathname() ?? '/'
  const { agentOpen } = useAgentDrawer()

  // Hydrate from localStorage on mount. We deliberately initialize with the
  // welcome message so SSR/first-render output is stable; the localStorage
  // payload is loaded in useEffect to avoid hydration mismatch warnings.
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [hydrated, setHydrated] = useState(false)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Track which top-level route we've already offered an insight for, so a
  // user toggling the drawer or moving within a section doesn't get spammed.
  // Backed by localStorage so the "seen this tip" set survives reloads too.
  const insightSeenRef = useRef<Set<string>>(new Set())

  // ── Hydration: load saved chat once on mount ────────────────────────
  useEffect(() => {
    const stored = loadStored()
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(stored.messages.length ? stored.messages : [WELCOME])
      insightSeenRef.current = new Set(stored.seenRoutes)
    }
    setHydrated(true)
  }, [])

  // ── Persistence: save chat whenever it changes (post-hydration) ─────────
  useEffect(() => {
    if (!hydrated) return
    saveStored({
      messages,
      seenRoutes: Array.from(insightSeenRef.current),
    })
  }, [messages, hydrated])

  // ── Pro-active route insight ─────────────────────────────────
  // Surface a fresh contextual insight when the user enters a new top-level
  // route. We only fire once per route-key per persisted history. The
  // cascading render is intentional here — it's the whole point of the
  // proactive behavior — so we silence the project's lint, same pattern
  // SidebarLayout uses for its hydration-safe localStorage read.
  useEffect(() => {
    if (!hydrated) return
    const key = routeKey(pathname)
    if (insightSeenRef.current.has(key)) return
    const tip = pageInsight(pathname)
    if (!tip) return
    insightSeenRef.current.add(key)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages((prev) => [...prev, { role: 'advisor', text: `💡 ${tip}` }])
  }, [pathname, hydrated])

  // ── Smart auto-scroll ───────────────────────────────────────
  // Only follow new messages if the user is already near the bottom — if
  // they've scrolled up to re-read history, don't yank them back down.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, thinking])

  // ── Auto-focus input when drawer opens ──────────────────────────
  // A short timeout lets the slide-in animation finish so the focus ring
  // doesn't visually jump.
  useEffect(() => {
    if (!agentOpen) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [agentOpen])

  const send = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim()
      if (!content || thinking) return
      setInput('')

      const userMsg: Message = { role: 'user', text: content }
      setMessages((prev) => [...prev, userMsg])
      setThinking(true)

      try {
        // Build conversation history for the API — skip the welcome and any
        // pure-tip insight messages so the model isn't confused by them.
        const history = messages
          .filter((m, i) => i > 0 && !m.text.startsWith('💡'))
          .map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          }))
        // Augment the latest user turn with a short page-context note so the
        // model can ground its answer in what the user is currently doing.
        const contextNote = `[Context: user is currently on ${pathname}.]`
        history.push({
          role: 'user',
          content: `${contextNote}\n\n${content}`,
        })

        const response = await chatWithAdvisor(history)
        setMessages((prev) => [...prev, { role: 'advisor', text: response.text }])
      } catch (err) {
        const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
        const msg = err instanceof Error ? err.message : ''
        let display: string
        if (errorCode === 'FREE_LIMIT_REACHED') {
          // Hard server-side cap on Free plan — surface the upgrade path.
          display = "You've used all 5 of your free AI Agent interactions. [Upgrade to a paid plan](/pricing) for unlimited access."
        } else if (msg.includes('rate limit') || msg.includes('busy')) {
          display = 'The AI Agent is temporarily busy. Please wait a moment and try again.'
        } else if (msg.includes('not configured') || msg.includes('authentication') || msg.includes('API key')) {
          display = 'The AI Agent service is not available right now. Please contact support if this persists.'
        } else if (msg.includes('Network error') || msg.includes('timed out')) {
          display = 'Could not reach the AI service. Please check your connection and try again.'
        } else {
          display = "Sorry, I couldn't get a response right now. Please try again in a moment."
        }
        setMessages((prev) => [...prev, { role: 'advisor', text: display }])
      } finally {
        setThinking(false)
      }
    },
    [input, messages, pathname, thinking],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ── New chat reset ────────────────────────────────────────
  // Clear in-memory state, wipe persisted history, and reset the seen-routes
  // set so the user immediately sees a fresh insight for whatever page they
  // happen to be on. We re-add the current route to seen so we don't double-
  // fire (the next render's effect will re-detect it as "new" otherwise).
  const resetChat = useCallback(() => {
    if (thinking) return
    insightSeenRef.current = new Set()
    clearStored()
    setMessages([WELCOME])
    setInput('')
    inputRef.current?.focus()
  }, [thinking])

  // Show suggested-question chips while the chat is still short — once the
  // user has actually had a back-and-forth, hide them so they don't crowd
  // the input.
  const showSuggestions = useMemo(
    () => messages.filter((m) => m.role === 'user').length === 0,
    [messages],
  )
  const suggestions = pickSuggestions(pathname)

  return (
    <div className="flex flex-col h-full">
      {/* Inline header — title sits over in SidebarLayout's drawer chrome,
          but the "New chat" reset belongs with the chat itself so users
          don't have to chase it. */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 bg-white flex-shrink-0">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          {messages.length > 1 ? `${messages.length - 1} messages` : 'New conversation'}
        </span>
        <button
          onClick={resetChat}
          disabled={thinking || messages.length <= 1}
          title="Start a new conversation"
          aria-label="Start a new conversation"
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw size={11} />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'advisor' && (
              <div className="h-6 w-6 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <CoverGuardShield className="h-3 w-3" />
              </div>
            )}
            <div
              className={`max-w-[280px] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0d1929] text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-700 rounded-tl-sm shadow-sm'
              }`}
            >
              {formatAdvisorText(msg.text)}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="h-6 w-6 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mr-2 mt-0.5">
              <CoverGuardShield className="h-3 w-3" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Page-aware suggested questions */}
      {showSuggestions && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex-shrink-0">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles size={10} className="text-teal-500" /> Suggested for this page
          </p>
          <div className="flex flex-col gap-1">
            {suggestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={thinking}
                className="text-left text-[11px] text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about insurability…"
          disabled={thinking}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || thinking}
          className="h-9 w-9 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 flex items-center justify-center text-white shrink-0 transition-colors"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
