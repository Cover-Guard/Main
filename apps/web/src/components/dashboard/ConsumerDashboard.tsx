'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, GitCompare, ArrowRight, Shield, TrendingUp, Building2, Clock } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { SavedPropertiesPanel } from './SavedPropertiesPanel'
import { useCompare } from '@/lib/useCompare'
import { getAnalytics } from '@/lib/api'
import type { AnalyticsSummary } from '@coverguard/shared'

export function ConsumerDashboard() {
  const { ids: compareIds, compareUrl, clear: clearCompare } = useCompare()
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)

  useEffect(() => {
    getAnalytics().then(setAnalytics).catch(() => null)
  }, [])

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

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Stats strip */}
        {analytics && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                <Building2 className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalSavedProperties}</p>
              <p className="text-xs text-gray-500 mt-0.5">Saved Properties</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                <Search className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalSearches}</p>
              <p className="text-xs text-gray-500 mt-0.5">Searches</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="flex items-center justify-center mb-1">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalReports}</p>
              <p className="text-xs text-gray-500 mt-0.5">Reports</p>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {analytics?.recentActivity && analytics.recentActivity.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">Recent Activity</h3>
            </div>
            <div className="space-y-2">
              {analytics.recentActivity.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-base shrink-0">
                    {a.type === 'search' ? '🔍' : a.type === 'save' ? '🏠' : '📄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 truncate">{a.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.timestamp).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risk tip banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Pro tip: Check insurance before you bid</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Many buyers discover insurance issues after going under contract. Run a CoverGuard check first to avoid surprises at closing.
            </p>
          </div>
        </div>

        {/* Saved properties */}
        <SavedPropertiesPanel />

        {/* Compare CTA */}
        {compareIds.length === 1 && (
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
            <p className="font-medium">1 property added to compare.</p>
            <p className="mt-0.5 text-brand-600">Search and add 1–2 more properties to compare side-by-side.</p>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/reports"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Building2 className="h-4 w-4 text-gray-400" />
            View All Reports
            <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <TrendingUp className="h-4 w-4 text-gray-400" />
            View Analytics
            <ArrowRight className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  )
}
