'use client'

import { useState, useRef, useEffect } from 'react'
import { Shield, X, Send, Sparkles } from 'lucide-react'

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

const STATIC_RESPONSES: Record<string, string> = {
  flood: `A **flood risk score** of 72 indicates elevated risk. Properties with scores above 60 are typically in or near FEMA Special Flood Hazard Areas (SFHAs). You should expect lender-required NFIP coverage and limited private market options. Scores above 80 indicate high annual flood probability (1%+).`,
  fire: `In high-fire-risk zones, carriers like **State Farm, Allstate, and Farmers** have reduced writing in CA. Active writers in these areas include **FAIR Plan** (insurer of last resort), **Hippo**, **Openly**, and some Lloyd's surplus lines carriers. Always verify current availability — it changes seasonally.`,
  insurability: `The **Insurability Panel** shows whether a property can realistically get coverage:\n\n• **Easily Insurable** — standard market options available at normal rates\n• **Moderate conditions** — coverage available, but may require mitigation\n• **Difficult to Insure** — limited to surplus lines or specialty carriers with higher premiums\n• **Potentially Uninsurable** — may only qualify for state last-resort plans`,
  sfha: `A **SFHA (Special Flood Hazard Area)** is any zone beginning with A or V on FEMA flood maps. Properties in SFHAs with a federally-backed mortgage are **required** to carry flood insurance. Base Flood Elevation (BFE) determines required coverage levels. Zone X means low/minimal flood risk.`,
  carriers: `Active carriers shown on CoverGuard are those **currently writing and binding** in that state and risk tier — not just licensed. Availability changes seasonally and after major events. Always request quotes from multiple carriers, including surplus lines if standard market is limited.`,
  surplus: `**Surplus lines** (or non-admitted) carriers write policies that standard admitted carriers won't. They're not regulated by state rate/form rules, so premiums can be higher and coverage terms vary. They're often the only option in high-risk areas. Look for **A-rated surplus carriers** like Lloyd's of London, Lexington, or AIG Private Client.`,
  wind: `**Wind risk** includes hurricane, tornado, and hail exposure. For coastal properties in FL, TX, or NC — look for **TWIA** or state wind pools. Design wind speed (mph) shown on CoverGuard comes from **ASCE 7 standards**. Homes built before 2002 in hurricane zones often need roof upgrades for coverage.`,
  earthquake: `**Earthquake coverage** is almost never included in standard homeowners policies — it's a separate endorsement or policy. **CEA (California Earthquake Authority)** is the main provider in CA. Seismic scores on CoverGuard come from USGS ASCE 7-22 spectral acceleration data. Zone A+ = highest risk.`,
  crime: `**Crime risk scores** use FBI Crime Data Explorer (CDE) statistics normalized against national averages. A score above 70 indicates property/violent crime rates significantly above national average. This affects **umbrella policy** availability and pricing, but rarely blocks homeowners coverage directly.`,
  fair: `**FAIR Plans** are state-mandated insurers of last resort for properties that can't get standard market coverage. CA FAIR Plan covers fire/wind/lightning. FL Citizens covers multi-peril. FAIR Plan rates are typically **2–5× standard market rates** and coverage is more limited. They're a backstop, not a preferred solution.`,
  compare: `The **Compare** feature lets you view up to 3 properties side-by-side — comparing risk scores, insurability levels, hazard breakdowns, and estimated annual premiums. It's ideal for helping buyers choose between properties with different risk profiles.`,
  score: `**Insurability scores** (0–100) reflect how easily a property can be covered by the standard market. **80–100** = easily insurable, **60–79** = some conditions, **40–59** = difficult, **below 40** = challenging/surplus lines territory. Scores update as carrier availability data refreshes.`,
  save: `To **save a property**, open its full report and click the "Save" button in the header. Saved properties appear in your **Reports** tab for quick access. You can add notes and tags to organize them by client or deal stage.`,
  buyer: `When explaining insurance risk to buyers:\n\n1. Use the **Insurability Panel** to frame overall risk simply ("easily insurable" vs "difficult")\n2. Show the **Risk Score** breakdown — flood, fire, wind, earthquake, crime\n3. Show **Active Carriers** to demonstrate real carrier availability\n4. Use the **Cost Estimate** to set premium expectations early\n5. Recommend they get quotes from 2–3 carriers before making an offer`,
}

function getStaticResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('flood zone') || lower.includes('sfha') || lower.includes('fema') || lower.includes('nfip')) return STATIC_RESPONSES.sfha!
  if (lower.includes('flood')) return STATIC_RESPONSES.flood!
  if (lower.includes('fire') || lower.includes('cal fire') || lower.includes('fhsz') || lower.includes('wildland')) return STATIC_RESPONSES.fire!
  if (lower.includes('insurability') || lower.includes('panel') || lower.includes('insurable')) return STATIC_RESPONSES.insurability!
  if (lower.includes('surplus') || lower.includes('non-admitted') || lower.includes('lloyd')) return STATIC_RESPONSES.surplus!
  if (lower.includes('wind') || lower.includes('hurricane') || lower.includes('tornado') || lower.includes('hail')) return STATIC_RESPONSES.wind!
  if (lower.includes('earthquake') || lower.includes('seismic') || lower.includes('quake') || lower.includes('cea')) return STATIC_RESPONSES.earthquake!
  if (lower.includes('crime') || lower.includes('fbi') || lower.includes('violent')) return STATIC_RESPONSES.crime!
  if (lower.includes('fair plan') || lower.includes('citizens') || lower.includes('last resort')) return STATIC_RESPONSES.fair!
  if (lower.includes('compare') || lower.includes('side by side') || lower.includes('comparison')) return STATIC_RESPONSES.compare!
  if (lower.includes('score') || lower.includes('rating') || lower.includes('number')) return STATIC_RESPONSES.score!
  if (lower.includes('save') || lower.includes('bookmark') || lower.includes('report')) return STATIC_RESPONSES.save!
  if (lower.includes('buyer') || lower.includes('client') || lower.includes('explain') || lower.includes('present')) return STATIC_RESPONSES.buyer!
  if (lower.includes('carrier') || lower.includes('writ') || lower.includes('active')) return STATIC_RESPONSES.carriers!
  return `Good question about **${input.slice(0, 45)}${input.length > 45 ? '…' : ''}**. CoverGuard aggregates data from FEMA NFHL, USGS Design Maps, Cal Fire FHSZ, NOAA SLOSH, USFS WUI, and FBI CDE to provide parcel-level risk intelligence. For property-specific guidance, open the full report and check the Risk Breakdown and Active Carriers sections.`
}

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

  function handleSend(text?: string) {
    const input = (text ?? message).trim()
    if (!input) return
    setMessage('')
    setMessages((prev) => [...prev, { role: 'user', text: input }])
    setThinking(true)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'advisor', text: getStaticResponse(input) },
      ])
      setThinking(false)
    }, 800)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-3 w-80 rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: '480px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0d1929] shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-teal-500 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 min-h-[160px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'advisor' && (
                  <div className="h-6 w-6 rounded-full bg-teal-500 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                    <Shield className="h-3 w-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[220px] rounded-xl px-3 py-2 text-xs leading-relaxed ${
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
                  <Shield className="h-3 w-3 text-white" />
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
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
        className="h-12 w-12 rounded-full bg-[#0d1929] hover:bg-[#162438] shadow-xl flex items-center justify-center transition-colors border border-white/10"
        title="AI Advisor"
      >
        <div className="relative flex items-center justify-center">
          <Shield className="h-5 w-5 text-teal-400" />
          <span className="absolute -bottom-1.5 -right-1.5 text-[7px] font-bold text-white/90 leading-none bg-teal-500 rounded px-0.5">
            AI
          </span>
        </div>
      </button>
    </div>
  )
}
