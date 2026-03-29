'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import type { Property, PropertyRiskProfile, InsuranceCostEstimate, InsurabilityStatus } from '@coverguard/shared'
import { getProperty, getPropertyRisk, getPropertyInsurance, getPropertyInsurability, searchProperties } from '@/lib/api'
import { formatCurrency } from '@coverguard/shared'
import {
  Search, X, Plus, Droplets, Flame, Wind, Mountain, ShieldAlert,
  DollarSign, CheckCircle, XCircle, AlertTriangle, Trophy,
} from 'lucide-react'

interface PropertyData {
  property: Property
  risk: PropertyRiskProfile | null
  insurance: InsuranceCostEstimate | null
  insurability: InsurabilityStatus | null
}

const RISK_COLORS: Record<string, string> = {
  LOW:      'text-green-600 bg-green-50 border-green-200',
  MODERATE: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  HIGH:     'text-orange-700 bg-orange-50 border-orange-200',
  VERY_HIGH:'text-red-700 bg-red-50 border-red-200',
  EXTREME:  'text-red-900 bg-red-100 border-red-300',
}

const RISK_BAR_COLOR: Record<string, string> = {
  LOW: 'bg-green-400', MODERATE: 'bg-yellow-400',
  HIGH: 'bg-orange-400', VERY_HIGH: 'bg-red-500', EXTREME: 'bg-red-700',
}

const INSUR_CONFIG: Record<string, { label: string; color: string }> = {
  LOW:       { label: 'Easily Insurable',          color: 'text-green-700' },
  MODERATE:  { label: 'Insurable w/ Conditions',   color: 'text-yellow-700' },
  HIGH:      { label: 'Difficult to Insure',        color: 'text-orange-700' },
  VERY_HIGH: { label: 'Very Hard to Insure',        color: 'text-red-700' },
  EXTREME:   { label: 'Potentially Uninsurable',    color: 'text-red-900' },
}

