'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  GitCompare,
  Wrench,
  Shield,
  AlertTriangle,
  ArrowRight,
  Users,
  BarChart3,
} from 'lucide-react'
import { getSavedProperties } from '@/lib/api'
import type { Property } from '@coverguard/shared'

interface SavedPropertyRow {
  id: string
  propertyId: string
  notes: string | null
  tags: string[]
  savedAt: string
  property: Property
}

// ── Main component ─────────────────────────────────────────────────────────
export function AgentDashboard() {
  const [properties, setProperties] = useState<SavedPropertyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSavedProperties()
      .then((data) => setProperties(data as SavedPropertyRow[]))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="text-sm text-emerald-600 mt-0.5">
            Property insurability intelligence for real estate professionals
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/search"
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
            Search a Property
          </Link>
          <Link
            href="/dashboard?tab=compare"
            className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <GitCompare className="h-4 w-4" />
            Compare
          </Link>
          <Link
            href="/clients"
            className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Users className="h-4 w-4" />
            Clients
          </Link>
          <Link
            href="/toolkit"
            className="flex items-center gap-1.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Wrench className="h-4 w-4" />
            Toolkit
          </Link>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="flex-1 text-sm text-amber-800">{error}</p>
            <button onClick={() => setError(null)} className="text-amber-400 hover:text-amber-600 text-xs font-medium shrink-0">Dismiss</button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="SAVED PROPERTIES"
          value={loading ? '—' : properties.length}
          icon={<Shield className="h-5 w-5 text-blue-500" />}
        />
        <Link href="/analytics" className="block">
          <StatCard
            label="ANALYTICS"
            value="View"
            icon={<BarChart3 className="h-5 w-5 text-green-500" />}
          />
        </Link>
        <Link href="/clients" className="block">
          <StatCard
            label="CLIENTS"
            value="Manage"
            icon={<Users className="h-5 w-5 text-purple-400" />}
          />
        </Link>
        <Link href="/search" className="block">
          <StatCard
            label="SEARCH"
            value="Search"
            icon={<Search className="h-5 w-5 text-teal-500" />}
          />
        </Link>
      </div>

      {/* Recent properties */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">
            Recent Saved Properties
          </h3>
          <Link
            href="/search"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No saved properties yet.</p>
            <Link
              href="/search"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              <Search className="h-4 w-4" />
              Run your first check
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {properties.slice(0, 5).map((sp) => {
              const address = sp.property?.address ?? sp.propertyId
              const sub = [sp.property?.city, sp.property?.state].filter(Boolean).join(', ')
              return (
                <div key={sp.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <Shield className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{address}</p>
                    {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                  </div>
                  {sp.savedAt && (
                    <span className="text-[10px] text-gray-400 shrink-0 hidden sm:block">
                      {new Date(sp.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <Link
                    href={`/properties/${sp.propertyId}`}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 shrink-0"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="mt-0.5">{icon}</div>
      </div>
    </div>
  )
}
