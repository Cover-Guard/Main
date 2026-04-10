'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { chatWithAdvisor } from '@/lib/api'

interface Message {
  role: 'user' | 'advisor'
  text: string
}

const SUGGESTED_QUESTIONS = [
  'How do I run my first property search?',
  'What does a flood risk score of 72 mean?',
  'Which carriers write in high-fire-risk zones?',
  'How do I share a report with a client?',
  'What is a surplus lines carrier?',
  'How do I export my insurability report as a PDF?',
]

const WELCOME_MESSAGE: Message = {
  role: 'advisor',
  text: "Hi! I'm the CoverGuard AI Advisor — your first stop for help. Ask me anything about using CoverGuard, understanding a risk score, finding carriers, or navigating the platform. I'll point you in the right direction.",
}

/**
 * Inline AI Advisor panel used as the primary helper on the Help page.
 * Larger and always-visible variant of the floating AIAdvisor widget,
 * but shares the same `/api/advisor/chat` backend via `chatWithAdvisor`.
 */
export function HelpAdvisorPanel() {
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const handleSend = useCallback(
    async (text?: string) => {
      const input = (text ?? message).trim()
      if (!input || thinking) return
      setMessage('')

      const userMessage: Message = { role: 'user', text: input }
      setMessages((prev) => [...prev, userMessage])
      setThinking(true)

      try {
        const history = messages
          .filter((_, i) => i > 0) // skip welcome
          .map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          }))
        history.push({ role: 'user', content: input })

        const response = await chatWithAdvisor(history)
        setMessages((prev) => [...prev, { role: 'advisor', text: response.text }])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : ''
        let displayMessage: string
        if (errorMessage.includes('rate limit') || errorMessage.includes('busy')) {
          displayMessage = 'The AI Advisor is temporarily busy. Please wait a moment and try again.'
        } else if (
          errorMessage.includes('not configured') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('API key')
        ) {
          displayMessage =
            'The AI Advisor service is not available right now. Please use the contact form below and our team will help.'
        } else if (errorMessage.includes('Network error') || errorMessage.includes('timed out')) {
          displayMessage = 'Could not reach the AI service. Please check your connection and try again.'
        } else {
          displayMessage = "Sorry, I couldn't get a response right now. Please try again in a moment."
        }
        setMessages((prev) => [...prev, { role: 'advisor', text: displayMessage }])
      } finally {
        setThinking(false)
      }
    },
    [message, messages, thinking],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-[#0d1929]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-teal-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">AI Advisor</p>
            <p className="text-xs text-teal-300">Your first stop for help · Powered by Claude</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 px-2.5 py-1 text-[11px] font-medium text-teal-300 border border-teal-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
          Online
        </span>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50"
        style={{ minHeight: 380, maxHeight: 520 }}
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'advisor' && (
              <div className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <CoverGuardShield className="h-4 w-4" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0d1929] text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-700 rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.text.split('**').map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mr-2 mt-0.5">
              <CoverGuardShield className="h-4 w-4" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions — only on first message */}
      {messages.length === 1 && (
        <div className="px-5 pt-3 pb-2 bg-gray-50 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Try one of these
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="text-left text-xs text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg px-3 py-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-4 border-t border-gray-100 bg-white">
        <input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI Advisor a question…"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-4 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          aria-label="Ask the AI Advisor a question"
        />
        <button
          onClick={() => handleSend()}
          disabled={!message.trim() || thinking}
          className="h-10 w-10 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 flex items-center justify-center text-white shrink-0 transition-colors"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
