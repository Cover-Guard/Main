'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Shield,
  MapPin,
  ChevronDown,
  ChevronUp,
  Zap,
  Building2,
  TrendingUp,
} from 'lucide-react'

const STATE_RISKS = [
  { label: 'Severe Risk',   color: 'bg-purple-500', states: 2 },
  { label: 'High Risk',     color: 'bg-red-500',    states: 9 },
  { label: 'Elevated Risk', color: 'bg-orange-400', states: 15 },
  { label: 'Moderate Risk', color: 'bg-yellow-400', states: 17 },
  { label: 'Low Risk',      color: 'bg-green-500',  states: 7 },
]

const RISK_LEGEND = [
  { label: 'Low',      color: '#22c55e' },
  { label: 'Moderate', color: '#f97316' },
  { label: 'Elevated', color: '#fb923c' },
  { label: 'High',     color: '#ef4444' },
  { label: 'Severe',   color: '#a855f7' },
]

export function NewCheckPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [yearBuilt, setYearBuilt] = useState('')
  const [sqft, setSqft] = useState('')

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    const params = new URLSearchParams({ q: address.trim() })
    if (yearBuilt) params.set('yearBuilt', yearBuilt)
    if (sqft) params.set('sqft', sqft)
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero heading */}
      <div className="bg-white pt-10 pb-6 px-8 text-center border-b border-gray-100">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
          <Shield className="h-3.5 w-3.5" />
          Property Insurance Intelligence
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
          Know if a property is{' '}
          <span className="text-emerald-500">insurable</span> before you bid
        </h1>
      </div>

      {/* Split: search panel + map */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 380 }}>
        {/* Left — Search panel */}
        <div className="w-[420px] shrink-0 bg-white border-r border-gray-200 overflow-y-auto flex flex-col">
          <div className="p-6 flex flex-col gap-4 flex-1">
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                Search by address or click the map
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enter a full address, ZIP, city, state, or APN — or click
                anywhere on the map to drop a pin.
              </p>
            </div>

            {/* Search form */}
            <form onSubmit={handleCheck} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-emerald-400">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address, ZIP, city, state, or APN (e.g. …)"
                  className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                <Shield className="h-4 w-4" />
                Check Insurability
              </button>
            </form>

            {/* Property details accordion */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setDetailsOpen(!detailsOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span>Property Details (Optional — Improves Analysis)</span>
                {detailsOpen ? (
                  <ChevronUp className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>
              {detailsOpen && (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Year Built
                    </label>
                    <input
                      type="number"
                      min="1800"
                      max={new Date().getFullYear()}
                      value={yearBuilt}
                      onChange={(e) => setYearBuilt(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="e.g. 1995"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Square Footage
                    </label>
                    <input
                      type="number"
                      min="100"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="e.g. 1800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Accuracy note */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
              <p className="text-xs text-emerald-700">
                Full address or APN (e.g. 123-456-789) gives parcel-level
                accuracy. City/ZIP returns area estimates.
              </p>
            </div>

            {/* State Risk Reference */}
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                State Risk Reference
              </p>
              <div className="space-y-1.5">
                {STATE_RISKS.map(({ label, color, states }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${color} shrink-0`}
                      />
                      <span className="text-xs text-gray-700">{label}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {states} states
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — Map */}
        <div className="flex-1 relative bg-[#e8ecf0] overflow-hidden">
          {/* Risk filter bar */}
          <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-1 bg-white/95 backdrop-blur rounded-lg shadow px-2 py-1.5 text-xs font-medium">
            <span className="text-gray-500 mr-1">FILTER BY RISK</span>
            <span className="text-gray-400 text-xs ml-auto">1/1 shown</span>
            {['All', 'Low', 'Moderate', 'Elevated', 'High', 'Severe'].map(
              (level, i) => (
                <button
                  key={level}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                    i === 0
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {i > 0 && (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: RISK_LEGEND[i - 1]?.color ?? '#999',
                      }}
                    />
                  )}
                  {level} {i > 0 && <span className="text-gray-400">(0)</span>}
                </button>
              )
            )}
          </div>

          {/* Map placeholder — styled like OpenStreetMap */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">
                Enter an address to see it on the map
              </p>
              <p className="text-xs mt-1">
                Interactive map with risk overlays
              </p>
            </div>
          </div>

          {/* Risk legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow px-3 py-2 text-xs">
            <p className="font-semibold text-gray-700 mb-1.5 uppercase tracking-wide text-[10px]">
              Risk Level
            </p>
            <div className="space-y-1">
              {RISK_LEGEND.map(({ label, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map attribution */}
          <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 px-1.5 py-0.5 rounded">
            © OpenStreetMap contributors
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="bg-white border-t border-gray-100 px-8 py-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Zap className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50"
            title="Instant Insurability Score"
            description="Get a real-time assessment of whether a property can be insured before you make an offer."
          />
          <FeatureCard
            icon={<Building2 className="h-5 w-5 text-blue-500" />}
            iconBg="bg-blue-50"
            title="Real Carrier Data"
            description="See which carriers are actually writing policies in the area — not just generic estimates."
          />
          <FeatureCard
            icon={<TrendingUp className="h-5 w-5 text-purple-500" />}
            iconBg="bg-purple-50"
            title="Bind Coverage Fast"
            description="Request bindable quotes directly, so you can close escrow without insurance surprises."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-100 py-3 text-center">
        <p className="text-xs text-gray-400">
          CoverGuard — Real-time property insurance intelligence for real estate
          professionals
        </p>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  iconBg,
  title,
  description,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
