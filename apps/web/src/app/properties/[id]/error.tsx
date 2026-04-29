'use client'

import Link from 'next/link'

/**
 * Map a thrown Error.message (which comes from the server's
 * error.message field or the generic fetch-failure text) to a
 * user-friendly explanation. Keep these strings in sync with the
 * server's error codes in apps/api/src/routes/properties.ts.
 */
function getFriendlyMessage(message: string): string {
  if (message === 'Property not found') {
    return 'This property could not be found. It may have been removed or the address may be incorrect.'
  }
  // Returned when the slug parses but Google geocoding can't validate
  // the address (missing/invalid GOOGLE_MAPS_API_KEY or truly bad input).
  if (message.startsWith('Could not validate this address')) {
    return 'We could not validate this address. Please check the spelling or try searching again.'
  }
  // Returned when ensurePropertyId throws — typically a transient
  // backend failure (DB down, geocoder unreachable).
  if (message.startsWith('Could not resolve property')) {
    return 'We had trouble loading this property. Please try again in a moment.'
  }
  if (message.includes('Network error') || message.includes('timed out')) {
    return 'Network error. Please check your connection and try again.'
  }
  return 'Something went wrong while loading this property. Please try again.'
}

export default function PropertyError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-8 w-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Unable to Load Property
        </h1>

        <p className="text-gray-600 mb-8">
          {getFriendlyMessage(error.message)}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/search"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Back to Search
          </Link>
        </div>
      </div>
    </div>
  )
}
