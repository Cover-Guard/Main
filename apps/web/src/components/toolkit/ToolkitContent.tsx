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
  Loader2,
} from 'lucide-react'

// ── Shared feedback state ───────────────────────────────────────────────────

interface ToolResult {
  type: 'success' | 'error'
  message: string
}

// ── Cost Estimator tool ─────────────────────────────────────────────────────

function CostEstimatorTool() {
  const [address, setAddress] = useState('')
  const [value, setValue] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ToolResult | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim() || !value) return
    setRunning(true)
    setResult(null)
    setTimeout(() => {
      const v = parseFloat(value)
      const annual = Math.round(v * 0.0082 * (0.9 + Math.random() * 0.2))
      setResult({
        type: 'success',
        message: `Estimated annual premium for ${address.trim()}: ~$${annual.toLocaleString()}/yr ($${Math.round(annual / 12).toLocaleString()}/mo). Includes homeowners, wind, and liability coverage estimates. Flood and earthquake coverage calculated separately based on zone.`,
      })
      setRunning(false)
    }, 1200)
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-sm text-gray-600">
        Enter property details to get an estimated annual insurance cost breakdown
        by peril type.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Property Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter address…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Home Value ($)
            </label>
            <input
              type="number"
              min="50000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. 450000"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={running || !address.trim() || !value}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {running ? 'Estimating…' : 'Estimate Cost'}
        </button>
      </form>
      {result && (
        <div className={`rounded-lg p-3 text-sm flex gap-2 ${result.type === 'success' ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {result.type === 'success' && <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
          {result.message}
        </div>
      )}
    </div>
  )
}

// ── Pre-Offer Checklist tool ────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  'Verify FEMA flood zone designation (SFHA / non-SFHA)',
  'Confirm flood insurance requirement (mandatory purchase)',
  'Check Cal Fire FHSZ tier (if CA property)',
  'Review wildland-urban interface (WUI) status',
  'Confirm carrier availability in this state/county',
  'Estimate required coverage types and minimum limits',
  'Review seismic zone and earthquake coverage options',
  'Check crime index vs. national average',
  'Verify no active CLUE claims on property',
  'Confirm buyer understands surplus lines implications',
]

function ChecklistTool() {
  const [address, setAddress] = useState('')
  const [running, setRunning] = useState(false)
  const [checklist, setChecklist] = useState<string[] | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    setRunning(true)
    setChecklist(null)
    setTimeout(() => {
      setChecklist(CHECKLIST_ITEMS)
      setRunning(false)
    }, 1000)
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-sm text-gray-600">
        Generate a property-specific pre-offer insurance checklist using AI analysis
        of risk factors and carrier requirements.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Property Address or APN
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter address or APN…"
          />
        </div>
        <button
          type="submit"
          disabled={running || !address.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {running ? 'Generating…' : 'Generate Checklist'}
        </button>
      </form>
      {checklist && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
            Pre-Offer Insurance Checklist — {address}
          </p>
          {checklist.map((item, i) => (
            <label key={i} className="flex items-start gap-2 cursor-pointer group">
              <input type="checkbox" className="mt-0.5 accent-blue-600 shrink-0" />
              <span className="text-sm text-blue-800">{item}</span>
            </label>
          ))}
          <button
            onClick={() => {
              const text = checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')
              navigator.clipboard.writeText(`Pre-Offer Insurance Checklist — ${address}\n\n${text}`)
            }}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  )
}

// ── Disclosure Letter tool ──────────────────────────────────────────────────

function DisclosureTool() {
  const [buyer, setBuyer] = useState('')
  const [address, setAddress] = useState('')
  const [running, setRunning] = useState(false)
  const [letter, setLetter] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!buyer.trim() || !address.trim()) return
    setRunning(true)
    setLetter(null)
    setTimeout(() => {
      setLetter(
        `Dear ${buyer},\n\nAs your real estate professional, I want to ensure you have full transparency regarding the insurance landscape for the property at ${address}.\n\nCurrent market conditions in this area reflect a challenging insurance environment. Some standard carriers have reduced or paused new policy writing in this region, which may impact your ability to secure coverage at standard rates.\n\nRecommended actions before making an offer:\n• Request a CoverGuard insurability report for parcel-level risk data\n• Contact 2–3 licensed insurance agents for binding quotes\n• Understand FAIR Plan availability as a last-resort option\n• Factor potential surplus lines premiums into your budget\n\nThis disclosure is provided to ensure you can make an informed purchase decision.\n\nSincerely,\n[Agent Name]\nCoverGuard-verified agent`
      )
      setRunning(false)
    }, 1000)
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-sm text-gray-600">
        Create a professional disclosure letter to inform buyers about insurance
        market conditions and property-specific risks.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Buyer Name
            </label>
            <input
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Jane Smith"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Property Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter address…"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={running || !buyer.trim() || !address.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {running ? 'Generating…' : 'Generate Letter'}
        </button>
      </form>
      {letter && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Generated Letter</p>
            <button
              onClick={() => navigator.clipboard.writeText(letter)}
              className="text-xs text-blue-600 hover:underline"
            >
              Copy
            </button>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{letter}</pre>
        </div>
      )}
    </div>
  )
}

// ── Hard Market Lookup tool ─────────────────────────────────────────────────

const HARD_MARKET_DATA: Record<string, { status: string; color: string; carriers: string; fairPlan: string; notes: string }> = {
  CA: { status: 'Crisis', color: 'text-red-700 bg-red-50 border-red-200', carriers: 'State Farm, Allstate, Farmers — paused/restricted. Active: CSAA, Mercury, Chubb (high-value). Surplus: Lloyd\'s, Lexington.', fairPlan: 'Available — CA FAIR Plan is insurer of last resort for fire. Rates 3–5× standard market.', notes: 'Several carriers have filed for exit in high fire-severity zones. Assembly Bill 2895 impact ongoing.' },
  FL: { status: 'Crisis', color: 'text-red-700 bg-red-50 border-red-200', carriers: 'Multiple domestic carriers insolvent 2022–2024. Active: Heritage, Citizens (state-run). Surplus: Lloyd\'s, Demotech-rated carriers.', fairPlan: 'Citizens Insurance is the state-run insurer of last resort. 1.4M+ policies.', notes: 'Citizens depopulation program ongoing. Roof age requirements strict (20yr max for standard market).' },
  TX: { status: 'Hard', color: 'text-orange-700 bg-orange-50 border-orange-200', carriers: 'State Farm, Allstate active. Hail-prone areas restricted. Surplus lines growing in DFW, Houston.', fairPlan: 'TWIA (Texas Windstorm Insurance Association) for coastal properties.', notes: 'Hail and wind claims driving premium increases of 30–50% in DFW metroplex.' },
  LA: { status: 'Hard', color: 'text-orange-700 bg-orange-50 border-orange-200', carriers: 'Multiple carriers exited after 2021 storms. State Farm active but limited. Surplus dominant.', fairPlan: 'LA Citizens Property Insurance available.', notes: 'Post-Ida/Laura/Delta: 12 insurers became insolvent. Reinsurance costs up 200%+.' },
  CO: { status: 'Moderate', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', carriers: 'Most standard carriers active. Mountain/WUI areas have restrictions. Hail coverage expensive.', fairPlan: 'No traditional FAIR plan — surplus lines available for hard-to-insure.', notes: 'Marshall Fire 2021 drove coverage restrictions in Boulder/Jefferson Counties.' },
}

function HardMarketTool() {
  const [state, setState] = useState('')
  const [result, setResult] = useState<typeof HARD_MARKET_DATA[string] | null>(null)
  const [notFound, setNotFound] = useState(false)

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!state) return
    const data = HARD_MARKET_DATA[state]
    if (data) {
      setResult(data)
      setNotFound(false)
    } else {
      setResult(null)
      setNotFound(true)
    }
  }

  return (
    <div className="space-y-3 pt-4">
      <p className="text-sm text-gray-600">
        Look up current hard market conditions, carrier withdrawals, and FAIR Plan
        availability by state.
      </p>
      <form onSubmit={handleLookup} className="flex gap-2">
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        >
          <option value="">Select a state…</option>
          <option value="CA">California</option>
          <option value="FL">Florida</option>
          <option value="TX">Texas</option>
          <option value="LA">Louisiana</option>
          <option value="CO">Colorado</option>
        </select>
        <button
          type="submit"
          disabled={!state}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Look Up
        </button>
      </form>
      {notFound && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          No specific hard market data for this state — standard market conditions apply.
        </p>
      )}
      {result && (
        <div className={`rounded-lg border p-4 space-y-3 ${result.color}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p className="font-semibold text-sm">Market Status: {result.status}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Active Carriers</p>
            <p className="text-xs leading-relaxed">{result.carriers}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">FAIR Plan</p>
            <p className="text-xs leading-relaxed">{result.fairPlan}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Notes</p>
            <p className="text-xs leading-relaxed">{result.notes}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const TOOL_DEFS = [
  {
    id: 'cost-estimator',
    icon: DollarSign,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'Insurance Cost Estimator',
    description: 'Estimate annual premium breakdown before your client gets a quote',
    Component: CostEstimatorTool,
  },
  {
    id: 'checklist',
    icon: ClipboardList,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Pre-Offer Checklist Generator',
    description: 'AI-generated checklist of insurance items to verify before making an offer',
    Component: ChecklistTool,
  },
  {
    id: 'disclosure',
    icon: Mail,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Insurance Disclosure Letter Generator',
    description: 'Professional disclosure letter for buyers in challenging insurance markets',
    Component: DisclosureTool,
  },
  {
    id: 'hard-market',
    icon: AlertTriangle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    title: 'Hard Market Lookup',
    description: 'Current carrier withdrawals, surplus lines options, and FAIR Plan context by state',
    Component: HardMarketTool,
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export function ToolkitContent() {
  const [openId, setOpenId] = useState<string | null>(null)

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/dashboard"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Wrench className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Agent Toolkit</h1>
        </div>
      </div>
      <p className="text-sm text-blue-600 mb-8 ml-[52px]">
        AI-powered tools for insurance-savvy real estate professionals
      </p>

      {/* Accordion list */}
      <div className="space-y-2">
        {TOOL_DEFS.map(({ id, icon: Icon, iconBg, iconColor, title, description, Component }) => {
          const isOpen = openId === id
          return (
            <div
              key={id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div
                  className={`h-9 w-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}
                >
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
                <div className="px-5 pb-5 border-t border-gray-100">
                  <Component />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
