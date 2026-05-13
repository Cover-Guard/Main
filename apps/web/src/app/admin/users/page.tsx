import { Suspense } from 'react'
import { AdminUsersTable } from './AdminUsersTable'

export const dynamic = 'force-dynamic'

/**
 * Admin user management page (P-B5.b).
 *
 * Paginated table with role filter and search. Each row exposes a role
 * dropdown for the four non-ADMIN roles. ADMIN promotion/demotion is
 * deliberately not available here — those happen via direct DB action
 * with a separate audit trail (see RoleChangeError guards in
 * adminUsersService).
 */
export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse, search, and change non-ADMIN roles. Admin promotion/demotion
          requires a direct database change with separate audit trail.
        </p>
      </header>
      <Suspense fallback={<TableSkeleton />}>
        <AdminUsersTable />
      </Suspense>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-white shadow ring-1 ring-gray-200" />
      ))}
    </div>
  )
}
