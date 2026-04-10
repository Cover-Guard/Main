'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ToolkitFeaturedRail } from '@/components/toolkit/ToolkitFeaturedRail'
import { isDemoMode } from '@/lib/mockData'
import {
  ArrowLeft,
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

// ─── Main component ────────────────────────────────────────────────────────

const TOOLS = [
  {
    id: 'cost-estimator',
    icon: DollarSign,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Insurance Cost Estimator',
    description: 'Estimate annual premium breakdown by coverage type before your client gets a quote',
    content: <CostEstimatorTool />,
  },
  {
    id: 'checklist',
    icon: ClipboardList,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Pre-Offer Checklist Generator',
    description: 'Property-specific checklist of insurance items to verify before making an offer',
    content: <ChecklistTool />,
  },
  {
    id: 'disclosure',
    icon: Mail,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Insurance Disclosure Letter Generator',
    description: 'Professional disclosure letter for buyers about current market conditions',
    content: <DisclosureTool />,
  },
  {
    id: 'hard-market',
    icon: AlertTriangle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Hard Market Lookup',
    description: 'Carrier withdrawals, FAIR Plan options, and surplus lines availability by state',
    content: <HardMarketTool />,
  },
  {
    id: 'carrier-lookup',
    icon: Building2,
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    title: 'Carrier Quick Lookup',
    description: 'Find active, limited, and withdrawn carriers by state and coverage type',
    content: <CarrierLookupTool />,
  },
  {
    id: 'email-templates',
    icon: MessageSquare,
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
    title: 'Client Email Templates',
    description: 'Ready-to-send emails for hard market alerts, flood zones, FAIR Plan explanations, and more',
    content: <ClientEmailTemplatesTool />,
  },
  {
    id: 'policy-guide',
    icon: BookOpen,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    title: 'Policy Type Guide (HO-1 to HO-8)',
    description: 'Quick reference for homeowners policy forms — coverage, best use, and lender acceptance',
    content: <PolicyTypeGuideTool />,
  },
]

export function ToolkitContent() {
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  const gridRef = useRef<HTMLDivElement>(null)
  const openToolById = (id: string) => {
    setOpenId(id)
    // Scroll the grid into view after state updates paint the open tool.
    requestAnimationFrame(() => {
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="p-3 lg:p-4 max-w-full mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-gray-700" />
          <h1 className="text-heading text-foreground">Agent Toolkit</h1>
        </div>
      </div>
      <p className="text-body text-muted-foreground mb-5 ml-[44px]">
        AI-powered tools for insurance-savvy real estate professionals
      </p>

      <ToolkitFeaturedRail
        demoMode={typeof window !== 'undefined' && isDemoMode()}
        onOpenCostEstimator={() => openToolById('cost-estimator')}
        onOpenHardMarket={() => openToolById('hard-market')}
        onOpenEmailTemplates={() => openToolById('email-templates')}
      />

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map(({ id, icon: Icon, iconBg, iconColor, title, description, content }) => {
          const isOpen = openId === id
          return (
            <div key={id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-panel-hover hover:border-gray-300 ${isOpen ? 'md:col-span-2 lg:col-span-3' : ''}`}>
              <button type="button" onClick={() => toggle(id)} className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left">
                <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-subheading text-foreground">{title}</p>
                  <p className="text-caption text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
                </div>
                <div className="shrink-0 mt-1">
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </button>
              {isOpen && <div className="px-4 pb-4 border-t border-gray-100">{content}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
