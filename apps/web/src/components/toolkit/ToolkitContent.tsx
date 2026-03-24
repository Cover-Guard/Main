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
  CheckCircle,
  XCircle,
  Copy,
  Check,
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
]

export function ToolkitContent() {
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Agent Toolkit</h1>
        </div>
      </div>
      <p className="text-sm text-blue-600 mb-8 ml-[52px]">AI-powered tools for insurance-savvy real estate professionals</p>

      <div className="space-y-2">
        {TOOLS.map(({ id, icon: Icon, iconBg, iconColor, title, description, content }) => {
          const isOpen = openId === id
          return (
            <div key={id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => toggle(id)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                <div className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
              </button>
              {isOpen && <div className="px-5 pb-5 border-t border-gray-100">{content}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
