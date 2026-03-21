'use client'

import { useState } from 'react'
import { Shield, X, Send } from 'lucide-react'

export function AIAdvisor() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0d1929]">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Advisor</p>
                <p className="text-[10px] text-teal-300">CoverGuard Intelligence</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 bg-gray-50 min-h-[100px]">
            <p className="text-sm text-gray-600">
              Hi! I&apos;m your CoverGuard AI Advisor. Ask me anything about property
              insurability, risk scores, or carrier availability.
            </p>
          </div>
          <div className="flex items-center gap-2 p-3 border-t border-gray-100">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about this property..."
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button className="h-9 w-9 rounded-lg bg-teal-500 hover:bg-teal-400 flex items-center justify-center text-white shrink-0 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-full bg-[#0d1929] hover:bg-[#162438] shadow-xl flex items-center justify-center transition-colors border border-white/10"
        title="AI Advisor"
      >
        <div className="relative flex items-center justify-center">
          <Shield className="h-5 w-5 text-teal-400" />
          <span className="absolute -bottom-1.5 -right-1.5 text-[7px] font-bold text-white/90 leading-none bg-teal-500 rounded px-0.5">
            CG
          </span>
        </div>
      </button>
    </div>
  )
}
