import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { MobileSearchToggle } from '@/components/mobile/MobileSearchToggle'
import { searchProperties } from '@/lib/api'
import type { Property, PropertySearchParams } from '@coverguard/shared'

export const metadata: Metadata = { title: 'Search Properties' }

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string; placeId?: string }>
}

/** Parse a free-text query into search params (shared logic). */
function parseSearchQuery(query: string) {
  // Try to extract: "123 Main St, Austin, TX 78701" → address, city, state, zip
  const fullMatch = query.match(
    /^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5})$/,
  )
  if (fullMatch) {
    return {
      address: fullMatch[1]!.trim(),
      city: fullMatch[2]!.trim(),
      state: fullMatch[3]!.toUpperCase(),
      zip: fullMatch[4],
    }
  }

  // "Austin, TX 78701" or "Austin, TX"
  const cityStateZip = query.match(/^([^,]+),\s*([A-Za-z]{2})\s*(\d{5})?$/)
  if (cityStateZip) {
    return {
      city: cityStateZip[1]!.trim(),
      state: cityStateZip[2]!.toUpperCase(),
      zip: cityStateZip[3],
    }
  }

  // Extract ZIP if present anywhere
  const zipMatch = query.match(/\b(\d{5})\b/)
  if (zipMatch) {
    const address = query.replace(zipMatch[0], '').replace(/,\s*$/, '').trim()
    return { zip: zipMatch[1], ...(address ? { address } : {}) }
  }

  // "City, ST" pattern with lowercase
  const stateMatch = query.match(/,\s*([A-Za-z]{2})\s*$/)
  if (stateMatch) {
    return {
      address: query.slice(0, stateMatch.index).trim(),
      state: stateMatch[1]!.toUpperCase(),
    }
  }

  return { address: query }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page, placeId } = await searchParams

  // Fetch once on the server — share results with both the list and the map.
  let properties: Property[] = []
  let searchError = false
  if (q) {
    try {
      const parsed = parseSearchQuery(q)
      const params: PropertySearchParams = { ...parsed, page: parseInt(page ?? '1', 10), limit: 50 }
      // When a Google Place ID is provided, pass it through for server-side geocoding.
      // If the query already parsed into city+state+zip, send those too so the API
      // can attempt a DB lookup while the geocode resolves (or skip it entirely).
      if (placeId) {
        params.placeId = placeId
      }
      const result = await searchProperties(params)
      properties = result.properties
    } catch {
      searchError = true
    }
  }

  const resultsList = q ? (
    searchError ? (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p>Unable to search properties. Please try again.</p>
        <Link
          href="/properties/sample"
          className="mt-3 inline-block rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          View a sample property report
        </Link>
      </div>
    ) : (
      <SearchResults properties={properties} query={q} />
    )
  ) : (
    <div className="flex h-48 items-center justify-center">
      <div className="text-center text-gray-400">
        <p className="text-base font-medium">Search any US property</p>
        <p className="mt-1 text-sm">Enter an address, ZIP code, or APN / Parcel ID</p>
      </div>
    </div>
  )

  const mapPanel = (
    <Suspense fallback={<MapSkeleton />}>
      <SearchMapPanel query={q ?? null} properties={properties} />
    </Suspense>
  )

  return (
    <SidebarLayout>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Search bar */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="mx-auto max-w-full">
            <SearchBar defaultValue={q ?? ''} />
          </div>
        </div>

        {/* ── Mobile: toggleable list / map ─────────────────────────── */}
        <MobileSearchToggle listContent={resultsList} mapContent={mapPanel} />

        {/* ── Desktop: side-by-side list + map ─────────────────────── */}
        <div className="hidden flex-1 overflow-hidden md:flex">
          {/* Left: results list */}
          <div className="w-[420px] shrink-0 overflow-y-auto px-4 py-3 lg:w-[480px]">
            {resultsList}
          </div>

          {/* Right: map */}
          <div className="flex-1">{mapPanel}</div>
        </div>
      </div>
    </SidebarLayout>
  )
}

async function SearchMapPanel({ query, properties }: { query: string | null; properties: Property[] }) {
  const { SearchMapClient } = await import('@/components/map/SearchMapClient')
  return <SearchMapClient query={query} initialProperties={properties} />
}

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse bg-gray-200" />
}
