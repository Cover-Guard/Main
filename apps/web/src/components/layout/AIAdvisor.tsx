'use client'

import { useState, useRef, useEffect } from 'react'
import { Shield, X, Send, ChevronDown } from 'lucide-react'

// ── Context-aware response engine ─────────────────────────────────────────────

const RESPONSE_MAP: Array<[RegExp, string]> = [
  [/flood|sfha|firm|fema|nfip|floodplain/i,
    "Flood risk is assessed using FEMA's National Flood Hazard Layer (NFHL) and OpenFEMA historical claims data. Properties in a Special Flood Hazard Area (SFHA) require federally mandated flood insurance for any federally-backed mortgage. I recommend verifying the FIRM panel number and checking whether a Letter of Map Amendment (LOMA) has been filed — it can reclassify a property out of the SFHA entirely."],
  [/fire|wildfire|wildland|wui|hazard zone|cal fire/i,
    "Wildfire risk is scored using Cal Fire FHSZ zones for California and USFS Wildland-Urban Interface (WUI) data nationally. Properties rated 'VERY HIGH' or 'EXTREME' often face non-renewal notices or premium surcharges of 2–4× the national average. Brush clearance documentation, Class A roofing, and ember-resistant vents can meaningfully improve carrier willingness to bind."],
  [/earthquake|seismic|fault|quake|cea/i,
    "Seismic risk is derived from USGS Design Maps using ASCE 7-22 spectral acceleration values. Properties in Seismic Design Category D carry the highest exposure. Standard homeowners policies exclude earthquake damage — a separate policy is required, often through the California Earthquake Authority (CEA) or private surplus-lines carriers. Soft-story and cripple-wall retrofits are typically required by lenders."],
  [/wind|hurricane|tornado|hail|coastal|surge/i,
    "Wind risk factors in ASCE 7 design wind speeds, NOAA SLOSH hurricane surge zones, and historical hail/tornado tracks. In coastal markets like Florida, Texas, and the Carolinas, carriers increasingly exclude wind from standard HO policies, requiring a separate windstorm policy through state pools (Citizens, TWIA) or E&S carriers. Expect premium volatility — these markets harden quickly after major storm seasons."],
  [/crime|safe|security|violent|property crime/i,
    "Crime risk is indexed using FBI Crime Data Explorer data normalized against national averages. High crime indices rarely trigger standard carrier declinations, but can increase umbrella/liability premiums and may raise theft deductibles. Monitored security systems and deadbolt certifications are common carrier mitigation requests for high-index properties."],
  [/carrier|insurer|insurance company|write|writing|bind|available/i,
    "'Actively Writing' means the carrier is accepting new submissions right now. 'Limited Writing' often signals a post-catastrophe moratorium or tightened underwriting appetite. Surplus-lines (E&S) carriers fill the gap when admitted markets decline — premiums typically run 1.5–3× standard rates, but coverage is available where the standard market isn't."],
  [/quote|premium|cost|price|estimate|how much/i,
    "Insurance cost estimates here are modeled from market data, risk scores, and state multipliers — directionally accurate, not binding. To get a real bindable quote, click 'Request Quote' on any actively writing carrier in the Active Carriers panel. Always get quotes from at least 3 carriers — there can be a 40–60% spread in premiums for the same property."],
  [/insurab|can.*insure|hard market|difficult|market crisis/i,
    "Insurability is scored on a 5-tier scale: LOW (standard market, competitive pricing) → MODERATE → HIGH → VERY HIGH → EXTREME (potentially requires state last-resort plans or self-insurance). The assessment combines flood zone classification, fire hazard severity, seismic zone, wind exposure, and current market conditions. HIGH+ properties typically require a surplus-lines broker."],
  [/discount|mitigation|reduce|lower|improve|retrofit/i,
    "Common mitigation measures that improve both insurability and premiums: (1) Flood — elevate HVAC, install sump pumps, file a LOMA. (2) Fire — Class A roof, ember-resistant vents, 100ft defensible space. (3) Wind — impact windows, hurricane straps on roof connections. (4) Earthquake — soft-story retrofit. Documenting improvements with photos and permits typically reduces premiums 10–30%."],
  [/compare|vs|versus|side by side/i,
    "The Compare tool lets you view up to 3 properties side-by-side across all risk categories, insurability scores, and estimated insurance costs. This is especially valuable when evaluating multiple bids — annual insurance costs can vary $5,000–$20,000+ between similar properties in different risk zones."],
  [/report|pdf|export|download|share/i,
    "Full property reports bundle the risk breakdown, insurability assessment, active carrier list, and insurance cost estimates. Reports are saved to your account and can be shared with clients, lenders, or escrow officers as part of a formal due diligence package."],
]

