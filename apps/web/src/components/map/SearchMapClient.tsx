'use client'

import { useState, useEffect, useCallback } from 'react'
import { PropertyMap } from './PropertyMap'
import type { Property, PropertyRiskProfile } from '@coverguard/shared'
import { getPropertyRisk } from '@/lib/api'

interface SearchMapClientProps {
  query: string | null
  /** Pre-fetched properties from the server — avoids a duplicate client-side fetch (and CORS). */
  initialProperties?: Property[]
}

export function SearchMapClient({ query, initialProperties }: SearchMapClientProps) {
  const [properties, setProperties] = useState<Property[]>(initialProperties ?? [])
  const [selected, setSelected] = useState<Property | null>(
    initialProperties?.[0] ?? null,
  )
  const [riskProfile, setRiskProfile] = useState<PropertyRiskProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Sync when initialProperties change (e.g. new server navigation)
  useEffect(() => {
    if (initialProperties) {
      setProperties(initialProperties)
      setSelected(initialProperties[0] ?? null)
      setRiskProfile(null)
    }
  }, [initialProperties])

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
