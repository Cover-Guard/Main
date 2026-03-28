'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Property, PropertyPriority } from '@coverguard/shared'
import { getSavedProperties, saveProperty } from '@/lib/api'
import { PropertyCard } from '@/components/search/PropertyCard'
import { Building2, AlertTriangle, Star, ArrowRight, Flag } from 'lucide-react'

interface SavedRow {
  id: string
  propertyId: string
  property: Property
  rating: number | null
  priority: PropertyPriority | null
  notes: string | null
  tags: string[]
}

interface SavedPropertiesPanelProps {
  limit?: number
  compact?: boolean
}

const PRIORITY_CONFIG: Record<PropertyPriority, { label: string; color: string; bgColor: string }> = {
  LOW: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-100' },
  MEDIUM: { label: 'Med', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  HIGH: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  URGENT: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-50' },
}

export function SavedPropertiesPanel({ limit, compact }: SavedPropertiesPanelProps) {
  const [saved, setSaved] = useState<SavedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSavedProperties()
      .then((data) => setSaved(data as SavedRow[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load saved properties'))
      .finally(() => setLoading(false))
  }, [])

  async function handleRating(row: SavedRow, newRating: number) {
    const rating = row.rating === newRating ? null : newRating
    setSaved((prev) =>
      prev.map((s) => (s.id === row.id ? { ...s, rating } : s)),
    )
    try {
      await saveProperty(row.propertyId, undefined, undefined, undefined, rating)
    } catch {
      // Revert on failure
      setSaved((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, rating: row.rating } : s)),
      )
    }
  }

  async function handlePriority(row: SavedRow, newPriority: PropertyPriority) {
    const priority = row.priority === newPriority ? null : newPriority
    setSaved((prev) =>
      prev.map((s) => (s.id === row.id ? { ...s, priority } : s)),
    )
    try {
      await saveProperty(row.propertyId, undefined, undefined, undefined, undefined, priority)
    } catch {
      setSaved((prev) =>
        prev.map((s) => (s.id === row.id ? { ...s, priority: row.priority } : s)),
      )
    }
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
      <div className="card p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-red-400" />
        <p className="font-medium text-red-600">Could not load saved properties</p>
        <p className="mt-1 text-sm text-gray-400">{error}</p>
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

      {displayed.map((row) => (
        <div key={row.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <PropertyCard property={row.property} />

          {/* Rating & Priority controls */}
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 flex-wrap">
            {/* Star rating */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide mr-1">Rating</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(row, star)}
                  className="p-0.5 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-4 w-4 ${
                      row.rating && star <= row.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Priority selector */}
            <div className="flex items-center gap-1">
              <Flag className="h-3 w-3 text-gray-400 mr-0.5" />
              {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as PropertyPriority[]).map((p) => {
                const config = PRIORITY_CONFIG[p]
                const isActive = row.priority === p
                return (
                  <button
                    key={p}
                    onClick={() => handlePriority(row, p)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                      isActive
                        ? `${config.bgColor} ${config.color} border-current`
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {config.label}
                  </button>
                )
              })}
            </div>

            <Link
              href={`/properties/${row.propertyId}`}
              className="ml-auto flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-blue-600"
            >
              Details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
