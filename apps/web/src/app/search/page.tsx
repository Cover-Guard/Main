import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SidebarLayout } from '@/components/layout/SidebarLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { MobileSearchToggle } from '@/components/mobile/MobileSearchToggle'
import { searchProperties } from '@/lib/api'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import type { Property, PropertySearchParams } from '@coverguard/shared'

export const metadata: Metadata = { title: 'Search Properties' }

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string; placeId?: string }>
}

/** Parse a free-text query into search params (shared logic). */
function parseSearchQuery(query: string) {
  // Try to extract: "123 Main St, Austin, TX 78701" → address, city, state, zip
  const fullMatch = query.match(
    /^(.+?),s*([^,]+?),s*([A-Za-z]{2})s+(d{5})$/,
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
  const cityStateZip = query.match(/^([^,]+),s*([A-Za-z]{2})s*(d{5})?$/)
  if (cityStateZip) {
    return {
      city: cityStateZip[1]!.trim(),
      state: cityStateZip[2]!.toUpperCase(),
      zip: cityStateZip[3],
    }
  }
  // Extract ZIP if present anywhere
  const zipMatch = query.match(/(d{5})/)
  if (zipMatch) {
    const address = query.replace(zipMatch[0], '').replace(/,s*$/, '').trim()
    return { zip: zipMatch[1], ...(address ? { address } : {}) }
  }
  // "City, ST" pattern with lowercase
  const stateMatch = query.match(/,s*([A-Za-z]{2})s*$/)
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

      // Pull the user's session server-side and pass the access token to
      // searchProperties — api.ts is client-safe, so its apiFetch can't read
      // the session during SSR. Server callers must thread the token through.
      const supabase = await createSupabaseServerClient()
      const { data: { session } } = await supabase.auth.getSession()
      const result = await searchProperties(params, session?.access_token)

      properties = result.properties
    } catch (err) {
      // Log the underlying error with enough structure that a truncated
      // Vercel log line is still actionable. Includes the query, parsed
      // params, the error name, HTTP status (if it's an HTTP error), and
      // the full message.
      const httpStatus =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status: unknown }).status
          : undefined
      console.error('[search/page] property search failed', {
        query: q,
        placeId: placeId ?? null,
        page: page ?? '1',
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        httpStatus,
      })
      searchError = true
    }
  }

  const resultsList = q ? (
    searchError ? (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p>Unable to search properties. Please try again.</p>
        <Link
          href="/properties/demo-sample-property"
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
        {/* Unified page header — same shell as Dashboard / Toolkit / Help.
            The wide SearchBar lives in `belowSlot` so it stays prominent
            without breaking the standard title/icon row. */}
        <PageHeader
          icon={Search}
          title="Search"
          subtitle="Find any U.S. property by address, ZIP, or APN"
          belowSlot={<SearchBar defaultValue={q ?? ''} />}
        />

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
