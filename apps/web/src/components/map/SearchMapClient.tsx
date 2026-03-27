'use client'

import { useState, useEffect, useCallback } from 'react'
import { PropertyMap } from './PropertyMap'
import type { Property, PropertyRiskProfile } from '@coverguard/shared'
import { searchProperties, getPropertyRisk } from '@/lib/api'

interface SearchMapClientProps {
  query: string | null
}

export function SearchMapClient({ query }: SearchMapClientProps) {
  const [properties, setProperties] = useState<Property[]>([])
  const [selected, setSelected] = useState<Property | null>(null)
  const [riskProfile, setRiskProfile] = useState<PropertyRiskProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch properties when query changes
  useEffect(() => {
    if (!query) return

    const params: Record<string, string> = {}
    const zipMatch = query.match(/\b(\d{5})\b/)
    if (zipMatch) {
      params.zip = zipMatch[1]!
      params.address = query
    } else {
      params.address = query
    }

    searchProperties({ ...params, limit: 50 })
      .then((r) => {
        setError(null)
        setProperties(r.properties)
        if (r.properties.length > 0) {
          setSelected(r.properties[0]!)
        } else {
          setSelected(null)
        }
      })
      .catch(() => {
        setProperties([])
        setSelected(null)
        setError('Unable to load properties on the map. Please try again.')
      })
  }, [query])

  // Fetch risk profile when selected property changes
  const selectedId = selected?.id ?? null
  useEffect(() => {
    if (!selectedId) return

    let cancelled = false

    getPropertyRisk(selectedId)
      .then((profile) => {
        if (!cancelled) setRiskProfile(profile)
      })
      .catch(() => {
        if (!cancelled) setRiskProfile(null)
      })

    return () => { cancelled = true }
  }, [selectedId])

  const handleSelectProperty = useCallback((property: Property) => {
    setSelected(property)
    setRiskProfile(null) // Clear stale risk data immediately
  }, [])

  const visibleProperties = query ? properties : []
  const visibleSelected = query ? selected : null

  return (
    <div className="relative h-full w-full">
      {error && (
        <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 shadow-sm">
          {error}
        </div>
      )}
      <PropertyMap
        properties={visibleProperties}
        selectedProperty={visibleSelected}
        riskProfile={riskProfile}
        onSelectProperty={handleSelectProperty}
        className="h-full w-full"
        zoom={visibleProperties.length === 1 ? 15 : 12}
      />
    </div>
  )
}
