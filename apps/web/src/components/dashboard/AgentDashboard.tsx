'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Search,
  Shield,
  AlertTriangle,
  Users,
  Wrench,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Home,
  Calendar,
  FileText,
  SlidersHorizontal,
  X,
  User as UserIcon,
} from 'lucide-react'
import { getSavedProperties, getClients } from '@/lib/api'
import { formatCurrency, formatAddress } from '@coverguard/shared'
import type { Property, Client } from '@coverguard/shared'
import { SearchBar } from '@/components/search/SearchBar'
import { useCompare } from '@/lib/useCompare'
import { PropertyRiskReportModal } from '@/components/property/PropertyReportModal'
import { ClientsPanel } from '@/components/dashboard/ClientsPanel'
import { AgentDashboardHero } from '@/components/dashboard/AgentDashboardHero'
import { isDemoMode } from '@/lib/mockData'
import { cn } from '@/lib/utils'

interface SavedPropertyRow {
  id: string
  propertyId: string
  notes: string | null
  tags: string[]
  savedAt: string
  clientId: string | null
  property: Property
  client?: { id: string; firstName: string; lastName: string; email: string; status: string } | null
}

const ITEMS_PER_PAGE = 12

type DashboardTab = 'properties' | 'clients'

// ââ Main component âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export function AgentDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('properties')
  const [properties, setProperties] = useState<SavedPropertyRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // View and pagination state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterType, setFilterType] = useState('')

  // Report modal
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)

  useEffect(() => {
    Promise.all([
      getSavedProperties().then((data) => data as SavedPropertyRow[]),
      getClients().catch(() => [] as Client[]),
    ])
      .then(([saved, clientList]) => {
        setProperties(saved)
        setClients(clientList)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // Unique states and property types for filter dropdowns
  const uniqueStates = useMemo(() => {
    const states = new Set(properties.map((p) => p.property?.state).filter(Boolean))
    return Array.from(states).sort()
  }, [properties])

  const uniqueTypes = useMemo(() => {
    const types = new Set(properties.map((p) => p.property?.propertyType).filter(Boolean))
    return Array.from(types).sort()
  }, [properties])

  // Filter logic
  const filtered = useMemo(() => {
    return properties.filter((sp) => {
      const p = sp.property
      if (!p) return false

      if (filterSearch) {
        const q = filterSearch.toLowerCase()
        const searchable = `${p.address} ${p.city} ${p.state} ${p.zip}`.toLowerCase()
        if (!searchable.includes(q)) return false
      }
      if (filterState && p.state !== filterState) return false
      if (filterType && p.propertyType !== filterType) return false
      if (filterClient) {
        if (filterClient === '_unassigned') {
          if (sp.clientId) return false
        } else if (sp.clientId !== filterClient) return false
      }
      return true
    })
  }, [properties, filterSearch, filterState, filterClient, filterType])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  // Reset page when filters change
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronising derived state on filter change
  useEffect(() => { setPage(1) }, [filterSearch, filterState, filterClient, filterType])

  const activeFilterCount = [filterSearch, filterState, filterClient, filterType].filter(Boolean).length

  function clearFilters() {
    setFilterSearch('')
    setFilterState('')
    setFilterClient('')
    setFilterType('')
  }

  return (
    <div className="p-3 lg:p-4 max-w-7xl mx-auto">
      {/* UX rework: large legible hero with greeting, search, and KPI cards */}
      <AgentDashboardHero
        savedPropertyCount={properties.length}
        clientCount={clients.length}
        loading={loading}
        demoMode={typeof window !== 'undefined' && isDemoMode()}
        searchSlot={<SearchBar className="max-w-full" />}
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/toolkit"
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Wrench className="h-4 w-4" />
          Toolkit
        </Link>
      </div>

      {/* Dashboard Tabs */}
      <div className="flex items-center gap-1 mb-5 border-b border-gray-200 pb-0">
        <button
          onClick={() => setActiveTab('properties')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 rounded-t-md text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'properties'
              ? 'border-teal-600 text-teal-700 bg-teal-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <Shield className="h-4 w-4" />
          Properties
        </button>
        <button
          onClick={() => setActiveTab('clients')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 rounded-t-md text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'clients'
              ? 'border-teal-600 text-teal-700 bg-teal-50/60'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          <Users className="h-4 w-4" />
          Clients
        </button>
      </div>

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <ClientsPanel />
      )}

      {/* Properties Tab */}
      {activeTab !== 'properties' ? null : (<>

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

      {/* Toolbar: filter toggle, view mode, count */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Saved Properties</h2>
          <span className="text-sm text-gray-400">{filtered.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors',
              showFilters || activeFilterCount > 0
                ? 'border-teal-300 bg-teal-50 text-teal-700'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('p-1.5 transition-colors', viewMode === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn('p-1.5 transition-colors', viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters row */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
          <div className="flex-1 min-w-[180px]">
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search address, city, ZIPâ¦"
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400"
            />
          </div>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">All States</option>
            {uniqueStates.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">All Types</option>
            {uniqueTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">All Clients</option>
            <option value="_unassigned">Unassigned</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' : 'space-y-3'}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn('rounded-xl bg-gray-100 animate-pulse', viewMode === 'grid' ? 'h-56' : 'h-20')} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Shield className="h-14 w-14 text-gray-200 mb-4" />
          <p className="text-base font-semibold text-gray-500">
            {activeFilterCount > 0 ? 'No properties match your filters' : 'No saved properties yet'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {activeFilterCount > 0 ? 'Try adjusting your filters or search criteria.' : 'Search for a property and save it to track it here.'}
          </p>
          {activeFilterCount > 0 ? (
            <button onClick={clearFilters} className="mt-4 text-sm font-medium text-teal-600 hover:underline">Clear filters</button>
          ) : (
            <Link href="/search" className="mt-5 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              <Search className="h-4 w-4" /> Search Properties
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginated.map((sp) => (
            <DashboardCard key={sp.id} saved={sp} onViewReport={() => setSelectedProperty(sp.property)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((sp) => (
            <DashboardListRow key={sp.id} saved={sp} onViewReport={() => setSelectedProperty(sp.property)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} â showing {(page - 1) * ITEMS_PER_PAGE + 1}â{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (page <= 3) {
                pageNum = i + 1
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'h-9 w-9 rounded-lg text-sm font-medium transition-colors',
                    page === pageNum ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      </>)}

      {/* Report modal */}
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

// ââ Grid Card âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

function getStreetViewUrl(p: Property, width = 400, height = 180) {
  const location = p.lat && p.lng
    ? `${p.lat},${p.lng}`
    : `${p.address ?? ''}, ${p.city ?? ''}, ${p.state ?? ''} ${p.zip ?? ''}`
  return `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${encodeURIComponent(location)}&key=${GOOGLE_MAPS_KEY}&source=outdoor`
}

function DashboardCard({ saved, onViewReport }: { saved: SavedPropertyRow; onViewReport: () => void }) {
  const { ids, toggle, canAdd } = useCompare()
  const p = saved.property
  const isCompared = ids.includes(p.id)
  const [imgErr, setImgErr] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all flex flex-col">
      {/* Street View Image */}
      {GOOGLE_MAPS_KEY && !imgErr && (
        <Link href={`/properties/${saved.propertyId}`} className="block">
          <div className="relative h-32 w-full bg-gray-100 overflow-hidden">
            <Image
              src={getStreetViewUrl(p)}
              alt={`Street view of ${p.address ?? 'property'}`}
              className="object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 350px"
              onError={() => setImgErr(true)}
            />
          </div>
        </Link>
      )}
      <Link href={`/properties/${saved.propertyId}`} className="block p-3 flex-1">
        <h3 className="font-semibold text-gray-900 text-sm truncate">{p.address}</h3>
        <p className="text-xs text-gray-500 truncate">{formatAddress(p)}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
          {p.propertyType && (
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3 text-gray-400" />
              {p.propertyType.replace(/_/g, ' ')}
            </span>
          )}
          {p.yearBuilt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-gray-400" />
              {p.yearBuilt}
            </span>
          )}
          {p.bedrooms && (
            <span>{p.bedrooms}bd / {p.bathrooms}ba</span>
          )}
        </div>

        {p.marketValue && (
          <div className="mt-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Est. market value</div>
            <div className="text-lg font-bold text-gray-900">{formatCurrency(p.marketValue)}</div>
          </div>
        )}
        {p.estimatedValue && (
          <div className={p.marketValue ? 'mt-1' : 'mt-3'}>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Assessed value</div>
            <div className={`font-bold text-gray-900 ${p.marketValue ? 'text-sm' : 'text-base'}`}>{formatCurrency(p.estimatedValue)}</div>
          </div>
        )}

        {/* Client badge */}
        {saved.client && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-purple-600">
            <UserIcon className="h-3 w-3" />
            <span className="truncate">{saved.client.firstName} {saved.client.lastName}</span>
          </div>
        )}

        {/* Tags */}
        {saved.tags && saved.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {saved.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="bg-blue-50 text-blue-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </Link>

      {/* Actions footer */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
        <button
          onClick={onViewReport}
          className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Report
        </button>
        <button
          onClick={() => toggle(p.id)}
          disabled={!isCompared && !canAdd}
          className={cn(
            'flex items-center gap-1 text-xs transition-colors',
            isCompared ? 'text-teal-600 font-medium' : canAdd ? 'text-gray-500 hover:text-teal-600' : 'text-gray-300 cursor-not-allowed'
          )}
        >
          <GitCompare className="h-3.5 w-3.5" />
          {isCompared ? 'Compared' : 'Compare'}
        </button>
      </div>
    </div>
  )
}

// ââ List Row âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function DashboardListRow({ saved, onViewReport }: { saved: SavedPropertyRow; onViewReport: () => void }) {
  const { ids, toggle, canAdd } = useCompare()
  const p = saved.property
  const isCompared = ids.includes(p.id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-sm hover:border-gray-300 transition-all px-5 py-3 flex items-center gap-4">
      <Link href={`/properties/${saved.propertyId}`} className="flex-1 min-w-0 flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Shield className="h-5 w-5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.address}</p>
          <p className="text-xs text-gray-400 truncate">{formatAddress(p)}</p>
        </div>
      </Link>

      {/* Client */}
      {saved.client && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-purple-600 shrink-0">
          <UserIcon className="h-3 w-3" />
          <span>{saved.client.firstName} {saved.client.lastName}</span>
        </div>
      )}

      {/* Value */}
      {p.estimatedValue && (
        <div className="hidden sm:block text-right shrink-0">
          <div className="text-sm font-semibold text-gray-900">{formatCurrency(p.estimatedValue)}</div>
          <div className="text-[10px] text-gray-400">est. value</div>
        </div>
      )}

      {/* Date */}
      {saved.savedAt && (
        <span className="text-[10px] text-gray-400 shrink-0 hidden lg:block">
          {new Date(saved.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onViewReport}
          className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
        >
          <FileText className="h-3 w-3" /> Report
        </button>
        <button
          onClick={() => toggle(p.id)}
          disabled={!isCompared && !canAdd}
          className={cn(
            'flex items-center gap-1 text-xs border px-3 py-1.5 rounded-lg transition-colors',
            isCompared
              ? 'border-teal-300 bg-teal-50 text-teal-600 font-medium'
              : canAdd
                ? 'border-gray-200 text-gray-500 hover:text-teal-600 hover:border-teal-200'
                : 'border-gray-100 text-gray-300 cursor-not-allowed'
          )}
        >
          <GitCompare className="h-3 w-3" />
          {isCompared ? 'Compared' : 'Compare'}
        </button>
      </div>
    </div>
  )
}

