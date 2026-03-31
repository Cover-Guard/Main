'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Property } from '@coverguard/shared'
import { getSavedProperties } from '@/lib/api'
import { formatCurrency, formatAddress } from '@coverguard/shared'
import { PropertyReportModal } from '@/components/property/PropertyReportModal'
import {
  FileText,
  Search,
  MapPin,
  Calendar,
  DollarSign,
  ArrowRight,
  Shield,
  Clock,
  AlertTriangle,
} from 'lucide-react'

interface SavedPropertyRow {
  id: string
  propertyId: string
  notes?: string
  tags?: string[]
  savedAt?: string
  property: Property
}

export function ReportsContent() {
  const [saved, setSaved] = useState<SavedPropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)

  const loadReports = () => {
    setLoadError(null)
    setLoading(true)
    getSavedProperties()
      .then((data) => setSaved(data as SavedPropertyRow[]))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getSavedProperties()
      .then((data) => setSaved(data as SavedPropertyRow[]))
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load reports'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = saved.filter((row) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const p = row.property
    return (
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.city ?? '').toLowerCase().includes(q) ||
      (p.state ?? '').toLowerCase().includes(q) ||
      (p.zip ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-6 w-6 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Property Reports</h1>
          </div>
          <p className="text-sm text-gray-500">
            All properties you&apos;ve saved — access full risk, insurability, and carrier reports.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Search className="h-4 w-4" />
          Search a Property
        </Link>
      </div>

      {/* Search bar */}
      <div className="mb-5">
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-emerald-400">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by address, city, or state…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-gray-400 mb-4">
          {filtered.length} of {saved.length} report{saved.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Content */}
      {loadError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-red-300 mb-3" />
          <p className="font-semibold text-red-600">Failed to load reports</p>
          <p className="text-sm text-gray-400 mt-1">{loadError}</p>
          <button
            onClick={loadReports}
            className="mt-4 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : saved.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="h-14 w-14 text-gray-200 mb-4" />
          <p className="text-base font-semibold text-gray-500">No saved reports yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Run a property check and save properties to generate reports.
          </p>
          <Link
            href="/"
            className="mt-5 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
            Check a Property
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-400">No properties match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const p = row.property
            return (
              <div
                key={row.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{p.address}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">{formatAddress(p)}</p>

                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                        {p.propertyType && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {p.propertyType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {p.yearBuilt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            Built {p.yearBuilt}
                          </span>
                        )}
                        {p.estimatedValue && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                            Est. {formatCurrency(p.estimatedValue)}
                          </span>
                        )}
                        {row.savedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-gray-400" />
                            Saved {new Date(row.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {row.tags && row.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {row.tags.map((tag) => (
                            <span
                              key={tag}
                              className="bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {row.notes && (
                        <p className="text-xs text-gray-400 italic mt-2 truncate">{row.notes}</p>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedProperty(p)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                    >
                      View Report
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Property Report Modal */}
      {selectedProperty && (
        <PropertyReportModal
          property={selectedProperty}
          open={!!selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  )
}