function ScoreBar({ score, level }: { score: number; level: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold w-6 text-right text-gray-700">{score}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${RISK_BAR_COLOR[level] ?? 'bg-gray-300'}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

function Winner({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full ml-1">
      <Trophy className="h-2.5 w-2.5" /> Best
    </span>
  )
}

export function CompareView() {
  const [slots, setSlots] = useState<(PropertyData | null)[]>([null, null, null])
  const [loading, setLoading] = useState<boolean[]>([false, false, false])
  const [search, setSearch] = useState<{ idx: number; query: string } | null>(null)
  const [searchResults, setSearchResults] = useState<Property[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchDebounce = useRef<NodeJS.Timeout | null>(null)

  const loadProperty = useCallback(async function loadProperty(id: string, idx: number) {
    setLoading((prev) => { const n = [...prev]; n[idx] = true; return n })
    try {
      const [prop, risk, ins, insur] = await Promise.allSettled([
        getProperty(id),
        getPropertyRisk(id),
        getPropertyInsurance(id),
        getPropertyInsurability(id),
      ])
      if (prop.status === 'rejected') return
      setSlots((prev) => {
        const next = [...prev]
        next[idx] = {
          property: prop.value,
          risk: risk.status === 'fulfilled' ? risk.value : null,
          insurance: ins.status === 'fulfilled' ? ins.value : null,
          insurability: insur.status === 'fulfilled' ? insur.value : null,
        }
        return next
      })
    } finally {
      setLoading((prev) => { const n = [...prev]; n[idx] = false; return n })
    }
  }, [])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [])

  // Read property IDs from URL (supports ?a=&b=&c= and ?ids=id1,id2,id3)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idsParam = params.get('ids')
    const ids = idsParam
      ? idsParam.split(',').slice(0, 3)
      : [params.get('a'), params.get('b'), params.get('c')]
    ids.forEach((id, idx) => { if (id) loadProperty(id, idx) })
  }, [loadProperty])

  function removeSlot(idx: number) {
    setSlots((prev) => { const n = [...prev]; n[idx] = null; return n })
  }

  async function handleSearchChange(query: string) {
    if (!search) return
    setSearch({ ...search, query })
    setSearchError(null)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!query.trim()) { setSearchResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const result = await searchProperties({ address: query, limit: 5 })
        setSearchResults(result.properties.slice(0, 5))
      } catch (err) {
        setSearchResults([])
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('Network error')) {
          setSearchError('Network error. Check your connection.')
        } else if (msg.includes('Service temporarily') || msg.includes('unavailable')) {
          setSearchError('Service temporarily unavailable.')
        } else {
          setSearchError('Search failed. Please try again.')
        }
      } finally {
        setSearchLoading(false)
      }
    }, 400)
  }

  function selectProperty(prop: Property) {
    if (!search) return
    loadProperty(prop.id, search.idx)
    setSearch(null)
    setSearchResults([])
  }

  // Determine winners (use != null to keep valid 0 scores/costs)
  const scores = slots.map((s) => s?.risk?.overallRiskScore ?? null)
  const costs = slots.map((s) => s?.insurance?.estimatedAnnualTotal ?? null)
  const validScores = scores.filter((v): v is number => v != null)
  const validCosts = costs.filter((v): v is number => v != null)
  const minScore = validScores.length > 1 ? Math.min(...validScores) : null
  const minCost = validCosts.length > 1 ? Math.min(...validCosts) : null

  const PERIL_ROWS = [
    { key: 'flood', label: 'Flood', icon: Droplets },
    { key: 'fire', label: 'Fire', icon: Flame },
    { key: 'wind', label: 'Wind', icon: Wind },
    { key: 'earthquake', label: 'Earthquake', icon: Mountain },
    { key: 'crime', label: 'Crime', icon: ShieldAlert },
  ] as const

  const filledSlots = slots.filter(Boolean).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compare Properties</h1>
        <p className="text-sm text-gray-500 mt-1">Side-by-side risk and insurability comparison — up to 3 properties</p>
      </div>

      {/* Property columns */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map((idx) => {
          const slot = slots[idx]
          const isLoading = loading[idx]
          const isSearching = search?.idx === idx

          return (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {slot ? (
                <div>
                  <div className="bg-[#0d1929] px-4 py-3 flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{slot.property.address}</p>
                      <p className="text-xs text-white/50 mt-0.5">{slot.property.city}, {slot.property.state} {slot.property.zip}</p>
                      {slot.property.estimatedValue && (
                        <p className="text-xs text-teal-400 mt-0.5">{formatCurrency(slot.property.estimatedValue)}</p>
                      )}
                    </div>
                    <button onClick={() => removeSlot(idx)} className="text-white/30 hover:text-white ml-2 mt-0.5 shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Link href={`/properties/${slot.property.id}`} className="block px-4 py-2 text-xs text-blue-600 hover:underline border-b border-gray-100">
                    View full report →
                  </Link>
                </div>
              ) : isLoading ? (
                <div className="px-4 py-6 flex items-center justify-center">
                  <div className="text-xs text-gray-400 animate-pulse">Loading…</div>
                </div>
              ) : isSearching ? (
                <div className="p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                    <input
                      autoFocus
                      value={search.query}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search address or ZIP…"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  {searchLoading && <p className="text-xs text-gray-400 mt-2 px-1">Searching…</p>}
                  {searchError && <p className="text-xs text-red-500 mt-2 px-1">{searchError}</p>}
                  {searchResults.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {searchResults.map((p) => (
                        <button key={p.id} onClick={() => selectProperty(p)} className="w-full text-left px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <p className="text-xs font-medium text-gray-800">{p.address}</p>
                          <p className="text-[10px] text-gray-400">{p.city}, {p.state} {p.zip}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setSearch(null); setSearchResults([]) }} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-center">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearch({ idx, query: '' })}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-xs font-medium">Add Property</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {filledSlots < 2 && (
        <div className="text-center py-12 text-gray-400">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Add at least 2 properties to compare</p>
        </div>
      )}

      {filledSlots >= 2 && (
        <div className="space-y-4">
          {/* Overall Risk Score */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Overall Risk Score (lower = better)</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {slots.map((slot, idx) => (
                <div key={idx} className="px-5 py-4">
                  {slot ? (
                    <div>
                      {slot.risk ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold ${RISK_COLORS[slot.risk.overallRiskLevel]?.split(' ')[0] ?? 'text-gray-800'}`}>
                              {slot.risk.overallRiskScore}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${RISK_COLORS[slot.risk.overallRiskLevel] ?? ''}`}>
                              {slot.risk.overallRiskLevel.replace('_', ' ')}
                            </span>
                            <Winner active={slot.risk.overallRiskScore === minScore} />
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-2 rounded-full ${RISK_BAR_COLOR[slot.risk.overallRiskLevel] ?? 'bg-gray-300'}`} style={{ width: `${slot.risk.overallRiskScore}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-sm text-gray-400">N/A</span>}
                    </div>
                  ) : <span className="text-sm text-gray-200">—</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Peril rows */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Risk by Peril</p>
            </div>
            {PERIL_ROWS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="border-b border-gray-100 last:border-0">
                <div className="grid grid-cols-3 divide-x divide-gray-100">
                  {slots.map((slot, idx) => {
                    const peril = slot?.risk?.[key]
                    return (
                      <div key={idx} className="px-5 py-3">
                        {idx === 0 && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Icon className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-xs font-medium text-gray-500">{label}</span>
                          </div>
                        )}
                        {peril ? (
                          <ScoreBar score={peril.score} level={peril.level} />
                        ) : slot ? (
                          <span className="text-xs text-gray-400">N/A</span>
                        ) : (
                          <span className="text-xs text-gray-200">—</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Insurability */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Insurability Assessment</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {slots.map((slot, idx) => (
                <div key={idx} className="px-5 py-4">
                  {slot?.insurability ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        {slot.insurability.isInsurable
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-red-500" />}
                        <span className={`text-sm font-semibold ${INSUR_CONFIG[slot.insurability.difficultyLevel]?.color ?? 'text-gray-700'}`}>
                          {INSUR_CONFIG[slot.insurability.difficultyLevel]?.label ?? slot.insurability.difficultyLevel}
                        </span>
                      </div>
                      {slot.insurability.potentialIssues.length > 0 && (
                        <p className="text-xs text-gray-400">{slot.insurability.potentialIssues.length} issue{slot.insurability.potentialIssues.length !== 1 ? 's' : ''} flagged</p>
                      )}
                    </div>
                  ) : slot ? (
                    <span className="text-sm text-gray-400">N/A</span>
                  ) : (
                    <span className="text-sm text-gray-200">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Insurance Cost */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Est. Annual Insurance Cost (lower = better)
              </p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              {slots.map((slot, idx) => (
                <div key={idx} className="px-5 py-4">
                  {slot?.insurance ? (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xl font-bold text-gray-900">
                          {formatCurrency(slot.insurance.estimatedAnnualTotal)}
                        </span>
                        <Winner active={slot.insurance.estimatedAnnualTotal === minCost} />
                      </div>
                      <p className="text-xs text-gray-400">{formatCurrency(slot.insurance.estimatedMonthlyTotal)}/mo</p>
                      <p className="text-xs text-gray-400 mt-0.5 capitalize">{slot.insurance.confidenceLevel.toLowerCase()} confidence</p>
                    </div>
                  ) : slot ? (
                    <span className="text-sm text-gray-400">N/A</span>
                  ) : (
                    <span className="text-sm text-gray-200">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Property Details</p>
            </div>
            {[
              { label: 'Estimated Value', fn: (s: PropertyData) => s.property.estimatedValue ? formatCurrency(s.property.estimatedValue) : 'N/A' },
              { label: 'Year Built', fn: (s: PropertyData) => s.property.yearBuilt ? String(s.property.yearBuilt) : 'N/A' },
              { label: 'Square Feet', fn: (s: PropertyData) => s.property.squareFeet ? `${s.property.squareFeet.toLocaleString()} sq ft` : 'N/A' },
              { label: 'Bedrooms / Baths', fn: (s: PropertyData) => (s.property.bedrooms || s.property.bathrooms) ? `${s.property.bedrooms ?? '?'} bd / ${s.property.bathrooms ?? '?'} ba` : 'N/A' },
              { label: 'Property Type', fn: (s: PropertyData) => s.property.propertyType?.replace('_', ' ') ?? 'N/A' },
            ].map(({ label, fn }) => (
              <div key={label} className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                {slots.map((slot, idx) => (
                  <div key={idx} className="px-5 py-3">
                    {idx === 0 && <p className="text-xs text-gray-400 mb-0.5">{label}</p>}
                    <p className="text-sm text-gray-700">{slot ? fn(slot) : '—'}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
