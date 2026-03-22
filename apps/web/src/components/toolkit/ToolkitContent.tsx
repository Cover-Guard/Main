'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Wrench,
  DollarSign,
  ClipboardList,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react'
import { searchProperties, getPropertyInsurance } from '@/lib/api'
import { formatCurrency } from '@coverguard/shared'
import type { InsuranceCostEstimate } from '@coverguard/shared'
import { US_STATES } from '@coverguard/shared'

// ── Hard market data by state ──────────────────────────────────────────────
const HARD_MARKET_DATA: Record<string, {
  condition: 'SOFT' | 'MODERATE' | 'HARD' | 'CRISIS'
  withdrawals: string[]
  fairPlan: string
  surplusLines: string[]
  notes: string
}> = {
  CA: {
    condition: 'CRISIS',
    withdrawals: ['State Farm', 'Allstate', 'Farmers (reduced)', 'CSAA (reduced)', 'AIG'],
    fairPlan: 'California FAIR Plan — available statewide, premiums 2–5× standard market',
    surplusLines: ['Lexington Insurance (AIG)', 'Lloyd\'s of London syndicates', 'Markel', 'Hippo (select counties)'],
    notes: 'Wildfire exposure has driven most admitted carriers to pause or restrict new policies in high-risk zones (SRA, WUI). FAIR Plan enrollment surged 40%+ in 2023–2024.',
  },
  FL: {
    condition: 'CRISIS',
    withdrawals: ['Farmers Insurance', 'Bankers Insurance', 'St. Johns Insurance', 'TypTap (exited)', 'Demotech downgrades on 17 carriers'],
    fairPlan: 'Citizens Property Insurance Corp — insurer of last resort; 1.3M+ policies',
    surplusLines: ['Frontline Insurance', 'Heritage Insurance', 'Slide Insurance', 'Lexington Insurance'],
    notes: 'Hurricane frequency and litigation costs have created a severe market dislocation. Many policies now exclude wind/hurricane — requires separate windstorm policy.',
  },
  LA: {
    condition: 'CRISIS',
    withdrawals: ['State Farm', 'Allstate', 'Nationwide', 'AAA', 'LM General Insurance'],
    fairPlan: 'Louisiana Citizens Property Insurance — last resort carrier',
    surplusLines: ['Lexington Insurance', 'Lloyd\'s syndicates', 'AmTrust'],
    notes: 'Katrina (2005) and Laura/Ida (2020–21) destroyed the admitted market. Most coastal properties require surplus lines.',
  },
  TX: {
    condition: 'HARD',
    withdrawals: ['AAA (limited new)', 'Some regional carriers in Panhandle'],
    fairPlan: 'Texas FAIR Plan (TFPA) — wind and hail coverage',
    surplusLines: ['Lexington Insurance', 'Scottsdale Insurance', 'James River'],
    notes: 'Hail and winter storm (Uri) losses have hardened the market, particularly in DFW and West Texas. Coastal areas face windstorm exclusions requiring TWIA coverage.',
  },
  CO: {
    condition: 'HARD',
    withdrawals: ['State Farm (Marshall Fire area)', 'Farmers (selected counties)'],
    fairPlan: 'No formal FAIR Plan — surplus lines serve as last resort',
    surplusLines: ['Lexington Insurance', 'Lloyd\'s syndicates'],
    notes: 'Wildfire and hail losses have driven rate increases of 30–50%+ in Boulder, Jefferson, and El Paso counties.',
  },
  OK: {
    condition: 'HARD',
    withdrawals: ['Several regional carriers restricting tornado coverage'],
    fairPlan: 'No formal FAIR Plan',
    surplusLines: ['Scottsdale Insurance', 'Markel'],
    notes: 'Tornado Alley exposure drives above-average losses. Wind/hail deductibles often 2–5% of dwelling value.',
  },
  OR: {
    condition: 'HARD',
    withdrawals: ['State Farm (wildfire zones)', 'Allstate (new business paused in some counties)'],
    fairPlan: 'Oregon FAIR Plan — fire coverage only',
    surplusLines: ['Lexington Insurance', 'Lloyd\'s syndicates'],
    notes: 'Wildfire risk increasing across eastern Oregon and Cascade foothills.',
  },
  WA: {
    condition: 'MODERATE',
    withdrawals: [],
    fairPlan: 'Washington FAIR Plan — fire and extended coverage',
    surplusLines: ['Lexington Insurance'],
    notes: 'Eastern WA faces rising wildfire exposure. Standard market still available but some carriers adding WUI surcharges.',
  },
  NC: {
    condition: 'MODERATE',
    withdrawals: ['State Farm (coastal, new business)'],
    fairPlan: 'NC Joint Underwriting Association (NCJUA) — beach plan for coastal',
    surplusLines: ['Frontline Insurance', 'Lexington Insurance'],
    notes: 'Coastal properties (barrier islands, Brunswick/New Hanover counties) require separate windstorm coverage through NCJUA.',
  },
  SC: {
    condition: 'MODERATE',
    withdrawals: [],
    fairPlan: 'South Carolina Wind and Hail Underwriting Association (SCWHUA)',
    surplusLines: ['Frontline Insurance', 'Lexington Insurance'],
    notes: 'Coastal counties (Horry, Georgetown, Beaufort) have limited admitted carrier options for wind coverage.',
  },
  GA: {
    condition: 'SOFT',
    withdrawals: [],
    fairPlan: 'Georgia Underwriting Association — limited availability',
    surplusLines: ['Lexington Insurance'],
    notes: 'Coastal areas (Glynn, Camden counties) may face wind coverage limitations from admitted carriers.',
  },
}

