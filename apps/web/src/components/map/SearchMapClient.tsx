'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { PropertyMap } from './PropertyMap'
import type { Property, PropertyRiskProfile } from '@coverguard/shared'
import { getPropertyRisk } from '@/lib/api'

interface SearchMapClientProps {
  query: string | null
  /** Pre-fetched properties from the server — avoids a duplicate client-side fetch (and CORS). */
  initialProperties?: Property[]
}

export function SearchMapClient({ query, initialProperties }: SearchMapClientProps) {
  const properties = initialProperties ?? []
  const firstProperty = properties[0] ?? null

  const [selected, setSelected] = useState<Property | null>(firstProperty)
  const [riskProfile, setRiskProfile] = useState<PropertyRiskProfile | null>(null)

  // Reset selection when the property list identity changes (new search).
  // Use a ref to detect prop changes without an effect.
  const prevFirstIdRef = useRef(firstProperty?.id)
  if (firstProperty?.id !== prevFirstIdRef.current) {
    prevFirstIdRef.current = firstProperty?.id
    setSelected(firstProperty)
    setRiskProfile(null)
  }

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
        // Risk data unavailable for this property — map still functions without it
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
