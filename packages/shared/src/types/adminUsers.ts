/**
 * Admin user-management types (P-B5.b).
 *
 * Backs the /admin/users page and the GET/PATCH endpoints under
 * /api/admin/users. Built on top of the PR-B5.a foundation.
 */

export type UserRole = 'BUYER' | 'AGENT' | 'LENDER' | 'INSURANCE' | 'ADMIN'

export interface AdminUserListItem {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  company: string | null
  createdAt: string
  /** Count of saved properties — quick activity signal in the list. */
  savedCount: number
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[]
  /** Total matching the filter (not just this page). */
  total: number
  page: number
  pageSize: number
  generatedAt: string
}

export interface AdminUsersListQuery {
  /** 1-indexed page number. */
  page?: number
  /** Page size, 1-200. Default 50. */
  pageSize?: number
  /** Search by email or first/last name (case-insensitive substring). */
  search?: string
  /** Filter by role. */
  role?: UserRole
}

export interface AdminRoleChangeRequest {
  role: UserRole
}

export interface AdminRoleChangeResponse {
  user: AdminUserListItem
}