const CONDITION_CONFIG = {
  SOFT:     { label: 'Soft Market',   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  MODERATE: { label: 'Moderate',      color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  HARD:     { label: 'Hard Market',   color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  CRISIS:   { label: 'Market Crisis', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
}

// ── Insurance Cost Estimator ───────────────────────────────────────────────
function InsuranceEstimatorTool() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<InsuranceCostEstimate | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setEstimate(null)
    try {
      const results = await searchProperties({ address: query, limit: 1 })
      if (!results.properties.length) {
        setError('No property found for that address. Try a more specific address or ZIP code.')
        return
      }
      const property = results.properties[0]!
      const ins = await getPropertyInsurance(property.id)
      setEstimate(ins)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate insurance cost')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">
        Search a property address to get an estimated annual insurance cost breakdown by coverage type.
      </p>
      <form onSubmit={handleEstimate} className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-400">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter property address or ZIP…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? 'Loading…' : 'Estimate'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {estimate && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Estimated Annual Total</p>
            <p className="text-3xl font-bold text-blue-800 mt-1">{formatCurrency(estimate.estimatedAnnualTotal)}</p>
            <p className="text-sm text-blue-600">{formatCurrency(estimate.estimatedMonthlyTotal)}/month · {estimate.confidenceLevel} confidence</p>
          </div>

          <div className="space-y-2">
            {estimate.coverages.map((cov) => (
              <div key={cov.type} className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{formatCoverageType(cov.type)}</p>
                    {cov.required && (
                      <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Required</span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(cov.averageAnnualPremium)}/yr</p>
                    <p className="text-xs text-gray-400">
                      {formatCurrency(cov.lowEstimate)} – {formatCurrency(cov.highEstimate)}
                    </p>
                  </div>
                </div>
                {cov.notes.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {cov.notes.map((n) => (
                      <li key={n} className="text-xs text-gray-500 flex items-start gap-1.5">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {estimate.recommendations.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Recommendations</p>
              <ul className="space-y-1">
                {estimate.recommendations.map((r) => (
                  <li key={r} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-gray-400 italic">{estimate.disclaimers[0]}</p>
        </div>
      )}
    </div>
  )
}

function formatCoverageType(type: string): string {
  return ({
    HOMEOWNERS: 'Homeowners',
    FLOOD: 'Flood',
    EARTHQUAKE: 'Earthquake',
    WIND_HURRICANE: 'Wind / Hurricane',
    UMBRELLA: 'Umbrella',
    FIRE: 'Fire',
  } as Record<string, string>)[type] ?? type
}

// ── Pre-Offer Checklist Generator ──────────────────────────────────────────
const CHECKLIST_ITEMS = [
  { category: 'Flood', items: ['Identify FEMA flood zone (SFHA vs. X)', 'Check if lender requires flood insurance', 'Obtain NFIP or private flood quote', 'Confirm Base Flood Elevation (BFE) and finished floor elevation'] },
  { category: 'Fire / Wildfire', items: ['Check Cal Fire FHSZ or USFS WUI classification', 'Confirm admitted carrier availability', 'If WUI zone — obtain surplus lines quote', 'Ask seller for prior claims or loss history'] },
  { category: 'Wind / Hurricane', items: ['Confirm if wind is excluded from homeowners policy', 'Obtain separate windstorm or FAIR Plan quote if coastal', 'Check wind deductible (often 2–5% of dwelling)', 'Review NOAA SLOSH surge zone for coastal properties'] },
  { category: 'Earthquake', items: ['Note USGS seismic zone and design category', 'Review CEA (CA) or private earthquake quote', 'Check if standard homeowners excludes earthquake (it does)', 'Ask about foundation type and retrofit history'] },
  { category: 'Market / Carrier', items: ['Verify carriers actively writing in this market', 'Confirm policy can be bound before close of escrow', 'Identify market condition (soft / hard / crisis)', 'Add insurance contingency clause to offer if coverage uncertain'] },
  { category: 'Property Condition', items: ['Roof age and material (>20 yr may be declined)', 'Knob-and-tube or aluminum wiring (declination risk)', 'Oil tank on property (environmental liability)', 'Pool / trampoline / aggressive breed dog on property'] },
]

function ChecklistTool() {
  const [query, setQuery] = useState('')
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  function generate(e: React.FormEvent) {
    e.preventDefault()
    setGenerated(true)
  }

  async function copyChecklist() {
    const text = CHECKLIST_ITEMS.map((cat) =>
      `## ${cat.category}\n${cat.items.map((i) => `- [ ] ${i}`).join('\n')}`
    ).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">
        Generate a comprehensive pre-offer insurance checklist covering all major perils and carrier requirements.
      </p>
      {!generated ? (
        <form onSubmit={generate} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Property Address or APN (optional)</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. 123 Main St, Los Angeles, CA 90001"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Generate Checklist
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Pre-Offer Insurance Checklist{query ? ` — ${query}` : ''}
            </p>
            <button
              onClick={copyChecklist}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {CHECKLIST_ITEMS.map((cat) => (
            <div key={cat.category} className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">{cat.category}</p>
              <ul className="space-y-1.5">
                {cat.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <input type="checkbox" className="mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button
            onClick={() => setGenerated(false)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}

// ── Disclosure Letter Generator ────────────────────────────────────────────
function DisclosureTool() {
  const [form, setForm] = useState({ buyerName: '', address: '', agentName: '', condition: 'HARD' as 'SOFT' | 'HARD' | 'CRISIS' })
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)

  const CONDITION_LABELS = { SOFT: 'a soft', HARD: 'a challenging hard', CRISIS: 'a severe crisis' }

  function generateLetter() {
    return `Dear ${form.buyerName || '[Buyer Name]'},

Re: Insurance Disclosure — ${form.address || '[Property Address]'}

I am writing to inform you of important insurance market conditions that may affect your purchase of the above property.

The property is located in ${CONDITION_LABELS[form.condition] ?? 'a'} insurance market. As your real estate professional, I want to ensure you have complete information before finalizing your offer.

KEY CONSIDERATIONS:

1. INSURANCE AVAILABILITY: Not all carriers are actively writing new policies in this area. You should obtain insurance quotes as early as possible in the purchase process — ideally before removing contingencies.

2. COVERAGE COSTS: Premium estimates for this property may be significantly higher than national averages due to local hazard conditions (flood, fire, wind, or other perils). Please budget accordingly.

3. SPECIALTY COVERAGE: Some hazard types (flood, earthquake, wind/hurricane) may not be covered under a standard homeowners policy and may require separate policies at additional cost.

4. LENDER REQUIREMENTS: Your mortgage lender may require proof of insurance before funding. Ensure you have secured bindable coverage prior to closing.

RECOMMENDED STEPS:
• Obtain insurance quotes from at least 3 carriers before removing your insurance contingency
• Ask each carrier whether the policy can be bound at or before close of escrow
• Review all policy exclusions carefully, particularly for flood, earthquake, and wind
• Consider adding an insurance contingency clause to your offer

This disclosure is provided for informational purposes. For specific coverage advice, please consult a licensed insurance professional.

Sincerely,

${form.agentName || '[Agent Name]'}
Licensed Real Estate Professional
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

---
Prepared with CoverGuard Property Insurance Intelligence`
  }

  async function copyLetter() {
    await navigator.clipboard.writeText(generateLetter())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">
        Generate a professional insurance disclosure letter to inform buyers about market conditions.
      </p>
      {!generated ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Buyer Name</label>
              <input
                value={form.buyerName}
                onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Your Name</label>
              <input
                value={form.agentName}
                onChange={(e) => setForm({ ...form, agentName: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="e.g. Alex Johnson"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Property Address</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="123 Main St, Los Angeles, CA 90001"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Market Condition</label>
            <select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value as typeof form.condition })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="SOFT">Soft Market (good availability)</option>
              <option value="HARD">Hard Market (limited availability)</option>
              <option value="CRISIS">Market Crisis (very limited options)</option>
            </select>
          </div>
          <button
            onClick={() => setGenerated(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Generate Letter
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Insurance Disclosure Letter</p>
            <button
              onClick={copyLetter}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy Letter'}
            </button>
          </div>
          <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
            {generateLetter()}
          </pre>
          <button
            onClick={() => setGenerated(false)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

// ── Hard Market Lookup ─────────────────────────────────────────────────────
function HardMarketTool() {
  const [selectedState, setSelectedState] = useState('')
  const data = selectedState ? HARD_MARKET_DATA[selectedState] : null
  const config = data ? CONDITION_CONFIG[data.condition] : null
  const defaultData = {
    condition: 'SOFT' as const,
    withdrawals: [],
    fairPlan: 'Contact your state insurance department for FAIR Plan availability.',
    surplusLines: ['Lexington Insurance (AIG)', 'Lloyd\'s of London syndicates'],
    notes: 'Standard admitted market is generally available in this state. Compare quotes from multiple carriers.',
  }
  const displayData = data ?? (selectedState ? defaultData : null)

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">
        Look up current insurance market conditions, carrier withdrawals, FAIR Plan details, and surplus lines options by state.
      </p>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Select State</label>
        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">Select a state…</option>
          {US_STATES.map(({ code, name }) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      {displayData && selectedState && (() => {
        const displayConfig = CONDITION_CONFIG[displayData.condition]
        return (
          <div className="space-y-3">
            <div className={`rounded-xl border ${displayConfig.border} ${displayConfig.bg} p-4`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Market Condition</p>
              <p className={`text-xl font-bold ${displayConfig.color}`}>{displayConfig.label}</p>
              <p className="text-sm text-gray-600 mt-2">{displayData.notes}</p>
            </div>

            {displayData.withdrawals.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-red-600 mb-2">Recent Carrier Withdrawals / Restrictions</p>
                <ul className="space-y-1">
                  {displayData.withdrawals.map((w) => (
                    <li key={w} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-600 mb-2">FAIR Plan / Insurer of Last Resort</p>
              <p className="text-sm text-gray-700">{displayData.fairPlan}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-purple-600 mb-2">Surplus Lines Options</p>
              <ul className="space-y-1">
                {displayData.surplusLines.map((s) => (
                  <li key={s} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[10px] text-gray-400">
              Data reflects general market conditions as of Q1 2026. Carrier availability changes frequently — always verify directly with carriers.
            </p>
          </div>
        )
      })()}
    </div>
  )
}

// ── Tools configuration ────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'cost-estimator',
    icon: DollarSign,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Insurance Cost Estimator',
    description: 'Look up real-time insurance cost estimates for any US property address',
    content: <InsuranceEstimatorTool />,
  },
  {
    id: 'checklist',
    icon: ClipboardList,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Pre-Offer Checklist Generator',
    description: 'Generate a comprehensive insurance checklist to review before making an offer',
    content: <ChecklistTool />,
  },
  {
    id: 'disclosure',
    icon: Mail,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Insurance Disclosure Letter Generator',
    description: 'Professional disclosure letter for buyers in challenging insurance markets',
    content: <DisclosureTool />,
  },
  {
    id: 'hard-market',
    icon: AlertTriangle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Hard Market Lookup',
    description: 'Current carrier withdrawals, FAIR Plan options, and surplus lines by state (all 50 states)',
    content: <HardMarketTool />,
  },
]

export function ToolkitContent() {
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Agent Toolkit</h1>
        </div>
      </div>
      <p className="text-sm text-blue-600 mb-8 ml-[52px]">
        Tools for insurance-savvy real estate professionals
      </p>

      {/* Accordion list */}
      <div className="space-y-2">
        {TOOLS.map(({ id, icon: Icon, iconBg, iconColor, title, description, content }) => {
          const isOpen = openId === id
          return (
            <div key={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 border-t border-gray-100">{content}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
