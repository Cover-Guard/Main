import { Suspense } from 'react'
import { AdminStatsView } from './AdminStatsView'

export const dynamic = 'force-dynamic'

/**
 * Admin home page (P-B5.a).
 *
 * Read-only stats overview. Streams the stats panel via Suspense so
 * the layout chrome paints immediately and the data fetch (which
 * touches Postgres) doesn't block first paint.
 */
export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Read-only stats for users, subscriptions, and report generation.
        </p>
      </header>
      <Suspense fallback={<StatsLoading />}>
        <AdminStatsView />
      </Suspense>
    </div>
  )
}

function StatsLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-lg bg-white shadow ring-1 ring-gray-200" />
      ))}
    </div>
  )
}
