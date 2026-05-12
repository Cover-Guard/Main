'use client'

import { useEffect, useState } from 'react'
import { Users, CreditCard, FileText, RefreshCw } from 'lucide-react'
import type { AdminStats } from '@coverguard/shared'
import { getAdminStats } from '@/lib/api'

/**
 * Stats panel for the admin home. Client component so the user can hit
 * "refresh" without a full nav. The server-side role gate in layout.tsx
 * already ensured we have an authenticated admin user.
 */
export function AdminStatsView() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getAdminStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- foundation PR; deferred refactor in B5 follow-up
  useEffect(() => { load() }, [])

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-white shadow ring-1 ring-gray-200" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <strong>Couldn&apos;t load stats:</strong> {error}
        <button onClick={load} className="ml-3 text-red-700 underline">retry</button>
      </div>
    )
  }

  if (!stats) return null

  const rolePairs = Object.entries(stats.users.byRole)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label="Total users"
          value={stats.users.total.toLocaleString()}
          sub={`+${stats.users.addedLast30Days.toLocaleString()} in last 30 days`}
        />
        <KpiCard
          icon={<CreditCard className="h-5 w-5 text-green-600" />}
          label="Active subscriptions"
          value={stats.subscriptions.active.toLocaleString()}
          sub={`${stats.subscriptions.canceledLast30Days.toLocaleString()} canceled in last 30 days`}
        />
        <KpiCard
          icon={<FileText className="h-5 w-5 text-purple-600" />}
          label="Reports generated (30 days)"
          value={stats.reports.last30Days.toLocaleString()}
          sub="Property reports persisted to PropertyReport table"
        />
      </div>

      <section className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-700">
          Users by role
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {rolePairs.map(([role, count]) => (
            <div key={role} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="text-xs font-medium text-gray-500">{role}</div>
              <div className="mt-0.5 text-lg font-semibold text-gray-900">
                {count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex items-center justify-between text-xs text-gray-500">
        <span>Generated {new Date(stats.generatedAt).toLocaleString()}</span>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </footer>
    </div>
  )
}

function KpiCard({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow ring-1 ring-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {label}
          </div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{value}</div>
        </div>
        {icon}
      </div>
      <div className="mt-2 text-xs text-gray-500">{sub}</div>
    </div>
  )
}
