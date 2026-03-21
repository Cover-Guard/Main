import { Suspense } from 'react'
import type { Metadata } from 'next'
import { SearchBar } from '@/components/search/SearchBar'
import { SearchResults } from '@/components/search/SearchResults'
import { SidebarLayout } from '@/components/layout/SidebarLayout'

export const metadata: Metadata = { title: 'Search Properties' }

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = await searchParams

  return (
    <SidebarLayout>
      <div className="flex h-full flex-col overflow-hidden">
        {/* Search bar */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="mx-auto max-w-5xl">
            <SearchBar defaultValue={q ?? ''} />
          </div>
        </div>

        {/* Body: results list + map */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: results list */}
          <div className="w-full overflow-y-auto px-4 py-6 md:w-[420px] md:shrink-0 lg:w-[480px]">
            {q ? (
              <Suspense fallback={<SearchSkeleton />}>
                <SearchResults query={q} page={parseInt(page ?? '1', 10)} />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-gray-400">
                  <p className="text-lg font-medium">Search any US property</p>
                  <p className="mt-1 text-sm">Enter an address, ZIP code, or APN / Parcel ID</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: map */}
          <div className="hidden flex-1 md:block">
            <Suspense fallback={<MapSkeleton />}>
              <SearchMapPanel query={q ?? null} />
            </Suspense>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}

async function SearchMapPanel({ query }: { query: string | null }) {
  const { SearchMapClient } = await import('@/components/map/SearchMapClient')
  return <SearchMapClient query={query} />
}

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card h-28 animate-pulse bg-gray-100" />
      ))}
    </div>
  )
}

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse bg-gray-200" />
}
