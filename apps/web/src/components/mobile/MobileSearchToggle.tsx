'use client'

import { useState } from 'react'
import { List, Map } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileSearchToggleProps {
  listContent: React.ReactNode
  mapContent: React.ReactNode
}

/**
 * Mobile-only toggle that switches between the results list and the map.
 * Rendered only at < md; the desktop split-panel is handled by the parent.
 */
export function MobileSearchToggle({ listContent, mapContent }: MobileSearchToggleProps) {
  const [view, setView] = useState<'list' | 'map'>('list')

  return (
    <div className="flex h-full flex-col md:hidden">
      {/* Toggle bar */}
      <div className="flex shrink-0 items-center justify-center gap-1 border-b border-gray-200 bg-white px-4 py-2">
        <button
          onClick={() => setView('list')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            view === 'list'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          <List className="h-4 w-4" />
          List
        </button>
        <button
          onClick={() => setView('map')}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            view === 'map'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-100'
          )}
        >
          <Map className="h-4 w-4" />
          Map
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'list' ? (
          <div className="h-full overflow-y-auto px-4 py-4">{listContent}</div>
        ) : (
          <div className="h-full">{mapContent}</div>
        )}
      </div>
    </div>
  )
}
