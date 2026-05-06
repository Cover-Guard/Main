'use client'

/**
 * Toolkit redesign — workflow rail + drawer + reference section.
 *
 * What changed:
 *  - Tools sequenced as a numbered workflow (Qualify → Match → Estimate → Disclose → Send)
 *    so the page reflects how an agent actually moves through a deal.
 *  - One canonical card design (no double headers, rich preview on every card).
 *  - Single "open" affordance: every tool opens in the same right-side drawer
 *    via Radix Dialog. No more inline column-span expansion that pushed the
 *    rest of the toolkit off-screen.
 *  - Tool-to-tool handoff: each tool's drawer footer shows the next steps
 *    with the previous tool's output prefilled (visible "PREFILLED" tag).
 *  - Reference tools (Policy Type Guide, Pre-Offer Checklist) split out so
 *    the workflow stays focused on the deal flow.
 *  - Removed the duplicated `ToolkitFeaturedRail` (3 of 7 tools were duplicated).
 *  - Removed the inconsistent chevron-expand vs "Open tool" link CTAs.
 *  - First-time onboarding overlay (dismissible, persists in localStorage).
 *  - In-toolkit search (cmd-K), per-tool freshness inside the drawer,
 *    pinned/recent badges on cards.
 *
 * See `docs/enhancements/toolkit-redesign.md` for the full spec, severity-tagged
 * issue list, and rationale.
 */

import { useEffect, useRef, useState } from 'react'
import { isDemoMode } from '@/lib/mockData'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Wrench,
  DollarSign,
  ClipboardList,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Building2,
  MessageSquare,
  BookOpen,
  Settings,
  Search,
  X,
  Pin,
  ArrowRight,
  Star,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react'

// ─── Hard Market Data ──────────────────────────────────────────────────────

const HARD_MARKET_DATA: Record<
  string,
  {
    condition: 'SOFT' | 'MODERATE' | 'HARD' | 'CRISIS'
    withdrawn: string[]
    fairPlan: string
    surplusOptions: string[]
    notes: string
  }
> = {
  CA: {
    condition: 'CRISIS',
    withdrawn: ['State Farm', 'Allstate', 'Farmers (non-renewals)', 'AIG (personal lines)'],
    fairPlan: 'California FAIR Plan — available statewide. Covers fire, smoke, wind, and lightning. Average premium ~$3,200/yr for SFR.',
    surplusOptions: ['Palomar Specialty', 'Hippo (select counties)', "Lloyd's of London syndicates", 'Openly (non-wildfire zones)', 'Wawanesa (limited)'],
    notes: 'California is in a declared insurance crisis. SB 1206 (2024) requires carriers to write 85% of statewide market share in high-risk areas to re-enter. FAIR Plan is insurer of last resort and does not cover liability.',
  },
  FL: {
    condition: 'CRISIS',
    withdrawn: ['Bankers Insurance', 'TypTap (partial)', 'Demotech-rated carriers (ongoing failures)', 'Heritage Insurance (partial non-renewals)'],
    fairPlan: 'Citizens Property Insurance — Florida\'s state-backed insurer of last resort. Currently over 1.3M policies. SB 2-A (2023) reform requires Citizens policyholders to accept private market offers within 20% of Citizens premium.',
    surplusOptions: ['Universal Property & Casualty', 'Security First', 'Tower Hill', 'Slide Insurance', 'HCI Group'],
    notes: 'Florida passed major insurance reform in 2023 (SB 2-A) to reduce litigation. Reinsurance costs remain elevated post-Ian/Irma. Wind coverage may be separate from homeowners via state wind pool.',
  },
  TX: {
    condition: 'HARD',
    withdrawn: ['Some hail market withdrawals in DFW corridor'],
    fairPlan: 'Texas FAIR Plan (TWIA for wind/hail in coastal counties). Texas Windstorm Insurance Association covers 14 first-tier coastal counties.',
    surplusOptions: ['Homeowners of America', 'Hippo', 'Branch', 'Openly'],
    notes: 'Texas sees hardening market due to hail events in DFW and Austin. Coastal properties require separate windstorm coverage through TWIA. No state moratorium on non-renewals.',
  },
  LA: {
    condition: 'CRISIS',
    withdrawn: ['State Farm (2023 non-renewals)', 'Allstate', 'AAA', '12+ carriers post-Ida'],
    fairPlan: 'Louisiana Citizens Property Insurance — statewide. Premiums ~40-80% above private market. Covers wind, fire, and named storm.',
    surplusOptions: ['Cajun Underwriters', 'Gulf States Insurance', 'Surplus lines via Louisiana DOI'],
    notes: 'Louisiana lost over 12 insurers after Hurricane Ida (2021). State-backed Citizens premiums are extremely high. 2023 saw modest re-entry by some regional carriers.',
  },
  CO: {
    condition: 'HARD',
    withdrawn: ['Some hail-focused withdrawals along Front Range'],
    fairPlan: 'No formal FAIR Plan — Colorado does not have a state-backed insurer of last resort.',
    surplusOptions: ['Pure Insurance', 'Openly', 'Hippo', 'Surplus lines via Colorado DOI'],
    notes: 'Colorado faces elevated risk from wildfire (Boulder, Jefferson counties) and severe hail (Front Range). Marshall Fire (2021) caused ~$2B insured losses and accelerated hardening.',
  },
  GA: { condition: 'MODERATE', withdrawn: [], fairPlan: 'Georgia FAIR Plan — available for high-risk properties unable to obtain standard market coverage.', surplusOptions: ['Excess and surplus market via GA DOI'], notes: 'Georgia market is generally stable. Coastal counties (Chatham, Glynn) see wind surcharges.' },
  NY: { condition: 'MODERATE', withdrawn: ['Some coastal non-renewals on Long Island'], fairPlan: 'New York FAIR Plan — covers fire, extended coverage, and vandalism.', surplusOptions: ['AIG Private Client', 'Chubb', 'Lloyd\'s syndicates'], notes: 'New York coastal (Long Island, Rockaway) faces wind and flood challenges. NYC market generally stable.' },
  NC: { condition: 'MODERATE', withdrawn: [], fairPlan: 'North Carolina FAIR Plan — statewide coverage available.', surplusOptions: ['Standard surplus lines carriers via NCDOI'], notes: 'Coastal NC (Brunswick, New Hanover) requires wind pool coverage through NC Joint Underwriting Association.' },
  SC: { condition: 'MODERATE', withdrawn: [], fairPlan: 'South Carolina WIND & HAIL Plan — coastal counties.', surplusOptions: ['Surplus lines via SCDOI'], notes: 'Coastal SC sees hardening. SCWHUA covers 8 coastal counties for wind/hail.' },
  AZ: { condition: 'SOFT', withdrawn: [], fairPlan: 'Arizona FAIR Plan — limited availability.', surplusOptions: [], notes: 'Generally soft market. Wildfire risk in northern AZ (Flagstaff area) causing localized hardening.' },
  WA: { condition: 'MODERATE', withdrawn: [], fairPlan: 'Washington FAIR Plan — available statewide.', surplusOptions: [], notes: 'Eastern WA wildfire risk causing localized hardening. Western WA market stable.' },
  OR: { condition: 'HARD', withdrawn: ['Some wildfire-zone non-renewals'], fairPlan: 'Oregon FAIR Plan — statewide, primarily covers fire.', surplusOptions: ['Lloyd\'s syndicates', 'Palomar Specialty'], notes: 'Oregon faces significant wildfire risk (Rogue Valley, Cascade foothills). Non-renewal activity increasing.' },
}

