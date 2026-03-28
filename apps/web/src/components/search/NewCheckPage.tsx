'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { APIProvider } from '@vis.gl/react-google-maps'
import {
  Shield,
  MapPin,
  ChevronDown,
  ChevronUp,
  Zap,
  Building2,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { SearchMapClient } from '@/components/map/SearchMapClient'
import { useGooglePlacesAutocomplete } from '@/lib/useGooglePlacesAutocomplete'
import type { PlacePrediction } from '@coverguard/shared'
import { cn } from '@/lib/utils'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export function NewCheckPage() {
  if (!GOOGLE_MAPS_KEY) return <NewCheckPageFallback />

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={['places']}>
      <NewCheckPageWithPlaces />
    </APIProvider>
  )
}

/** Version with Google Places autocomplete (requires APIProvider). */
function NewCheckPageWithPlaces() {
  const { predictions, loading, fetchPredictions, clearPredictions, resetSessionToken } =
    useGooglePlacesAutocomplete()

  return (
    <NewCheckPageInner
      predictions={predictions}
      loading={loading}
      fetchPredictions={fetchPredictions}
      clearPredictions={clearPredictions}
      resetSessionToken={resetSessionToken}
    />
  )
}

/** Fallback version without Google Places (no APIProvider). */
function NewCheckPageFallback() {
  return (
    <NewCheckPageInner
      predictions={[]}
      loading={false}
      fetchPredictions={() => {}}
      clearPredictions={() => {}}
      resetSessionToken={() => {}}
    />
  )
}

interface NewCheckPageInnerProps {
  predictions: PlacePrediction[]
  loading: boolean
  fetchPredictions: (input: string) => void
  clearPredictions: () => void
  resetSessionToken: () => void
}

function NewCheckPageInner({
  predictions,
  loading,
  fetchPredictions,
  clearPredictions,
  resetSessionToken,
}: NewCheckPageInnerProps) {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [yearBuilt, setYearBuilt] = useState('')
  const [sqft, setSqft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function handleAddressChange(value: string) {
    setAddress(value)
    setSelectedPlaceId(null)
    fetchPredictions(value)
    if (value.trim().length >= 3) {
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }

  function selectPrediction(prediction: PlacePrediction) {
    setAddress(prediction.description)
    setSelectedPlaceId(prediction.placeId)
    setShowDropdown(false)
    clearPredictions()
    resetSessionToken()
  }

  function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!address.trim()) return
    const params = new URLSearchParams({ q: address.trim() })
    if (selectedPlaceId) params.set('placeId', selectedPlaceId)
    if (yearBuilt) params.set('yearBuilt', yearBuilt)
    if (sqft) params.set('sqft', sqft)
    router.push(`/search?${params.toString()}`)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex flex-col h-full">
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
        <div className="w-[380px] shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-5 flex flex-col gap-3">
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                Search by address or click the map
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Start typing a US property address for suggestions.
              </p>
            </div>

            {/* Search form */}
            <form onSubmit={handleCheck} className="flex flex-col gap-2">
              <div className="relative">
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-emerald-400">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                  <input
                    ref={inputRef}
                    value={address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (!showDropdown || predictions.length === 0) return
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0))
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1))
                      } else if (e.key === 'Enter' && activeIndex >= 0) {
                        e.preventDefault()
                        selectPrediction(predictions[activeIndex]!)
                      } else if (e.key === 'Escape') {
                        setShowDropdown(false)
                      }
                    }}
                    onFocus={() => { if (predictions.length > 0) setShowDropdown(true) }}
                    placeholder="Address — e.g. 123 Main St, Austin, TX"
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-controls="newcheck-suggestions"
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                  />
                  {loading && <Loader2 className="h-4 w-4 animate-spin text-emerald-500 shrink-0" />}
                </div>

                {/* Predictions dropdown */}
                {showDropdown && predictions.length > 0 && (
                  <div
                    ref={dropdownRef}
                    id="newcheck-suggestions"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                  >
                    {predictions.map((prediction, index) => (
                      <button
                        key={prediction.placeId}
                        role="option"
                        type="button"
                        aria-selected={index === activeIndex}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                          index === activeIndex ? 'bg-emerald-50 text-emerald-900' : 'text-gray-700 hover:bg-gray-50',
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectPrediction(prediction)}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-xs">{prediction.mainText}</p>
                          <p className="truncate text-[11px] text-gray-500">{prediction.secondaryText}</p>
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-gray-100 px-3 py-1.5 text-right">
                      <span className="text-[10px] text-gray-400">Powered by Google</span>
                    </div>
                  </div>
                )}
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
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span>Property Details (Optional)</span>
                {detailsOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                )}
              </button>
              {detailsOpen && (
                <div className="px-3 py-2.5 flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Year Built
                    </label>
                    <input
                      type="number"
                      min="1800"
                      max={new Date().getFullYear()}
                      value={yearBuilt}
                      onChange={(e) => setYearBuilt(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="1995"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Sq Ft
                    </label>
                    <input
                      type="number"
                      min="100"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="1800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Accuracy note */}
            <p className="text-xs text-gray-400">
              Full address or APN gives parcel-level accuracy. City/ZIP returns area estimates.
            </p>
          </div>
        </div>

        {/* Right — Map */}
        <div className="flex-1 relative bg-[#e8ecf0] overflow-hidden">
          <div className="absolute inset-0">
            <SearchMapClient query={null} />
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
