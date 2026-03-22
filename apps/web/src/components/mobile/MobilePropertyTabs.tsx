'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

type Tab = { id: string; label: string }

interface MobilePropertyTabsProps {
  tabs: Tab[]
  panels: Record<string, React.ReactNode>
}

/**
 * Tab switcher used on the mobile property detail page.
 * Replaces the 3-column desktop grid with a swipeable tab interface.
 */
export function MobilePropertyTabs({ tabs, panels }: MobilePropertyTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')

  return (
    <div className="flex flex-col md:hidden">
      {/* Tab bar */}
      <div className="sticky top-0 z-10 flex overflow-x-auto border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              'flex shrink-0 items-center justify-center px-5 py-3 text-sm font-medium transition-colors',
              active === tab.id
                ? 'border-b-2 border-brand-600 text-brand-700'
                : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <div className="min-h-0">
        {panels[active]}
      </div>
    </div>
  )
}
