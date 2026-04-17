'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Property, SavedPropertyWithProperty } from '@coverguard/shared'
import { getSavedProperties } from '@/lib/api'
import { PropertyCard } from '@/components/search/PropertyCard'
import { PropertyRiskReportModal } from '@/components/property/PropertyReportModal'
import { Building2, AlertTriangle, RefreshCw } from 'lucide-react'

interface SavedPropertiesPanelProps {
  limit?: number
  compact?: boolean
}

export function SavedPropertiesPanel({ limit, compact }: SavedPropertiesPanelProps) {
  const [saved, setSaved] = useState<SavedPropertyWithProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)

  const fetchSaved = useCallback(() => {
    return getSavedProperties()
      .then((data) => {
        setSaved(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load saved properties'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchSaved()
  }, [fetchSaved])

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    fetchSaved()
  }

  const displayed = limit ? saved.slice(0, limit) : saved

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-3 text-center" role="alert" aria-live="polite">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-red-400" />
        <p className="font-medium text-red-600">Could not load saved properties</p>
        <p className="mt-1 text-sm text-gray-400">Service temporarily unavailable. Please try again.</p>
        <button
          onClick={handleRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    )
  }

  if (saved.length === 0) {
    return (
      <div className="card p-10 text-center text-gray-400">
        <Building2 className="mx-auto mb-3 h-10 w-10 opacity-30" />
        <p className="font-medium">No saved properties yet</p>
        <p className="mt-1 text-sm">Search for a property and save it to track it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Saved Properties</h2>
          <p className="text-sm text-gray-500">{saved.length} saved</p>
        </div>
      )}
      {compact && <h3 className="font-semibold text-gray-800">Recent Saved Properties</h3>}
      {displayed.map(({ property }) => (
        <PropertyCard key={property.id} property={property} onViewReport={() => setSelectedProperty(property)} />
      ))}

      {selectedProperty && (
        <PropertyRiskReportModal
          property={selectedProperty}
          open
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  )
}
