'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GitCompare, Bookmark, Search, Clock, FileText, Shield, Activity, AlertTriangle } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { SavedPropertiesPanel } from './SavedPropertiesPanel'
import { useCompare } from '@/lib/useCompare'
import { getAnalytics } from '@/lib/api'
import type { AnalyticsSummary } from '@coverguard/shared'

export function ConsumerDashboard() {
  const { ids: compareIds, compareUrl, clear: clearCompare } = useCompare()
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  useEffect(() => {
    getAnalytics()
      .then(setAnalytics)
      .catch((err) => setAnalyticsError(err instanceof Error ? err.message : 'Failed to load activity'))
  }, [])

  const totalSearches = analytics?.totalSearches ?? 0
  const totalSaved = analytics?.totalSavedProperties ?? 0
  const totalReports = analytics?.totalReports ?? 0

  return (
    <div>
      {/* Search hero */}
      <div className="bg-[#0d1929] px-4 py-10 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-2 text-2xl font-bold">Search a Property</h1>
          <p className="mb-6 text-white/60">
            Enter an address to get a full risk, insurability, and carrier availability report
          </p>
          <SearchBar className="mx-auto max-w-2xl" />
        </div>
      </div>

      {/* Compare bar */}
      {compareIds.length >= 2 && compareUrl && (
        <div className="bg-teal-600 px-4 py-2.5 text-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <GitCompare className="h-4 w-4" />
              <span className="font-medium">{compareIds.length} properties ready to compare</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={clearCompare} className="text-xs text-white/70 hover:text-white">Clear</button>
              <Link href={compareUrl} className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
                Compare Now →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Analytics error */}
        {analyticsError && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Activity data unavailable: {analyticsError}</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
              <Search className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{totalSearches}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Searches</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Bookmark className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{totalSaved}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Saved</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-purple-50 flex items-center justify-center">
              <FileText className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{totalReports}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Reports</p>
            </div>
          </div>
        </div>

        {/* Saved properties */}
        <SavedPropertiesPanel />

        {/* Recent activity */}
        {(analytics?.recentActivity ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-gray-800">Recent Activity</h2>
            </div>
            <div className="space-y-2">
              {analytics!.recentActivity.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'search' ? (
                      <Search className="h-3.5 w-3.5 text-blue-400" />
                    ) : item.type === 'save' ? (
                      <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-purple-400" />
                    )}
                  </div>
                  <p className="flex-1 text-xs text-gray-600 truncate">{item.description}</p>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state CTA */}
        {totalSearches === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-gray-200 mb-3" />
            <p className="font-semibold text-gray-700">Ready to check a property?</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Search any US address to see flood, fire, earthquake, wind, and crime risk.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <Search className="h-4 w-4" />
              Check a Property
            </Link>
          </div>
        )}

        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/compare"
            className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare Properties
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            My Reports
          </Link>
          <Link
            href="/account"
            className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            Account Settings
          </Link>
        </div>

      </div>
    </div>
  )
}
