'use client'

import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { addToRiskWatchlist } from '@/lib/api'

export function WatchlistButton({ propertyId }: { propertyId: string }) {
  const [added, setAdded] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (added) return
    setLoading(true)
    try {
      await addToRiskWatchlist(propertyId)
      setAdded(true)
    } catch {
      // silent — user may not be authenticated
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading || added}
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
      title={added ? 'On watchlist' : 'Add to risk watchlist'}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : added ? (
        <EyeOff className="h-4 w-4 text-green-600" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
      {added ? 'Watching' : 'Watch'}
    </button>
  )
}
