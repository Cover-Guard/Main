'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import type {
  AdminUserListItem,
  AdminUsersListResponse,
  UserRole,
} from '@coverguard/shared'
import { changeAdminUserRole, listAdminUsers } from '@/lib/api'

const ROLES: UserRole[] = ['BUYER', 'AGENT', 'LENDER', 'INSURANCE', 'ADMIN']
// ADMIN is shown for filter / display only — the role-change <select> below
// excludes it because granting/demoting ADMIN happens via direct DB action.
const ASSIGNABLE_ROLES: UserRole[] = ROLES.filter((r) => r !== 'ADMIN')

type RoleFilter = 'ALL' | UserRole

export function AdminUsersTable() {
  const [data, setData] = useState<AdminUsersListResponse | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Per-row state for in-flight role changes
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Debounce search input by 250 ms.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, roleFilter])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await listAdminUsers({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        role: roleFilter === 'ALL' ? undefined : roleFilter,
      })
      setData(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- B5 follow-up will refactor
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, roleFilter])

  async function handleRoleChange(user: AdminUserListItem, newRole: UserRole) {
    setSavingId(user.id)
    setRowError(null)
    try {
      const res = await changeAdminUserRole(user.id, { role: newRole })
      setData((prev) =>
        prev
          ? { ...prev, users: prev.users.map((u) => (u.id === user.id ? res.user : u)) }
          : prev,
      )
      setToast(`${user.email} is now ${newRole}`)
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setRowError({
        id: user.id,
        message: err instanceof Error ? err.message : 'Role change failed',
      })
    } finally {
      setSavingId(null)
    }
  }

  const totalPages = useMemo(() => {
    if (!data) return 1
    return Math.max(1, Math.ceil(data.total / data.pageSize))
  }, [data])

  return (
    <div className="space-y-4">
      {toast && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className="rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="ALL">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
          <button onClick={load} className="ml-2 underline">retry</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Role</th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Saved</th>
              <th className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (!data || data.users.length === 0) ? (
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-5 animate-pulse rounded bg-gray-100" />
                  </td>
                </tr>
              ))
            ) : data && data.users.length > 0 ? (
              data.users.map((u) => {
                const isAdmin = u.role === 'ADMIN'
                const isSaving = savingId === u.id
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">
                        {(u.firstName || u.lastName) ? `${u.firstName} ${u.lastName}`.trim() : u.email}
                      </div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                      {u.company && <div className="text-xs text-gray-400">{u.company}</div>}
                    </td>
                    <td className="px-4 py-2">
                      {isAdmin ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          ADMIN
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          disabled={isSaving}
                          onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                          className="rounded border border-gray-300 bg-white py-1 pl-2 pr-7 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                      {rowError && rowError.id === u.id && (
                        <div className="mt-1 text-xs text-red-600">{rowError.message}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{u.savedCount}</td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  No users match.
                </td>
              </tr>
            )T/tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (
        <footer className="flex items-center justify-between text-xs text-gray-600">
          <span>
            Showing {data.users.length} of {data.total.toLocaleString()} users
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 disabled:opacity-50"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 disabled:opacity-50"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