function getAIResponse(msg: string): Promise<string> {
  for (const [pattern, reply] of RESPONSE_MAP) {
    if (pattern.test(msg)) {
      return new Promise((r) => setTimeout(() => r(reply), 900 + Math.random() * 600))
    }
  }
  return new Promise((r) =>
    setTimeout(() =>
      r("I can help with flood risk, wildfire exposure, earthquake data, wind hazards, carrier availability, or how to interpret insurability scores. What would you like to explore?"),
      800 + Math.random() * 400,
    )
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message { id: number; role: 'user' | 'ai'; text: string }

const SUGGESTED = [
  'What does flood zone AE mean?',
  'How does fire risk affect premiums?',
  'Best carriers for high-risk homes?',
]

// ── Component ─────────────────────────────────────────────────────────────────

export function AIAdvisor() {
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [typing, setTyping]     = useState(false)
  const [idSeq, setIdSeq]       = useState(1)
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: 'ai', text: "Hi! I'm your CoverGuard AI Advisor. Ask me anything about flood risk, wildfire exposure, carrier availability, insurance costs, or how to interpret a property's insurability score." },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 150) }, [open])

  async function send() {
    const text = input.trim()
    if (!text || typing) return
    setInput('')

    const uid = idSeq
    setIdSeq((n) => n + 2)
    setMessages((prev) => [...prev, { id: uid, role: 'user', text }])
    setTyping(true)

    const reply = await getAIResponse(text)
    setTyping(false)
    setMessages((prev) => [...prev, { id: uid + 1, role: 'ai', text: reply }])
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="animate-slide-up mb-1 flex w-[340px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#0d1929] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 ring-2 ring-teal-400/30">
                <Shield className="h-4 w-4 text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Advisor</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                  <p className="text-[10px] text-teal-300">CoverGuard Intelligence</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto bg-gray-50 p-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d1929]">
                    <Shield className="h-3 w-3 text-teal-400" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-[#0d1929] text-white'
                      : 'rounded-bl-sm bg-white text-gray-700 shadow-sm ring-1 ring-gray-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex animate-fade-in items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d1929]">
                  <Shield className="h-3 w-3 text-teal-400" />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-sm ring-1 ring-gray-200">
                  <span className="typing-dot text-gray-400" />
                  <span className="typing-dot text-gray-400" />
                  <span className="typing-dot text-gray-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested prompts — only on first open */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5 border-t border-gray-100 bg-white px-3 py-2.5">
              {SUGGESTED.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p); inputRef.current?.focus() }}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-gray-100 bg-white p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask about risk, carriers, premiums…"
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-400/20"
            />
            <button
              onClick={send}
              disabled={!input.trim() || typing}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white transition-all hover:bg-teal-400 disabled:opacity-40 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* FAB toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0d1929] shadow-xl transition-all hover:bg-[#162438] active:scale-95"
        title="AI Advisor"
      >
        {open ? (
          <ChevronDown className="h-5 w-5 text-teal-400" />
        ) : (
          <div className="relative">
            <Shield className="h-5 w-5 text-teal-400" />
            <span className="absolute -bottom-1.5 -right-1.5 rounded bg-teal-500 px-0.5 text-[7px] font-bold leading-none text-white">AI</span>
          </div>
        )}
      </button>
    </div>
  )
}
