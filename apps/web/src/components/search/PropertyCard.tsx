'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Home, Calendar, GitCompare, Bookmark, BookmarkCheck, BedDouble, Bath } from 'lucide-react'
import type { Property } from '@coverguard/shared'
import { formatCurrency, formatAddress, formatSquareFeet } from '@coverguard/shared'
import { useCompare } from '@/lib/useCompare'
import { saveProperty, unsaveProperty } from '@/lib/api'

interface PropertyCardProps {
  property: Property
  isSaved?: boolean
}

export function PropertyCard({ property, isSaved: initialSaved = false }: PropertyCardProps) {
  const { ids, toggle, canAdd } = useCompare()
  const isCompared = ids.includes(property.id)
  const [saved, setSaved]     = useState(initialSaved)
  const [saving, setSaving]   = useState(false)

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    const next = !saved
    setSaved(next)
    try {
      if (next) await saveProperty(property.id)
      else      await unsaveProperty(property.id)
    } catch {
      setSaved(!next) // revert
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = property.propertyType?.replace(/_/g, ' ') ?? null

  return (
    <div className="card card-hover overflow-hidden">
      <Link href={`/properties/${property.id}`} className="block p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {typeLabel && (
              <span className="mb-1.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                {typeLabel}
              </span>
            )}
            <h3 className="truncate font-semibold text-gray-900">{property.address}</h3>
            <p className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3 w-3 shrink-0" />
              {formatAddress(property)}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {property.estimatedValue ? (
              <>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Est. value</p>
                <p className="text-lg font-bold text-brand-700">
                  {formatCurrency(property.estimatedValue)}
                </p>
              </>
            ) : null}
            {property.lastSalePrice && (
              <p className="mt-0.5 text-xs text-gray-400">
                Last sale {formatCurrency(property.lastSalePrice)}
              </p>
            )}
          </div>
        </div>

        {/* Property attributes */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {property.squareFeet && (
            <span className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5 text-gray-400" />
              {formatSquareFeet(property.squareFeet)}
            </span>
          )}
          {property.yearBuilt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              {property.yearBuilt}
            </span>
          )}
          {property.bedrooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5 text-gray-400" />
              {property.bedrooms} bd
            </span>
          )}
          {property.bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5 text-gray-400" />
              {property.bathrooms} ba
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {property.parcelId ? `Parcel: ${property.parcelId}` : '\u00A0'}
          </span>
          <span className="text-xs font-semibold text-brand-600 hover:underline">
            View full report →
          </span>
        </div>
      </Link>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2">
        <button
          onClick={() => toggle(property.id)}
          disabled={!isCompared && !canAdd}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
            isCompared
              ? 'text-brand-600'
              : canAdd
              ? 'text-gray-500 hover:text-brand-600'
              : 'cursor-not-allowed text-gray-300'
          }`}
        >
          <GitCompare className="h-3.5 w-3.5" />
          {isCompared ? 'Added to compare' : canAdd ? 'Add to compare' : 'Compare full (3/3)'}
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          title={saved ? 'Remove from saved' : 'Save property'}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            saved
              ? 'text-amber-600 hover:bg-amber-50'
              : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          {saved ? (
            <BookmarkCheck className="h-3.5 w-3.5" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
