import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { searchProperties } from '@/lib/api'
import { PropertyCard } from './PropertyCard'

interface SearchResultsProps {
  query: string
  page: number
}

export async function SearchResults({ query, page }: SearchResultsProps) {
  const LIMIT = 20
  const params = parseSearchQuery(query)

  let result
  try {
    result = await searchProperties({ ...params, page, limit: LIMIT })
  } catch {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        Unable to search properties. Please try again.
      </div>
    )
  }

  if (result.total === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium text-gray-700">No properties found for &quot;{query}&quot;</p>
        <p className="mt-2 text-gray-500">Try a different address, ZIP code, or city name</p>
      </div>
    )
  }

  const totalPages = Math.ceil(result.total / LIMIT)
  const showing = {
    from: (page - 1) * LIMIT + 1,
    to: Math.min(page * LIMIT, result.total),
  }

  function pageUrl(p: number) {
    return `/search?q=${encodeURIComponent(query)}&page=${p}`
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Showing {showing.from}–{showing.to} of {result.total} result{result.total !== 1 ? 's' : ''} for &quot;{query}&quot;
      </p>
      <div className="space-y-4">
        {result.properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <Link
            href={page > 1 ? pageUrl(page - 1) : '#'}
            aria-disabled={page <= 1}
            className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              page <= 1
                ? 'pointer-events-none border-gray-100 text-gray-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              // Show pages around current: first, last, and 2 on each side
              let pageNum: number
              if (totalPages <= 7) {
                pageNum = i + 1
              } else if (i === 0) {
                pageNum = 1
              } else if (i === 6) {
                pageNum = totalPages
              } else if (page <= 4) {
                pageNum = i + 1
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i
              } else {
                pageNum = page - 3 + i
              }

              const isActive = pageNum === page
              const isEllipsis =
                totalPages > 7 &&
                ((i === 1 && pageNum > 2) || (i === 5 && pageNum < totalPages - 1))

              if (isEllipsis) {
                return <span key={i} className="px-2 text-sm text-gray-400">…</span>
              }

              return (
                <Link
                  key={i}
                  href={pageUrl(pageNum)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </Link>
              )
            })}
          </div>

          <Link
            href={page < totalPages ? pageUrl(page + 1) : '#'}
            aria-disabled={page >= totalPages}
            className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              page >= totalPages
                ? 'pointer-events-none border-gray-100 text-gray-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  )
}

function parseSearchQuery(query: string) {
  // Try to detect ZIP code
  const zipMatch = query.match(/\b(\d{5})\b/)
  if (zipMatch) return { zip: zipMatch[1], address: query }

  // Try state abbreviation at end
  const stateMatch = query.match(/,\s*([A-Z]{2})\s*(\d{5})?$/)
  if (stateMatch) {
    return {
      address: query.split(',')[0]?.trim(),
      state: stateMatch[1],
      zip: stateMatch[2],
    }
  }

  return { address: query }
}
