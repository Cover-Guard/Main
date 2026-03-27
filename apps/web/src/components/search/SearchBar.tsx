'use client'

import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { suggestProperties, type PropertySuggestion } from '@/lib/api'

interface SearchBarProps {
  defaultValue?: string
  autoFocus?: boolean
  className?: string
}

export function SearchBar({ defaultValue = '', autoFocus, className }: SearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(defaultValue)
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = value.trim()
    if (trimmed.length < 2 || trimmed.length > 500) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await suggestProperties(trimmed, 6)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
        setActiveIndex(-1)
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    fetchSuggestions(value)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim().slice(0, 500)
    if (!q) return
    setShowSuggestions(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  function selectSuggestion(suggestion: PropertySuggestion) {
    const fullAddress = `${suggestion.address}, ${suggestion.city}, ${suggestion.state} ${suggestion.zip}`
    setQuery(fullAddress)
    setShowSuggestions(false)
    router.push(`/search?q=${encodeURIComponent(fullAddress)}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
        break
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault()
          selectSuggestion(suggestions[activeIndex]!)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
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
        setShowSuggestions(false)
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
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          placeholder="Search by address, city, or ZIP — e.g. 123 Main St, Austin, TX 78701"
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls="search-suggestions"
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
          className="input pl-10 py-3 text-base text-gray-900"
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          </div>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            id="search-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
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
                onClick={() => selectSuggestion(suggestion)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{suggestion.address}</p>
                  <p className="truncate text-xs text-gray-500">
                    {suggestion.city}, {suggestion.state} {suggestion.zip}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="submit" className="btn-primary px-6 py-3 text-base">
        Search
      </button>
    </form>
  )
}
