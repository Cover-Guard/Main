'use client'

import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps'
import { Search, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PlacePrediction } from '@coverguard/shared'

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

interface SearchBarProps {
  defaultValue?: string
  autoFocus?: boolean
  className?: string
}

export function SearchBar(props: SearchBarProps) {
  if (!GOOGLE_MAPS_KEY) {
    return <SearchBarFallback {...props} />
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} libraries={['places']}>
      <SearchBarInner {...props} />
    </APIProvider>
  )
}

function SearchBarInner({ defaultValue = '', autoFocus, className }: SearchBarProps) {
  const router = useRouter()
  const placesLib = useMapsLibrary('places')

  const [query, setQuery] = useState(defaultValue)
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  // Initialize the AutocompleteService once the Places library loads
  useEffect(() => {
    if (!placesLib) return
    serviceRef.current = new placesLib.AutocompleteService()
    sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
  }, [placesLib])

  const fetchPredictions = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      const trimmed = value.trim()
      if (trimmed.length < 3 || !serviceRef.current) {
        setPredictions([])
        setShowDropdown(false)
        return
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true)
        serviceRef.current!.getPlacePredictions(
          {
            input: trimmed,
            componentRestrictions: { country: 'us' },
            types: ['address'],
            sessionToken: sessionTokenRef.current ?? undefined,
          },
          (results, status) => {
            setLoading(false)
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              results &&
              results.length > 0
            ) {
              const mapped: PlacePrediction[] = results.slice(0, 6).map((p) => ({
                placeId: p.place_id,
                description: p.description,
                mainText: p.structured_formatting.main_text,
                secondaryText: p.structured_formatting.secondary_text,
              }))
              setPredictions(mapped)
              setShowDropdown(true)
              setActiveIndex(-1)
            } else {
              setPredictions([])
              setShowDropdown(false)
            }
          },
        )
      }, 250)
    },
    [],
  )

  function handleChange(value: string) {
    setQuery(value)
    fetchPredictions(value)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().slice(0, 500)
    if (!q) return
    setShowDropdown(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  function selectPrediction(prediction: PlacePrediction) {
    setQuery(prediction.description)
    setShowDropdown(false)
    // Reset session token after selection (per Google billing best practices)
    if (placesLib) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken()
    }
    // Navigate with both the display text and the placeId for server-side validation
    const params = new URLSearchParams({
      q: prediction.description,
      placeId: prediction.placeId,
    })
    router.push(`/search?${params.toString()}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || predictions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1))
        break
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < predictions.length) {
          e.preventDefault()
          selectPrediction(predictions[activeIndex]!)
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setActiveIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <form onSubmit={handleSubmit} className={cn('flex gap-2', className)}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setShowDropdown(true)
          }}
          placeholder="Search by address — e.g. 123 Main St, Austin, TX 78701"
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          className="input pl-10 py-3 text-base text-gray-900"
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          </div>
        )}

        {/* Google Places predictions dropdown */}
        {showDropdown && predictions.length > 0 && (
          <div
            ref={dropdownRef}
            id="search-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {predictions.map((prediction, index) => (
              <button
                key={prediction.placeId}
                id={`suggestion-${index}`}
                role="option"
                type="button"
                aria-selected={index === activeIndex}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors',
                  index === activeIndex
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-gray-700 hover:bg-gray-50',
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectPrediction(prediction)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{prediction.mainText}</p>
                  <p className="truncate text-xs text-gray-500">{prediction.secondaryText}</p>
                </div>
              </button>
            ))}
            {/* Google attribution (required by ToS) */}
            <div className="border-t border-gray-100 px-4 py-2 text-right">
              <span className="text-[10px] text-gray-400">Powered by Google</span>
            </div>
          </div>
        )}
      </div>
      <button type="submit" className="btn-primary px-6 py-3 text-base">
        Search
      </button>
    </form>
  )
}

/**
 * Fallback search bar when Google Maps API key is not configured.
 * Uses the original manual text search behavior.
 */
function SearchBarFallback({ defaultValue = '', autoFocus, className }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().slice(0, 500)
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex gap-2', className)}>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by address, city, or ZIP — e.g. 123 Main St, Austin, TX 78701"
          autoFocus={autoFocus}
          autoComplete="off"
          className="input pl-10 py-3 text-base text-gray-900"
        />
      </div>
      <button type="submit" className="btn-primary px-6 py-3 text-base">
        Search
      </button>
    </form>
  )
}