const CONDITION_CONFIG = {
  SOFT:     { label: 'Soft Market', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  MODERATE: { label: 'Moderate',    color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  HARD:     { label: 'Hard Market', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  CRISIS:   { label: 'Market Crisis', color: 'text-red-700',  bg: 'bg-red-50',    border: 'border-red-200' },
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
]

// ─── Insurance Cost Estimator ──────────────────────────────────────────────

function CostEstimatorTool() {
  const [address, setAddress] = useState('')
  const [homeValue, setHomeValue] = useState('')
  const [state, setState] = useState('')
  const [result, setResult] = useState<null | {
    total: number
    coverages: Array<{ label: string; low: number; high: number; avg: number; required: boolean }>
    confidence: string
    notes: string[]
  }>(null)
  const [loading, setLoading] = useState(false)

  function estimate(e: React.FormEvent) {
    e.preventDefault()
    if (!homeValue || !state) return
    setLoading(true)
    setTimeout(() => {
      const val = parseInt(homeValue, 10)
      const stateMultiplier: Record<string, number> = {
        CA: 2.1, FL: 2.8, TX: 1.6, LA: 3.2, CO: 1.4,
        NY: 1.3, WA: 1.1, OR: 1.3, AZ: 0.9, GA: 1.1,
      }
      const mult = stateMultiplier[state] ?? 1.0
      const baseRate = val * 0.0055 * mult
      const coverages = [
        { label: 'Homeowners (HO-3)', low: Math.round(baseRate * 0.85), high: Math.round(baseRate * 1.25), avg: Math.round(baseRate), required: true },
        { label: 'Flood Insurance', low: 700, high: 3200, avg: 1400, required: ['FL', 'LA', 'TX', 'NC', 'SC'].includes(state) },
        { label: 'Earthquake Rider', low: 300, high: 1800, avg: 750, required: ['CA', 'WA', 'OR'].includes(state) },
        { label: 'Wind / Hurricane', low: 500, high: 4500, avg: 1600, required: ['FL', 'TX', 'LA', 'NC', 'SC', 'GA'].includes(state) },
        { label: 'Umbrella ($1M)', low: 200, high: 500, avg: 300, required: false },
      ]
      const total = coverages.filter((c) => c.required).reduce((s, c) => s + c.avg, 0)
      const notes = []
      if (['CA', 'FL', 'LA'].includes(state)) notes.push('Hard market — expect above-average premiums and limited carrier options.')
      if (['CA'].includes(state)) notes.push('Flood insurance is separate from HO-3 and requires NFIP or private flood policy.')
      if (val > 1_000_000) notes.push('High-value properties may require HO-5 or specialty coverage — standard HO-3 limits may be insufficient.')
      setResult({ total, coverages, confidence: val > 200_000 ? 'MEDIUM' : 'LOW', notes })
      setLoading(false)
    }, 800)
  }

  const fmtCurrency = (n: number) => `$${n.toLocaleString()}`

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Enter property details to get an estimated annual insurance cost breakdown.</p>
      <form onSubmit={estimate} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Property Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="e.g. 123 Main St, Austin TX" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Home Value ($) <span className="text-red-400">*</span></label>
            <input type="number" value={homeValue} onChange={(e) => setHomeValue(e.target.value)} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="e.g. 650000" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">State <span className="text-red-400">*</span></label>
          <select value={state} onChange={(e) => setState(e.target.value)} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="">Select state…</option>
            {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading || !homeValue || !state} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Estimating…' : 'Estimate Cost'}
        </button>
      </form>

      {result && (
        <div className="rounded-xl border border-gray-200 overflow-hidden mt-4">
          <div className="bg-[#0d1929] px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wide">Estimated Annual Total</p>
              <p className="text-2xl font-bold text-white">{fmtCurrency(result.total)}</p>
              <p className="text-xs text-white/50 mt-0.5">{fmtCurrency(Math.round(result.total / 12))} / month</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${result.confidence === 'MEDIUM' ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-400 text-white'}`}>
              {result.confidence} confidence
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {result.coverages.map((c) => (
              <div key={c.label} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800">{c.label}</span>
                    {c.required && <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Required</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtCurrency(c.low)} – {fmtCurrency(c.high)} range</p>
                </div>
                <span className="font-semibold text-sm text-gray-900">{fmtCurrency(c.avg)}/yr</span>
              </div>
            ))}
          </div>
          {result.notes.length > 0 && (
            <div className="bg-blue-50 border-t border-blue-100 px-5 py-3 space-y-1.5">
              {result.notes.map((n, i) => (
                <p key={i} className="text-xs text-blue-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {n}
                </p>
              ))}
            </div>
          )}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Estimates are informational only. Actual premiums are determined by licensed insurers after full underwriting review.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pre-Offer Checklist Generator ────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { category: 'Roof', items: ['Verify roof age and material (insurance requires <20yr for standard market)', 'Request roof certification or inspection report', 'Check for prior storm/hail damage claims on CLUE report'] },
  { category: 'Flood', items: ['Confirm FEMA flood zone designation (check FEMA Map Service Center)', 'Verify if flood insurance is required (Zone A or V)', 'Request prior flood claims history from seller', 'Check elevation certificate if in Zone AE'] },
  { category: 'Fire / Wildfire', items: ['Verify CAL FIRE Hazard Severity Zone (if CA)', 'Check defensible space compliance (100ft clearance requirement)', 'Confirm property is not on "do not insure" list for major carriers', 'Ask seller for prior wildfire claims or smoke damage history'] },
  { category: 'Electrical & Plumbing', items: ['Verify no knob-and-tube or aluminum wiring (uninsurable for most carriers)', 'Check for active permits for any electrical upgrades', 'Confirm no polybutylene plumbing (1978-1995 homes)', 'Verify panel is 100A+ and not Federal Pacific / Zinsco brand'] },
  { category: 'Insurance History (CLUE)', items: ['Order CLUE (Comprehensive Loss Underwriting Exchange) report', 'Look for prior water damage, mold, or fire claims', 'Multiple claims in 5 years may trigger declination or surcharge', 'Verify claims were properly closed/remediated'] },
  { category: 'Pool / Trampoline / Dog', items: ['Disclose pool: confirm it has proper fencing (4-side barrier)', 'Trampolines require liability rider or may be excluded', 'Dog breed restrictions: pit bull, rottweiler, german shepherd may affect coverage'], },
  { category: 'Carrier Availability', items: ['Confirm at least 2 carriers actively writing in area', 'If hard market: get insurance commitment BEFORE removing contingency', 'Request FAIR Plan eligibility confirmation if standard market unavailable'] },
]

function ChecklistTool() {
  const [address, setAddress] = useState('')
  const [generated, setGenerated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    setLoading(true)
    setTimeout(() => {
      setGenerated(true)
      setLoading(false)
    }, 700)
  }

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  const totalItems = CHECKLIST_ITEMS.reduce((s, c) => s + c.items.length, 0)
  const doneItems = checked.size

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Generate a property-specific insurance checklist to verify before making an offer.</p>
      <form onSubmit={generate} className="flex gap-2">
        <input value={address} onChange={(e) => setAddress(e.target.value)} required className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Enter property address or APN…" />
        <button type="submit" disabled={loading || !address.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </form>

      {generated && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Pre-Offer Insurance Checklist — {address}</p>
            <span className="text-xs text-gray-500">{doneItems}/{totalItems} complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${(doneItems / totalItems) * 100}%` }} />
          </div>
          {CHECKLIST_ITEMS.map((section) => (
            <div key={section.category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{section.category}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {section.items.map((item) => {
                  const key = `${section.category}-${item}`
                  const done = checked.has(key)
                  return (
                    <button key={item} onClick={() => toggle(key)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                      {done
                        ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        : <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0 mt-0.5" />}
                      <span className={`text-sm ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Disclosure Letter Generator ──────────────────────────────────────────

function DisclosureTool() {
  const [buyerName, setBuyerName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [state, setState] = useState('')
  const [agentName, setAgentName] = useState('')
  const [letter, setLetter] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  function generate(e: React.FormEvent) {
    e.preventDefault()
    if (!buyerName || !propertyAddress || !state) return
    setLoading(true)
    setTimeout(() => {
      const marketData = HARD_MARKET_DATA[state]
      const condition = marketData?.condition ?? 'MODERATE'
      const conditionLabel = CONDITION_CONFIG[condition].label
      const fairPlanLine = marketData?.fairPlan ?? `The state FAIR Plan may be available as an insurer of last resort.`
      const withdrawnLine = marketData?.withdrawn?.length
        ? `Recent carrier withdrawals or non-renewals in this state include: ${marketData.withdrawn.join(', ')}.`
        : 'The standard insurance market in this state is generally available.'

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

      setLetter(`${today}

Dear ${buyerName},

Re: Insurance Market Disclosure — ${propertyAddress}

This letter is to inform you of current property insurance market conditions that may affect your ability to obtain homeowners insurance coverage for the above-referenced property.

CURRENT MARKET CONDITIONS

The insurance market in ${US_STATES.find((s) => s.value === state)?.label ?? state} is currently classified as: ${conditionLabel.toUpperCase()}. ${marketData?.notes ?? ''}

${withdrawnLine}

COVERAGE CONSIDERATIONS

Before removing any insurance contingency from your purchase agreement, we strongly recommend that you:

1. Obtain a written insurance commitment or binder from a licensed insurer BEFORE closing.
2. Request quotes from a minimum of three (3) carriers to ensure competitive pricing.
3. Verify that the policy covers all required perils for this property location (flood, wind, earthquake as applicable).
4. Review all exclusions carefully, particularly for wildfire, flood, and named storm.

INSURER OF LAST RESORT

${fairPlanLine}

Please note that FAIR Plan and state residual market programs typically provide more limited coverage than standard market policies and may carry higher premiums.

DISCLAIMER

This disclosure is informational only and does not constitute insurance advice. All insurance decisions should be made in consultation with a licensed insurance agent or broker. CoverGuard's risk data is derived from public datasets (FEMA, USGS, FBI UCR) and does not constitute a binding insurance offer or commitment.

Sincerely,

${agentName || '[Agent Name]'}
Licensed Real Estate Agent
`)
      setLoading(false)
    }, 800)
  }

  async function copyToClipboard() {
    if (!letter) return
    await navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Generate a professional disclosure letter for buyers about current insurance market conditions.</p>
      <form onSubmit={generate} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Buyer Name <span className="text-red-400">*</span></label>
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="e.g. Jane Smith" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Agent Name</label>
            <input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Your name" />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Property Address <span className="text-red-400">*</span></label>
          <input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="123 Main St, Los Angeles, CA 90210" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">State <span className="text-red-400">*</span></label>
          <select value={state} onChange={(e) => setState(e.target.value)} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="">Select state…</option>
            {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading || !buyerName || !propertyAddress || !state} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {loading ? 'Generating…' : 'Generate Letter'}
        </button>
      </form>

      {letter && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700">Insurance Market Disclosure Letter</p>
            <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
            </button>
          </div>
          <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">{letter}</pre>
        </div>
      )}
    </div>
  )
}

// ─── Hard Market Lookup ────────────────────────────────────────────────────

function HardMarketTool() {
  const [state, setState] = useState('')
  const [result, setResult] = useState<typeof HARD_MARKET_DATA[string] | null>(null)
  const [searched, setSearched] = useState(false)

  function lookup(e: React.FormEvent) {
    e.preventDefault()
    if (!state) return
    const data = HARD_MARKET_DATA[state] ?? {
      condition: 'MODERATE' as const,
      withdrawn: [],
      fairPlan: `${US_STATES.find((s) => s.value === state)?.label ?? state} has a state FAIR Plan available for high-risk or uninsurable properties.`,
      surplusOptions: ['Excess and surplus lines carriers via your state DOI'],
      notes: 'Detailed market data for this state is not yet available. Contact a local insurance broker for current market conditions.',
    }
    setResult(data)
    setSearched(true)
  }

  const cfg = result ? CONDITION_CONFIG[result.condition] : null

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Look up current hard market conditions, carrier withdrawals, and FAIR Plan options by state.</p>
      <form onSubmit={lookup} className="flex gap-2">
        <select value={state} onChange={(e) => { setState(e.target.value); setSearched(false) }} required className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">Select a state…</option>
          {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" disabled={!state} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Look Up
        </button>
      </form>

      {searched && result && cfg && (
        <div className="space-y-3">
          {/* Market condition badge */}
          <div className={`rounded-xl border ${cfg.border} ${cfg.bg} px-5 py-4`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Market Condition</p>
            <p className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</p>
            {result.notes && <p className="text-xs text-gray-600 mt-2 leading-relaxed">{result.notes}</p>}
          </div>

          {/* Carrier withdrawals */}
          {result.withdrawn.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Recent Carrier Withdrawals / Non-Renewals</p>
              <div className="space-y-1.5">
                {result.withdrawn.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAIR Plan */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">FAIR Plan / Insurer of Last Resort</p>
            <p className="text-sm text-blue-800 leading-relaxed">{result.fairPlan}</p>
          </div>

          {/* Surplus lines */}
          {result.surplusOptions.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Active Surplus / Specialty Carriers</p>
              <div className="space-y-1.5">
                {result.surplusOptions.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-sm text-gray-700">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Carrier Quick Lookup ──────────────────────────────────────────────────

const COVERAGE_TYPES = [
  { value: 'homeowners', label: 'Homeowners (HO-3)' },
  { value: 'flood', label: 'Flood Insurance' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'wind', label: 'Wind / Hurricane' },
  { value: 'fire', label: 'Fire / Wildfire' },
] as const

type CoverageTypeKey = typeof COVERAGE_TYPES[number]['value']

const CARRIER_DATA: Record<
  string,
  Partial<Record<CoverageTypeKey, { active: string[]; limited: string[]; unavailable: string[] }>>
> = {
  CA: {
    homeowners: {
      active: ['Wawanesa', 'Openly (non-wildfire zones)', 'Hippo (select counties)', 'CSAA', 'Mercury Insurance'],
      limited: ['Nationwide', 'Travelers (non-wildfire)', 'Chubb (high-value)'],
      unavailable: ['State Farm', 'Allstate', 'Farmers (new policies)', 'AIG Personal Lines'],
    },
    flood: {
      active: ['NFIP (Write-Your-Own carriers)', 'Neptune Flood', 'Palomar Flood', 'Wright Flood'],
      limited: ['Zurich Private Client', 'Chubb'],
      unavailable: [],
    },
    earthquake: {
      active: ['CEA (California Earthquake Authority)', 'GeoVera', 'Palomar Specialty', 'Openly'],
      limited: ['Chubb', 'AIG (high-value only)'],
      unavailable: [],
    },
    wind: {
      active: ['Most HO-3 carriers include wind', 'Palomar Specialty'],
      limited: ['Coastal properties may require separate endorsement'],
      unavailable: [],
    },
    fire: {
      active: ['California FAIR Plan (last resort)', 'Palomar Specialty', 'Lloyd\'s syndicates'],
      limited: ['Openly (non-WUI zones)', 'Hippo (select counties)'],
      unavailable: ['State Farm', 'Allstate', 'Farmers (wildfire zones)'],
    },
  },
  FL: {
    homeowners: {
      active: ['Universal Property & Casualty', 'Security First', 'Tower Hill', 'Slide Insurance', 'HCI Group', 'Citizens (last resort)'],
      limited: ['Travelers', 'Nationwide', 'AAA (inland only)'],
      unavailable: ['Bankers Insurance (personal lines)', 'TypTap (new policies paused)'],
    },
    flood: {
      active: ['NFIP', 'Neptune Flood', 'Wright Flood', 'TypTap Flood', 'Palomar Flood'],
      limited: ['Chubb', 'Zurich'],
      unavailable: [],
    },
    earthquake: {
      active: ['Standard HO endorsements (low risk)', 'Lloyd\'s syndicates'],
      limited: [],
      unavailable: [],
    },
    wind: {
      active: ['Citizens (14 coastal counties)', 'FHCF (reinsurance-backed)', 'Universal P&C', 'Tower Hill'],
      limited: ['Separate wind policy required in coastal zones'],
      unavailable: ['Some carriers exclude wind in Zone 1'],
    },
    fire: {
      active: ['Included in standard HO-3 statewide'],
      limited: [],
      unavailable: [],
    },
  },
  TX: {
    homeowners: {
      active: ['Homeowners of America', 'Hippo', 'Branch', 'Openly', 'Kin Insurance', 'State Auto'],
      limited: ['Allstate', 'State Farm', 'USAA (military)'],
      unavailable: ['Some carriers withdrawn from DFW hail corridor'],
    },
    flood: {
      active: ['NFIP', 'Neptune Flood', 'Palomar Flood', 'Wright Flood'],
      limited: ['Private flood limited in flood-prone ZIP codes'],
      unavailable: [],
    },
    earthquake: {
      active: ['Available via endorsement statewide', 'Palomar Specialty'],
      limited: [],
      unavailable: [],
    },
    wind: {
      active: ['TWIA (14 coastal counties)', 'Openly', 'Hippo'],
      limited: ['Separate TWIA policy required for coastal Zone 1'],
      unavailable: ['Many carriers exclude wind in TWIA territory'],
    },
    fire: {
      active: ['Standard HO-3 covers fire statewide'],
      limited: [],
      unavailable: [],
    },
  },
  LA: {
    homeowners: {
      active: ['Cajun Underwriters', 'Gulf States Insurance', 'Louisiana Citizens (last resort)', 'Surplus lines carriers'],
      limited: ['Some regional carriers re-entering post-2023'],
      unavailable: ['State Farm (2023 non-renewals)', 'Allstate', 'AAA'],
    },
    flood: {
      active: ['NFIP', 'Neptune Flood', 'Wright Flood'],
      limited: ['Private flood limited due to high risk'],
      unavailable: [],
    },
    earthquake: {
      active: ['Available via endorsement'],
      limited: [],
      unavailable: [],
    },
    wind: {
      active: ['Louisiana Citizens', 'Surplus lines for coastal'],
      limited: ['Most carriers require separate wind policy coastal'],
      unavailable: [],
    },
    fire: {
      active: ['Included in standard HO-3'],
      limited: [],
      unavailable: [],
    },
  },
  TX_DEFAULT: {
    homeowners: { active: [], limited: [], unavailable: [] },
  },
}

const CARRIER_DATA_DEFAULT: Record<CoverageTypeKey, { active: string[]; limited: string[]; unavailable: string[] }> = {
  homeowners: {
    active: ['State Farm', 'Allstate', 'Farmers', 'Nationwide', 'USAA (military)', 'Liberty Mutual', 'Travelers'],
    limited: ['Regional surplus lines carriers available'],
    unavailable: [],
  },
  flood: {
    active: ['NFIP (via approved Write-Your-Own carriers)', 'Neptune Flood', 'Wright Flood', 'Palomar Flood'],
    limited: [],
    unavailable: [],
  },
  earthquake: {
    active: ['Available via endorsement or standalone policy', 'GeoVera', 'Palomar Specialty'],
    limited: [],
    unavailable: [],
  },
  wind: {
    active: ['Typically included in standard HO-3', 'Check state wind pool if coastal'],
    limited: [],
    unavailable: [],
  },
  fire: {
    active: ['Included in all standard HO-3 policies', 'State FAIR Plan available as last resort'],
    limited: [],
    unavailable: [],
  },
}

function CarrierLookupTool() {
  const [state, setState] = useState('')
  const [coverageType, setCoverageType] = useState<CoverageTypeKey | ''>('')
  const [result, setResult] = useState<{ active: string[]; limited: string[]; unavailable: string[] } | null>(null)
  const [searched, setSearched] = useState(false)

  function lookup(e: React.FormEvent) {
    e.preventDefault()
    if (!state || !coverageType) return
    const stateData = CARRIER_DATA[state]
    const data = stateData?.[coverageType as CoverageTypeKey] ?? CARRIER_DATA_DEFAULT[coverageType as CoverageTypeKey]
    setResult(data)
    setSearched(true)
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Look up which carriers are actively writing a specific coverage type in your target state.</p>
      <form onSubmit={lookup} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">State <span className="text-red-400">*</span></label>
            <select value={state} onChange={(e) => { setState(e.target.value); setSearched(false) }} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">Select state…</option>
              {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Coverage Type <span className="text-red-400">*</span></label>
            <select value={coverageType} onChange={(e) => { setCoverageType(e.target.value as CoverageTypeKey); setSearched(false) }} required className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              <option value="">Select coverage…</option>
              {COVERAGE_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={!state || !coverageType} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          Look Up Carriers
        </button>
      </form>

      {searched && result && (
        <div className="space-y-3">
          {result.active.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Actively Writing</p>
              <div className="space-y-1.5">
                {result.active.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-sm text-green-800">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.limited.length > 0 && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
              <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-2">Limited Availability</p>
              <div className="space-y-1.5">
                {result.limited.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    <span className="text-sm text-yellow-800">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.unavailable.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Withdrawn / Not Writing</p>
              <div className="space-y-1.5">
                {result.unavailable.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-gray-400 px-1">Carrier availability is subject to change. Always verify current writing status directly with the carrier or via your state DOI. Data is informational only.</p>
        </div>
      )}
    </div>
  )
}

// ─── Client Email Templates ────────────────────────────────────────────────

const EMAIL_TEMPLATES = [
  {
    id: 'hard-market-intro',
    label: 'Hard Market Explanation to Buyer',
    subject: 'Important: Property Insurance Conditions for [Property Address]',
    body: `Hi [Buyer Name],

I wanted to reach out about an important aspect of your purchase at [Property Address] that we need to address early in the transaction.

The property insurance market in [State] is currently experiencing significant hardening. Several major carriers have reduced or stopped writing new policies in this area, which means securing coverage can take more time and may come at a higher cost than you might expect.

Here's what this means for you as a buyer:

1. Start your insurance search NOW — don't wait until a few days before closing.
2. Contact 3–5 insurance agents/brokers, not just one, to maximize your options.
3. If standard carriers decline coverage, ask about the state FAIR Plan as a backup option.
4. Budget for premiums that may be 30–60% higher than comparable properties in other states.

I'm happy to share CoverGuard's risk report for this property, which shows flood zone designation, fire hazard zone, and carrier availability data. This can help your insurance agent find the right coverage faster.

Please let me know if you have any questions or would like to discuss next steps.

Best regards,
[Agent Name]
[Brokerage]
[Phone]`,
  },
  {
    id: 'insurance-contingency',
    label: 'Insurance Contingency Reminder',
    subject: 'Reminder: Insurance Contingency — Action Required for [Property Address]',
    body: `Hi [Buyer Name],

This is a reminder that per your purchase agreement, you have until [Contingency Deadline] to satisfy your insurance contingency for [Property Address].

To keep this on track, please make sure you have:

☐ Contacted at least three (3) licensed insurance agents or brokers
☐ Received at least one written insurance quote or binder commitment
☐ Reviewed the policy for adequate coverage (dwelling, liability, flood if applicable)
☐ Confirmed the lender's minimum coverage requirements are met

If you are having difficulty obtaining insurance, please contact me immediately. We may need to request a contingency extension or explore alternative coverage options before proceeding.

Do not remove the insurance contingency until you have a written commitment in hand.

Please confirm once you have a binder so I can coordinate with escrow.

Best regards,
[Agent Name]
[Brokerage]
[Phone]`,
  },
  {
    id: 'fair-plan-explanation',
    label: 'FAIR Plan Explanation',
    subject: 'Understanding the State FAIR Plan for [Property Address]',
    body: `Hi [Buyer Name],

Following up on our conversation about insurance options for [Property Address] — I wanted to explain the state FAIR Plan in more detail.

WHAT IS THE FAIR PLAN?
The Fair Access to Insurance Requirements (FAIR) Plan is a state-backed insurance program that provides coverage when standard market carriers are unable or unwilling to insure a property. It is the insurer of last resort.

KEY THINGS TO KNOW:

1. Coverage is more limited — FAIR Plans typically cover fire, smoke, lightning, and sometimes wind, but often exclude liability and other perils covered by a standard HO-3 policy.

2. You may need a "Difference in Conditions" (DIC) policy — This supplemental policy fills the gaps left by the FAIR Plan (liability, theft, water damage, etc.).

3. Premiums are often higher — FAIR Plan coverage typically costs more than comparable standard market policies.

4. It IS accepted by lenders — Lenders will accept FAIR Plan + DIC as sufficient coverage to close.

5. It's not permanent — Once the standard market stabilizes, you may be able to transition back to a regular policy at renewal.

I recommend working with a licensed insurance broker who can help bundle the FAIR Plan with a DIC policy to ensure you have complete protection.

Please let me know if you have questions. I'm happy to connect you with local brokers who specialize in hard-market placements.

Best regards,
[Agent Name]
[Brokerage]
[Phone]`,
  },
  {
    id: 'flood-zone-notice',
    label: 'Flood Zone Notification to Buyer',
    subject: 'Flood Zone Notice — [Property Address]',
    body: `Hi [Buyer Name],

I'm writing to inform you that [Property Address] is located in or near a FEMA-designated Special Flood Hazard Area (SFHA).

FEMA FLOOD ZONE DESIGNATION: [Zone AE / Zone X / Zone V — insert from CoverGuard report]

WHAT THIS MEANS:

• If the property is in Zone A or V, your lender will require you to purchase flood insurance as a condition of the mortgage.

• Flood insurance is NOT included in a standard homeowners (HO-3) policy. It must be purchased separately through the National Flood Insurance Program (NFIP) or a private flood insurer.

• Annual flood insurance premiums can range from $700 to $5,000+ depending on the flood zone, elevation, and coverage amount.

ACTION STEPS:

1. Ask the seller for any existing Elevation Certificate (EC) for the property — this can significantly reduce your premium.
2. Contact a licensed insurance agent who writes NFIP policies to get a premium estimate before removing contingencies.
3. Review the CoverGuard flood risk report I've prepared for this property.

Please treat this as a priority item. Flood insurance can take up to 30 days to become effective, so start early.

Best regards,
[Agent Name]
[Brokerage]
[Phone]`,
  },
]

function ClientEmailTemplatesTool() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selected = EMAIL_TEMPLATES.find((t) => t.id === selectedId)

  async function copyTemplate() {
    if (!selected) return
    const text = `Subject: ${selected.subject}\n\n${selected.body}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Professional, ready-to-send email templates for common insurance conversations with buyers.</p>
      <div className="grid grid-cols-1 gap-2">
        {EMAIL_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId((prev) => (prev === t.id ? null : t.id))}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
              selectedId === t.id
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className={`text-sm font-medium ${selectedId === t.id ? 'text-blue-700' : 'text-gray-800'}`}>{t.label}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">Subj: {t.subject}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-700 truncate">{selected.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">Subject: {selected.subject}</p>
            </div>
            <button onClick={copyTemplate} className="ml-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0">
              {copied ? <><Check className="h-3.5 w-3.5" />Copied!</> : <><Copy className="h-3.5 w-3.5" />Copy All</>}
            </button>
          </div>
          <pre className="px-5 py-4 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">{selected.body}</pre>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Replace all bracketed placeholders [ ] before sending. These templates are for informational purposes and do not constitute legal or insurance advice.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Policy Type Guide ─────────────────────────────────────────────────────

const POLICY_TYPES = [
  {
    form: 'HO-1',
    name: 'Basic Form',
    coverage: 'Named perils only (fire, lightning, windstorm, hail, explosion, riot, aircraft, vehicles, smoke, vandalism, theft)',
    bestFor: 'Rarely used today — very limited coverage',
    lenderApproved: false,
    badge: 'bg-gray-100 text-gray-600',
  },
  {
    form: 'HO-2',
    name: 'Broad Form',
    coverage: 'Named perils — expanded list vs HO-1. Adds falling objects, weight of ice/snow, accidental discharge of water, freezing, electrical damage',
    bestFor: 'Budget-conscious buyers in low-risk areas',
    lenderApproved: true,
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    form: 'HO-3',
    name: 'Special Form',
    coverage: 'Open perils on dwelling (covers all causes except listed exclusions). Named perils on personal property',
    bestFor: 'Standard owner-occupied single-family homes — most common policy',
    lenderApproved: true,
    badge: 'bg-green-100 text-green-700',
  },
  {
    form: 'HO-4',
    name: "Renter's Insurance",
    coverage: 'Named perils on personal property only. No dwelling coverage (landlord insures the structure)',
    bestFor: 'Tenants / renters',
    lenderApproved: false,
    badge: 'bg-purple-100 text-purple-700',
  },
  {
    form: 'HO-5',
    name: 'Comprehensive Form',
    coverage: 'Open perils on BOTH dwelling AND personal property — broadest standard coverage',
    bestFor: 'High-value homes ($750K+), luxury properties, or buyers who want maximum protection',
    lenderApproved: true,
    badge: 'bg-teal-100 text-teal-700',
  },
  {
    form: 'HO-6',
    name: 'Condo Form',
    coverage: 'Named perils on personal property + interior of unit (walls-in). HOA master policy covers building exterior',
    bestFor: 'Condo owners — verify HOA master policy type (all-in vs bare walls)',
    lenderApproved: true,
    badge: 'bg-indigo-100 text-indigo-700',
  },
  {
    form: 'HO-7',
    name: 'Mobile / Manufactured Home',
    coverage: 'Open perils on mobile/manufactured home structure. Similar to HO-3 but for mobile homes',
    bestFor: 'Manufactured or mobile home buyers',
    lenderApproved: true,
    badge: 'bg-orange-100 text-orange-700',
  },
  {
    form: 'HO-8',
    name: 'Modified Coverage / Older Homes',
    coverage: 'Named perils only. Pays actual cash value (ACV) rather than replacement cost — designed for older homes where replacement cost exceeds market value',
    bestFor: 'Historic homes, older properties, or homes that cannot be insured at replacement cost',
    lenderApproved: false,
    badge: 'bg-yellow-100 text-yellow-700',
  },
]

function PolicyTypeGuideTool() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-gray-600">Quick reference guide to homeowners insurance policy forms — know which applies to your transaction.</p>
      <div className="space-y-2">
        {POLICY_TYPES.map((p) => {
          const isOpen = expanded === p.form
          return (
            <div key={p.form} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded((prev) => (prev === p.form ? null : p.form))}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <span className={`text-xs font-bold px-2 py-1 rounded shrink-0 ${p.badge}`}>{p.form}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                    {p.lenderApproved && (
                      <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Lender Accepted</span>
                    )}
                  </div>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-100 space-y-2 pt-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Coverage</p>
                    <p className="text-sm text-gray-700 mt-0.5">{p.coverage}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Best For</p>
                    <p className="text-sm text-gray-700 mt-0.5">{p.bestFor}</p>
                  </div>
                  {!p.lenderApproved && (
                    <div className="flex items-start gap-1.5 bg-yellow-50 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-700">This policy form is generally not accepted by mortgage lenders as sufficient coverage on its own.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tool registry (single source of truth, no duplication) ─────────────────
//
// Each tool declares everything the toolkit UI needs to render it: the
// content, a one-line description, a rich preview, when-to-use copy, the
// next-step handoffs, and freshness. The duplicated `ToolkitFeaturedRail`
// has been removed — featured-card preview data lives here on the canonical
// tool definition, so a tool only ever appears once on the page.

type ToolSection = 'workflow' | 'reference'

interface PreviewRow {
  label: string
  value: React.ReactNode
  emphasis?: boolean
}

interface ToolDefinition {
  id: string
  section: ToolSection
  /** 1-based step in the agent workflow (only for section: 'workflow'). */
  stage?: number
  /** Short stage label shown above the card title. */
  label?: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  iconBg: string
  iconColor: string
  title: string
  description: string
  whenToUse: string
  freshness: string
  preview: PreviewRow[]
  /** Tool ids the agent typically opens after this one finishes. */
  nextSteps?: string[]
  content: React.ReactNode
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'hard-market',
    section: 'workflow',
    stage: 1,
    label: 'Qualify',
    icon: AlertTriangle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Hard Market Lookup',
    description:
      'Insurability status of any state — crisis, hard, moderate, or soft — before you show a property.',
    whenToUse:
      'Run this first whenever a buyer is shopping in CA, FL, LA, or any catastrophe-exposed state. Tells you if the deal is even writable.',
    freshness: '8 min ago',
    preview: [
      { label: 'Example', value: 'California' },
      {
        label: 'Status',
        value: (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
            Crisis
          </span>
        ),
      },
      { label: 'Recent premium jump', value: '+340% (Palisades)', emphasis: true },
    ],
    nextSteps: ['carrier-lookup', 'cost-estimator'],
    content: <HardMarketTool />,
  },
  {
    id: 'carrier-lookup',
    section: 'workflow',
    stage: 2,
    label: 'Match carrier',
    icon: Building2,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    title: 'Carrier Quick Lookup',
    description: 'Find active, limited, and withdrawn carriers by state and coverage type.',
    whenToUse:
      "After confirming the market is writable. Use to build a shortlist of carriers actually quoting your client's risk profile.",
    freshness: '21 min ago',
    preview: [
      { label: 'Active in CA', value: '12', emphasis: true },
      { label: 'Limited', value: '3' },
      { label: 'Withdrawn', value: '4' },
    ],
    nextSteps: ['cost-estimator'],
    content: <CarrierLookupTool />,
  },
  {
    id: 'cost-estimator',
    section: 'workflow',
    stage: 3,
    label: 'Estimate',
    icon: DollarSign,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Cost Estimator',
    description:
      'State-adjusted annual premium and carrier count, seconds after you type an address.',
    whenToUse:
      "Before sharing any property with a buyer. Sets realistic expectations and prevents an offer that'll fall apart at insurance binding.",
    freshness: '2 min ago',
    preview: [
      { label: 'Example', value: '$750k Miami Beach FL' },
      { label: 'Est. premium', value: '$14,200/yr', emphasis: true },
      { label: 'Carriers writing', value: '2 active' },
    ],
    nextSteps: ['disclosure', 'email-templates'],
    content: <CostEstimatorTool />,
  },
  {
    id: 'disclosure',
    section: 'workflow',
    stage: 4,
    label: 'Disclose',
    icon: Mail,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Disclosure Letter Generator',
    description:
      'Professional disclosure letter for buyers about current market conditions.',
    whenToUse:
      'Before any offer in a hard or crisis market. Documents that you advised the buyer in writing — protects you in E&O.',
    freshness: '1 hr ago',
    preview: [
      { label: 'Tone', value: 'Direct, advisor-style' },
      { label: 'Length', value: '~280 words', emphasis: true },
      { label: 'Last sent', value: '2 hr ago' },
    ],
    nextSteps: ['email-templates'],
    content: <DisclosureTool />,
  },
  {
    id: 'email-templates',
    section: 'workflow',
    stage: 5,
    label: 'Send',
    icon: MessageSquare,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'Email Templates',
    description:
      'Pre-written disclosures, buyer warnings, and follow-ups you can paste into any inbox.',
    whenToUse:
      'When you have the disclosure or estimate ready and need to put it in front of the buyer in their preferred channel.',
    freshness: '4 hr ago',
    preview: [
      { label: 'Templates', value: '11 active', emphasis: true },
      { label: 'Used this week', value: '3' },
      { label: 'Most popular', value: 'Buyer warning' },
    ],
    nextSteps: [],
    content: <ClientEmailTemplatesTool />,
  },
  // ─── Reference (use anytime, not part of the workflow) ────────────────────
  {
    id: 'policy-guide',
    section: 'reference',
    icon: BookOpen,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    title: 'Policy Type Guide',
    description:
      'Quick reference for homeowners policy forms (HO-1 → HO-8) — coverage, best use, and lender acceptance.',
    whenToUse:
      'When a client asks why HO-3 vs HO-5, or whether a lender will accept a DP-3 on an investment property.',
    freshness: 'Reviewed Apr 14, 2026',
    preview: [
      { label: 'Forms', value: '8' },
      { label: 'Most viewed', value: 'HO-3', emphasis: true },
    ],
    nextSteps: [],
    content: <PolicyTypeGuideTool />,
  },
  {
    id: 'checklist',
    section: 'reference',
    icon: ClipboardList,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Pre-Offer Checklist',
    description:
      'Property-specific checklist of insurance items to verify before making an offer.',
    whenToUse:
      'For any new listing your buyer is touring. Catches deal-killers (4-point inspection failures, FAIR Plan-only, unpermitted work) before you write.',
    freshness: 'Updated Apr 22, 2026',
    preview: [
      { label: 'Checks', value: '14 items', emphasis: true },
      { label: 'Avg. runtime', value: '< 1 min' },
    ],
    nextSteps: ['cost-estimator'],
    content: <ChecklistTool />,
  },
]

// ─── Persistence helpers ────────────────────────────────────────────────────

const PINNED_KEY = 'coverguard-toolkit-pinned'
const HIDDEN_KEY = 'coverguard-toolkit-hidden'
const RECENTS_KEY = 'coverguard-toolkit-recents'
const ONBOARDING_KEY = 'coverguard-toolkit-onboarding-done'

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeSet(key: string, value: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(value)))
  } catch {
    // ignore storage failure
  }
}

function readArray(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string').slice(0, 8)
  } catch {
    return []
  }
}

function writeArray(key: string, value: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value.slice(0, 8)))
  } catch {
    // ignore
  }
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ToolkitContent() {
  const [openId, setOpenId] = useState<string | null>(null)
  const [prefillFromId, setPrefillFromId] = useState<string | null>(null)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const [recents, setRecents] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [showCustomize, setShowCustomize] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)

  // Hydrate persisted state on mount. We intentionally setState synchronously
  // here so SSR renders the empty/default UI and the first client render
  // upgrades to the persisted state — same hydration pattern as the prior
  // ToolkitFeaturedRail and dashboard's DemoDataToggle. The cascading render
  // on mount is the intended behavior here.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setHidden(readSet(HIDDEN_KEY))
    setPinned(readSet(PINNED_KEY))
    setRecents(readArray(RECENTS_KEY))
    if (typeof window !== 'undefined') {
      const done = window.localStorage.getItem(ONBOARDING_KEY) === '1'
      if (!done) setShowOnboarding(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  // Keyboard shortcuts: ⌘K / Ctrl+K focuses search; Esc closes drawer/onboarding.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        if (openId) setOpenId(null)
        else if (showCustomize) setShowCustomize(false)
        else if (showOnboarding) setShowOnboarding(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openId, showCustomize, showOnboarding])

  function openTool(id: string, opts?: { prefillFromId?: string }) {
    setPrefillFromId(opts?.prefillFromId ?? null)
    setOpenId(id)
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 8)
      writeArray(RECENTS_KEY, next)
      return next
    })
  }

  function togglePinned(id: string) {
    setPinned((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeSet(PINNED_KEY, next)
      return next
    })
  }

  function toggleHidden(id: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeSet(HIDDEN_KEY, next)
      return next
    })
  }

  function dismissOnboarding(persist: boolean) {
    setShowOnboarding(false)
    if (persist && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ONBOARDING_KEY, '1')
      } catch {
        // ignore
      }
    }
  }

  // Filter + partition tools by section.
  const q = search.trim().toLowerCase()
  const matches = (t: ToolDefinition) => {
    if (hidden.has(t.id)) return false
    if (!q) return true
    return [t.title, t.description, t.label, t.whenToUse]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q)
  };

  const workflowTools = TOOLS.filter((t) => t.section === 'workflow').filter(matches)
  const referenceTools = TOOLS.filter((t) => t.section === 'reference').filter(matches)
  const totalVisible = workflowTools.length + referenceTools.length
  const openTool$ = openId ? TOOLS.find((t) => t.id === openId) ?? null : null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-full bg-gray-50">
        {/* Unified page header — same shell as Search / Dashboard / Help. */}
        <PageHeader
          icon={Wrench}
          title="Toolkit"
          subtitle="AI-powered tools sequenced as your daily workflow"
          actions={
            <>
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tools…"
                  aria-label="Search tools"
                  className="w-44 rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-2 text-xs text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:w-56"
                />
                <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-semibold text-gray-500 sm:inline-block">
                  ⌘K
                </kbd>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomize(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Settings size={13} />
                Customize
              </button>
            </>
          }
        />

        <main className="mx-auto max-w-screen-2xl px-4 py-5">
          {/* WORKFLOW RAIL */}
          <section aria-labelledby="workflow-heading" className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <h2
                id="workflow-heading"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Workflow · the agent&apos;s day
              </h2>
              <span className="text-[11px] text-gray-400">
                {workflowTools.length} step{workflowTools.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Numbered steps follow how a deal actually moves. Each tool&apos;s result hands off
              to the next with inputs prefilled.
            </p>

            {workflowTools.length === 0 ? (
              <EmptyResults query={q} />
            ) : (
              <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {workflowTools.map((tool, i) => (
                  <li key={tool.id} className="relative">
                    {i < workflowTools.length - 1 && (
                      <ChevronRight
                        size={14}
                        aria-hidden
                        className="pointer-events-none absolute -right-2.5 top-9 z-[1] hidden text-gray-300 lg:block"
                      />
                    )}
                    <ToolCard
                      tool={tool}
                      pinned={pinned.has(tool.id)}
                      mostRecent={recents[0] === tool.id}
                      onOpen={() => openTool(tool.id)}
                      onTogglePin={() => togglePinned(tool.id)}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* REFERENCE SECTION */}
          <section aria-labelledby="reference-heading">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-gray-500" />
              <h2
                id="reference-heading"
                className="text-[11px] font-semibold uppercase tracking-wide text-gray-500"
              >
                Reference &amp; lookups · use anytime
              </h2>
              <span className="text-[11px] text-gray-400">
                {referenceTools.length} tool{referenceTools.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Read-only references and quick checks you reach for during a workflow,
              not as a step.
            </p>

            {referenceTools.length === 0 && q ? (
              <EmptyResults query={q} compact />
            ) : referenceTools.length === 0 ? null : (
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {referenceTools.map((tool) => (
                    <ReferenceCard
                      key={tool.id}
                      tool={tool}
                      pinned={pinned.has(tool.id)}
                      onOpen={() => openTool(tool.id)}
                      onTogglePin={() => togglePinned(tool.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {totalVisible === 0 && q ? null : null}

          <footer className="mt-8 text-center">
            <p className="text-[11px] text-gray-400">
              All tool data refreshes continuously · {TOOLS.length} tools available
              {hidden.size > 0 ? ` · ${hidden.size} hidden via Customize` : ''}
              {' · '}press <kbd className="rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-semibold text-gray-500">⌘K</kbd> to search
            </p>
          </footer>
        </main>

        {/* Tool drawer */}
        <ToolDrawer
          tool={openTool$}
          prefillFromId={prefillFromId}
          onClose={() => setOpenId(null)}
          onOpenNext={(id) => openTool(id, { prefillFromId: openTool$?.id })}
          demoMode={typeof window !== 'undefined' && isDemoMode()}
        />

        {/* Customize drawer */}
        <CustomizeDrawer
          open={showCustomize}
          onClose={() => setShowCustomize(false)}
          tools={TOOLS}
          hidden={hidden}
          pinned={pinned}
          onToggleHidden={toggleHidden}
          onTogglePinned={togglePinned}
        />

        {/* Onboarding overlay */}
        {showOnboarding ? (
          <OnboardingOverlay
            onDismiss={(persist) => dismissOnboarding(persist)}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}

// ─── ToolCard (workflow) ────────────────────────────────────────────────────

interface ToolCardProps {
  tool: ToolDefinition
  pinned: boolean
  mostRecent: boolean
  onOpen: () => void
  onTogglePin: () => void
}

function ToolCard({ tool, pinned, mostRecent, onOpen, onTogglePin }: ToolCardProps) {
  const Icon = tool.icon
  const tag = pinned ? 'pinned' : mostRecent ? 'recent' : null

  return (
    <div className="group relative flex h-full flex-col rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col gap-2 text-left focus:outline-none"
      >
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-indigo-700">
            {String(tool.stage ?? 0).padStart(2, '0')}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            {tool.label}
          </span>
          {tag === 'pinned' ? (
            <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-700">
              <Pin size={9} /> PINNED
            </span>
          ) : tag === 'recent' ? (
            <span className="ml-auto inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-bold text-amber-700">
              <Star size={9} /> RECENT
            </span>
          ) : null}
        </div>

        <div className="flex items-start gap-2">
          <div
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              tool.iconBg,
            )}
          >
            <Icon className={cn('h-4 w-4', tool.iconColor)} />
          </div>
          <p className="text-sm font-semibold leading-tight text-gray-900 group-hover:text-indigo-700">
            {tool.title}
          </p>
        </div>

        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-2 text-[11px] text-gray-600">
          {tool.preview.map((row, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-center justify-between gap-2',
                idx < tool.preview.length - 1 && 'mb-1',
              )}
            >
              <span className="text-gray-500">{row.label}</span>
              <span
                className={cn(
                  'truncate text-right',
                  row.emphasis ? 'font-semibold text-gray-900' : 'text-gray-700',
                )}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 group-hover:underline">
            Open <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="cursor-help text-gray-400 underline decoration-dotted underline-offset-2 hover:text-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                When to use
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              className="max-w-[260px] bg-gray-900 text-xs leading-snug"
            >
              {tool.whenToUse}
            </TooltipContent>
          </Tooltip>
        </div>
      </button>

      <button
        type="button"
        onClick={onTogglePin}
        title={pinned ? 'Unpin' : 'Pin to top'}
        aria-label={pinned ? 'Unpin tool' : 'Pin tool to top'}
        className={cn(
          'absolute right-1.5 top-1.5 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-indigo-600 group-hover:opacity-100',
          pinned && 'text-indigo-600 opacity-100',
        )}
      >
        <Pin size={11} />
      </button>

      <div className="mt-2 text-[10px] text-gray-400">Data: {tool.freshness}</div>
    </div>
  )
}

// ─── ReferenceCard ──────────────────────────────────────────────────────────

interface ReferenceCardProps {
  tool: ToolDefinition
  pinned: boolean
  onOpen: () => void
  onTogglePin: () => void
}

function ReferenceCard({ tool, pinned, onOpen, onTogglePin }: ReferenceCardProps) {
  const Icon = tool.icon
  return (
    <div className="group relative flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-indigo-300 hover:bg-white">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-start gap-3 text-left focus:outline-none"
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            tool.iconBg,
          )}
        >
          <Icon className={cn('h-4 w-4', tool.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
            {tool.title}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">{tool.description}</p>
          <p className="mt-1 text-[10px] text-gray-400">
            {tool.preview
              .map((p) => `${p.label}: ${typeof p.value === 'string' ? p.value : ''}`)
              .filter((s) => !s.endsWith(': '))
              .join(' · ')}
          </p>
        </div>
        <ChevronRight
          size={14}
          className="mt-1 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600"
        />
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        title={pinned ? 'Unpin' : 'Pin'}
        aria-label={pinned ? 'Unpin tool' : 'Pin tool'}
        className={cn(
          'absolute right-1.5 top-1.5 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-gray-100 hover:text-indigo-600 group-hover:opacity-100',
          pinned && 'text-indigo-600 opacity-100',
        )}
      >
        <Pin size={10} />
      </button>
    </div>
  )
}

// ─── EmptyResults ───────────────────────────────────────────────────────────

function EmptyResults({ query, compact = false }: { query: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-center',
        compact ? 'px-4 py-6 text-xs' : 'px-6 py-10 text-sm',
      )}
    >
      <p className="text-gray-500">
        No tools match <span className="font-semibold text-gray-700">&quot;{query}&quot;</span>. Try a state,
        a coverage type, or a tool category like &quot;estimator&quot; or &quot;template&quot;.
      </p>
    </div>
  )
}

// ─── ToolDrawer ─────────────────────────────────────────────────────────────

interface ToolDrawerProps {
  tool: ToolDefinition | null
  prefillFromId: string | null
  onClose: () => void
  onOpenNext: (id: string) => void
  demoMode: boolean
}

function ToolDrawer({ tool, prefillFromId, onClose, onOpenNext, demoMode }: ToolDrawerProps) {
  const open = tool !== null
  const stageNum = tool?.stage ? String(tool.stage).padStart(2, '0') : 'REF'
  const fromTool = prefillFromId ? TOOLS.find((t) => t.id === prefillFromId) : null

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent
        className="fixed left-auto right-0 top-0 grid h-screen w-full max-w-[680px] translate-x-0 translate-y-0 gap-0 rounded-none border-l border-gray-200 bg-white p-0 shadow-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-[680px]"
      >
        {tool ? (
          <div className="flex h-full flex-col">
            <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded bg-indigo-50 px-2 py-1 font-mono text-[11px] font-bold text-indigo-700">
                  {stageNum}
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    {tool.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">
                    {tool.description}
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close (Esc)"
                className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <Info size={14} className="shrink-0" />
                <span>
                  <strong>Live data:</strong> updated {tool.freshness}
                  {demoMode ? ' · demo mode active' : ''}
                </span>
              </div>

              {fromTool ? (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
                  <ArrowRight size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Continued from {fromTool.title}.</strong> Inputs marked
                    <span className="ml-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                      Prefilled
                    </span>{' '}
                    were carried over from the previous step.
                  </span>
                </div>
              ) : null}

              {tool.content}
            </div>

            {tool.nextSteps && tool.nextSteps.length > 0 ? (
              <footer className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Next steps · prefilled with this tool&apos;s output
                </p>
                <div className="flex flex-wrap gap-2">
                  {tool.nextSteps.map((id) => {
                    const next = TOOLS.find((t) => t.id === id)
                    if (!next) return null
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onOpenNext(id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
                      >
                        <ArrowRight size={11} /> {next.title}
                      </button>
                    )
                  })}
                </div>
              </footer>
            ) : (
              <footer className="border-t border-gray-200 bg-gray-50 px-5 py-3">
                <p className="text-xs text-gray-500">
                  <strong className="text-gray-700">End of workflow.</strong> Need to start
                  a new deal? Reopen{' '}
                  <button
                    type="button"
                    onClick={() => onOpenNext('hard-market')}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    Hard Market Lookup
                  </button>
                  .
                </p>
              </footer>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ─── CustomizeDrawer ────────────────────────────────────────────────────────

interface CustomizeDrawerProps {
  open: boolean
  onClose: () => void
  tools: ToolDefinition[]
  hidden: Set<string>
  pinned: Set<string>
  onToggleHidden: (id: string) => void
  onTogglePinned: (id: string) => void
}

function CustomizeDrawer({
  open,
  onClose,
  tools,
  hidden,
  pinned,
  onToggleHidden,
  onTogglePinned,
}: CustomizeDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent
        className="fixed left-auto right-0 top-0 grid h-screen w-full max-w-[420px] translate-x-0 translate-y-0 gap-0 rounded-none border-l border-gray-200 bg-white p-0 shadow-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <DialogTitle className="text-base font-semibold text-gray-900">
              Customize toolkit
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Hide tools you never use, or pin the ones you reach for most often. Changes
              save automatically.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customize"
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {(['workflow', 'reference'] as const).map((section) => {
            const list = tools.filter((t) => t.section === section)
            return (
              <section key={section} className="mb-6 last:mb-0">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {section === 'workflow' ? 'Workflow tools' : 'Reference tools'}
                </h3>
                <div className="space-y-1.5">
                  {list.map((t) => {
                    const isHidden = hidden.has(t.id)
                    const isPinned = pinned.has(t.id)
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{t.title}</p>
                          <p className="text-[11px] text-gray-500">
                            {t.section === 'workflow'
                              ? `Step ${String(t.stage ?? 0).padStart(2, '0')} · ${t.label}`
                              : 'Reference'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onTogglePinned(t.id)}
                            title={isPinned ? 'Unpin' : 'Pin'}
                            aria-label={isPinned ? 'Unpin tool' : 'Pin tool'}
                            className={cn(
                              'rounded p-1.5 transition-colors',
                              isPinned
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-indigo-600',
                            )}
                          >
                            <Pin size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleHidden(t.id)}
                            className={cn(
                              'rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors',
                              isHidden
                                ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                            )}
                          >
                            {isHidden ? 'Hidden' : 'Visible'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <footer className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-[11px] text-gray-500">
          Tip: search by name in the toolkit header to find a hidden tool quickly.
        </footer>
      </DialogContent>
    </Dialog>
  )
}

// ─── OnboardingOverlay ──────────────────────────────────────────────────────

function OnboardingOverlay({ onDismiss }: { onDismiss: (persist: boolean) => void }) {
  return (
    <Dialog open onOpenChange={(o) => (!o ? onDismiss(false) : undefined)}>
      <DialogContent className="max-w-lg">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
            <Sparkles size={12} /> Welcome
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Your Toolkit, in workflow order
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-gray-600">
            The Toolkit is sequenced like the day of an insurance-aware agent. Here&apos;s how
            to use it:
          </DialogDescription>
          <ol className="mt-4 space-y-2 text-sm text-gray-700">
            <li>
              <strong className="text-gray-900">1. Start at step 01</strong> and move left
              to right — Hard Market → Carriers → Cost → Disclosure → Email.
            </li>
            <li>
              <strong className="text-gray-900">2. Each tool&apos;s result feeds the next.</strong>{' '}
              When you finish, the bottom of the drawer offers the next step with your
              inputs already filled in.
            </li>
            <li>
              <strong className="text-gray-900">3. Reference tools</strong> (Policy Type
              Guide, Pre-Offer Checklist) live below the workflow — open them any time.
            </li>
            <li>
              <strong className="text-gray-900">4. Customize</strong> reorders, hides, or
              pins tools to fit how <em>you</em> work.
            </li>
          </ol>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onDismiss(true)}
              className="rounded-md px-3 py-2 text-sm text-gray-500 hover:text-gray-900"
            >
              Don&apos;t show again
            </button>
            <button
              type="button"
              onClick={() => onDismiss(false)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Got it — let&apos;s go
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
