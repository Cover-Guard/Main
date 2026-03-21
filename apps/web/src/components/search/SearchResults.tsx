import { searchProperties } from '@/lib/api'
import { PropertyCard } from './PropertyCard'

interface SearchResultsProps {
  query: string
  page: number
}

export async function SearchResults({ query, page }: SearchResultsProps) {
  // Parse query into search params
  const params = parseSearchQuery(query)

  let result
  try {
    result = await searchProperties({ ...params, page, limit: 20 })
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
        <p className="mt-2 text-gray-500">Try a different address or ZIP code</p>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        {result.total} result{result.total !== 1 ? 's' : ''} for &quot;{query}&quot;
      </p>
      <div className="space-y-4">
        {result.properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  )
}

function parseSearchQuery(query: string) {
  // Try to detect ZIP code
  const zipMatch = query.match(/\b(\d{5})\b/)
  if (zipMatch) return { zip: zipMatch[1], address: query }

  // Try state abbreviation
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
