'use client'

import Link from 'next/link'
import { GitCompare, Search, Clock, FileText, Shield, BarChart3, Lock, Zap } from 'lucide-react'
import { SearchBar } from '@/components/search/SearchBar'
import { SavedPropertiesPanel } from './SavedPropertiesPanel'
import { useCompare } from '@/lib/useCompare'
import { useSubscription } from '@/lib/hooks/useSubscription'

// ── Locked quick-link card — shown when a feature requires an upgrade ──────
function LockedQuickLink({
  icon,
  iconBg,
  title,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
}) {
  return (
    <Link
      href="/pricing"
      className="bg-white rounded-xl border border-brand-100 p-4 flex items-center gap-3 hover:bg-brand-50 transition-colors group"
      title={`${title} — upgrade to unlock`}
    >
      <div className={`h-8 w-8 shrink-0 rounded-lg ${iconBg} flex items-center justify-center opacity-40`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-500 truncate">{title}</p>
          <Lock className="h-3 w-3 text-gray-400 shrink-0" />
        </div>
        <p className="text-[10px] font-medium text-brand-600 uppercase tracking-wide group-hover:underline">
          Upgrade →
        </p>
      </div>
    </Link>
  )
}

export function ConsumerDashboard() {
  const { ids: compareIds, compareUrl, clear: clearCompare } = useCompare()

  // Subscription gating — consumers get comparison, analytics, and reports at Individual ($29)
  const { isGated, loading: subLoading } = useSubscription()
  const compareGated = isGated('property_comparison')
  // Analytics and reports are gated at Individual for consumers (search history / saved reports)
  // Use insurance_cost_estimates as the proxy since it requires Individual, same tier
  const analyticsGated = isGated('insurance_cost_estimates')
  const reportsGated = isGated('insurance_cost_estimates')

  return (
    <div>
      {/* Search hero */}
      <div className="bg-[#0d1929] px-4 py-10 text-white">
        <div className="mx-auto max-w-full text-center">
          <h1 className="mb-2 text-2xl font-bold">Search</h1>
          <p className="mb-6 text-white/60">
            Enter an address to get a full risk, insurability, and carrier availability report
          </p>
          <SearchBar className="mx-auto max-w-2xl" />
        </div>
      </div>

      {/* Compare bar — active when 2+ properties selected */}
      {compareIds.length >= 2 && compareUrl && (
        compareGated && !subLoading ? (
          // Gated: prompt upgrade instead of proceeding to compare
          <div className="bg-brand-50 border-b border-brand-100 px-4 py-2.5">
            <div className="mx-auto flex max-w-full items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-brand-700">
                <Lock className="h-4 w-4 shrink-0" />
                <span className="font-medium">Property comparison requires the Individual plan</span>
              </div>
              <Link
                href="/pricing"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Upgrade
              </Link>
            </div>
          </div>
        ) : (
          // Unlocked: show normal compare bar
          <div className="bg-teal-600 px-4 py-2.5 text-white">
            <div className="mx-auto flex max-w-full items-center justify-between">
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
        )
      )}

      <div className="mx-auto max-w-full px-4 py-8 space-y-4">

        {/* Quick links — Analytics, Reports, Compare */}
        <div className="grid grid-cols-3 gap-3">
          {!subLoading && analyticsGated ? (
            <LockedQuickLink
              icon={<BarChart3 className="h-4 w-4 text-blue-500" />}
              iconBg="bg-blue-50"
              title="Analytics"
            />
          ) : (
            <Link href="/analytics" className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Analytics</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">View Stats</p>
              </div>
            </Link>
          )}

          {!subLoading && reportsGated ? (
            <LockedQuickLink
              icon={<FileText className="h-4 w-4 text-purple-500" />}
              iconBg="bg-purple-50"
              title="Reports"
            />
          ) : (
            <Link href="/reports" className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-purple-50 flex items-center justify-center">
                <FileText className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Reports</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">My Reports</p>
              </div>
            </Link>
          )}

          {!subLoading && compareGated ? (
            <LockedQuickLink
              icon={<GitCompare className="h-4 w-4 text-teal-500" />}
              iconBg="bg-teal-50"
              title="Compare"
            />
          ) : (
            <Link href="/dashboard?tab=compare" className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-teal-50 flex items-center justify-center">
                <GitCompare className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Compare</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Properties</p>
              </div>
            </Link>
          )}
        </div>

        {/* Saved properties */}
        <SavedPropertiesPanel />

        {/* Empty state CTA — shown when no saved properties exist */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 lg:p-4 text-center">
          <Shield className="mx-auto h-10 w-10 text-gray-200 mb-3" />
          <p className="font-semibold text-gray-700">Ready to check a property?</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Search any US address to see flood, fire, earthquake, wind, and crime risk.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
            Check a Property
          </Link>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
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
