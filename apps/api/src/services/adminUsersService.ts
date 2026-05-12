/**
 * Admin user-management service (P-B5.b).
 *
 * Powers /api/admin/users list and role-change endpoints.
 *
 * Hard guards (enforced here, not in the route — defense in depth):
 *  - changeRole cannot be used to grant ADMIN. ADMIN promotion happens
 *    via direct DB action with a separate audit trail. This avoids
 *    horizontal privilege escalation where one admin elevates another.
 *  - changeRole cannot be used to demote another ADMIN. Same rationale —
 *    prevents one admin from locking out peers.
 *  - changeRole cannot be used to change one's OWN role (the route does
 *    a self-check on userId == :id, but we also re-check here so future
 *    callers can't bypass).
 *
 * Every successful role change writes a UserActivityEvent of type
 * ADMIN_ACTION on the TARGET user, with metadata capturing the actor,
 * the previous role, and the new role.
 */

import { prisma } from '../utils/prisma'
import type {
  AdminRoleChangeResponse,
  AdminUserListItem,
  AdminUsersListQuery,
  AdminUsersListResponse,
  UserRole,
} from '@coverguard/shared'

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

export async function listAdminUsers(query: AdminUsersListQuery): Promise<AdminUsersListResponse> {
  const page = clampInt(query.page, 1, 100_000, 1)
  const pageSize = clampInt(query.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE)
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (query.role) where.role = query.role
  if (query.search) {
    const q = query.search.trim()
    if (q.length > 0) {
      where.OR = [
        { email:     { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName:  { contains: q, mode: 'insensitive' } },
      ]
    }
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        company: true,
        createdAt: true,
        _count: { select: { savedProperties: true } },
      },
    }),
  ])

  const users: AdminUserListItem[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.role as UserRole,
    company: r.company,
    createdAt: r.createdAt.toISOString(),
    savedCount: r._count.savedProperties,
  }))

  return {
    users,
    total,
    page,
    pageSize,
    generatedAt: new Date().toISOString(),
  }
}

export interface ChangeRoleArgs {
  actorUserId: string
  targetUserId: string
  newRole: UserRole
}

export class RoleChangeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'RoleChangeError'
  }
}

export async function changeUserRole(args: ChangeRoleArgs): Promise<AdminRoleChangeResponse> {
  const { actorUserId, targetUserId, newRole } = args

  // Self-edit guard.
  if (actorUserId === targetUserId) {
    throw new RoleChangeError('SELF_EDIT', 'You cannot change your own role')
  }

  // ADMIN-grant guard.
  if (newRole === 'ADMIN') {
    throw new RoleChangeError(
      'ADMIN_GRANT_FORBIDDEN',
      'Granting ADMIN must happen via direct DB action with a separate audit trail',
    )
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  })
  if (!target) throw new RoleChangeError('NOT_FOUND', 'User not found')

  // ADMIN-demote guard.
  if (target.role === 'ADMIN') {
    throw new RoleChangeError(
      'ADMIN_DEMOTE_FORBIDDEN',
      'Demoting an ADMIN must happen via direct DB action with a separate audit trail',
    )
  }

  // No-op guard.
  if (target.role === newRole) {
    throw new RoleChangeError('NO_CHANGE', `User is already ${newRole}`)
  }

  // Apply the change + write the audit log atomically.
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, company: true, createdAt: true,
        _count: { select: { savedProperties: true } },
      },
    }),
    prisma.userActivityEvent.create({
      data: {
        userId: targetUserId,
        eventType: 'ADMIN_ACTION',
        entityType: 'user',
        entityId: targetUserId,
        metadata: {
          action: 'role_change',
          actorUserId,
          previousRole: target.role,
          newRole,
        },
      },
    }),
  ])

  const user: AdminUserListItem = {
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role as UserRole,
    company: updated.company,
    createdAt: updated.createdAt.toISOString(),
    savedCount: updated._count.savedProperties,
  }
  return { user }
}
