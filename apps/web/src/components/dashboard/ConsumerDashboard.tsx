'use client'

import Link from 'next/link'
import { GitCompare } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { SavedPropertiesPanel } from './SavedPropertiesPanel'
import { useCompare } from '@/lib/useCompare'

export function ConsumerDashboard() {
  const { ids: compareIds, compareUrl, clear: clearCompare } = useCompare()

  return (
    <div>
      {/* Search hero */}
      <div className="bg-brand-800 px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-2 text-2xl font-bold">Search a Property</h1>
          <p className="mb-6 text-brand-200">
            Enter an address to get a full risk, insurability, and carrier availability report
          </p>
          <SearchBar className="mx-auto max-w-2xl" />
        </div>
      </div>

      {/* Compare bar */}
      {compareIds.length >= 2 && compareUrl && (
        <div className="bg-brand-600 px-4 py-2.5 text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <GitCompare className="h-4 w-4" />
              <span className="font-medium">{compareIds.length} properties ready to compare</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearCompare} className="text-xs text-brand-200 hover:text-white">Clear</button>
              <Link href={compareUrl} className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                Compare Now →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8">
        <SavedPropertiesPanel />
      </div>
    </div>
  )
}
