'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import { chatWithAdvisor } from '@/lib/api'

interface Message {
  role: 'user' | 'advisor'
  text: string
}

const SUGGESTED_QUESTIONS = [
  'What does a flood risk score of 72 mean?',
  'Which carriers write in high-fire-risk zones?',
  'What is a surplus lines carrier?',
  'How do I explain insurance risk to a buyer?',
]

const WELCOME_MESSAGE: Message = {
  role: 'advisor',
  text: "Hi! I'm your CoverGuard AI Advisor. I can help with flood zones, fire risk, carrier availability, insurability scores, surplus lines, FAIR Plans, earthquake coverage, and more. Try a suggested question or ask anything.",
}

export function AIAdvisor() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  const handleSend = useCallback(async (text?: string) => {
    const input = (text ?? message).trim()
    if (!input || thinking) return
    setMessage('')

    const userMessage: Message = { role: 'user', text: input }
    setMessages((prev) => [...prev, userMessage])
    setThinking(true)

    try {
      // Build conversation history for the API (skip welcome message)
      const history = messages
        .filter((_, i) => i > 0) // skip welcome
        .map((m) => ({
          role: m.role === 'user' ? 'user' as const : 'assistant' as const,
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
      } else if (errorMessage.includes('not configured') || errorMessage.includes('authentication') || errorMessage.includes('API key')) {
        displayMessage = 'The AI Advisor service is not available right now. Please contact support if this persists.'
      } else if (errorMessage.includes('Network error') || errorMessage.includes('timed out')) {
        displayMessage = 'Could not reach the AI service. Please check your connection and try again.'
      } else {
        displayMessage = 'Sorry, I couldn\'t get a response right now. Please try again in a moment.'
      }
      setMessages((prev) => [...prev, { role: 'advisor', text: displayMessage }])
    } finally {
      setThinking(false)
    }
  }, [message, messages, thinking])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 w-[420px] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: '720px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0d1929] shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Advisor</p>
                <p className="text-[10px] text-teal-300">Powered by Claude</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-[300px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'advisor' && (
                  <div className="h-6 w-6 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <CoverGuardShield className="h-3 w-3" />
                  </div>
                )}
                <div
                  className={`max-w-[320px] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#0d1929] text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-700 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.text.split('**').map((part, j) =>
                    j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                  )}
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

          {/* Suggested questions — only on first message */}
          {messages.length === 1 && (
            <div className="px-3 pt-2 pb-1 bg-gray-50 shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Suggested
              </p>
              <div className="flex flex-col gap-1">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-left text-[11px] text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white shrink-0">
            <input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about insurability…"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-teal-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={!message.trim() || thinking}
              className="h-9 w-9 rounded-lg bg-teal-500 hover:bg-teal-400 disabled:opacity-40 flex items-center justify-center text-white shrink-0 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="h-16 w-16 rounded-full bg-[#0d1929] hover:bg-[#162438] shadow-2xl flex items-center justify-center transition-all hover:scale-105 border-2 border-teal-500/30"
        title="AI Advisor"
        aria-label="Open AI Advisor"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <div className="relative flex items-center justify-center">
          <CoverGuardShield className="h-8 w-8" />
          <span className="absolute -bottom-2 -right-2 text-[9px] font-bold text-white leading-none bg-teal-500 rounded-md px-1 py-0.5 shadow-sm">
            AI
          </span>
        </div>
      </button>
    </div>
  )
}
