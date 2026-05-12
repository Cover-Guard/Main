import { Router } from 'express'
import type { Request } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
import {
  changeUserRole,
  listAdminUsers,
  RoleChangeError,
} from '../services/adminUsersService'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { UserRole } from '@coverguard/shared'
import { prisma } from '../utils/prisma'
import { logger } from '../utils/logger'

/**
 * Admin endpoints (P-B5.a — foundation only).
 *
 * Read-only system stats for the admin home page. No write actions in
 * this PR; admin actions (suspending users, refunding subs, etc.) land
 * in later P-B5 follow-ups so each gets its own audit-trail design.
 *
 * Auth: this router is mounted with `requireAuth, requireRole('ADMIN')`
 * in index.ts, so handlers can assume `userRole === 'ADMIN'`.
 */
export const adminRouter = Router()

// All admin endpoints require an authenticated user with the ADMIN role.
// requireRole runs after requireAuth so it can read userRole off the
// AuthenticatedRequest set by requireAuth.
adminRouter.use(requireAuth, requireRole('ADMIN'))

interface AdminStatsResponse {
  users: {
    total: number
    addedLast30Days: number
    byRole: Record<string, number>
  }
  subscriptions: {
    active: number
    canceledLast30Days: number
  }
  reports: {
    last30Days: number
  }
  generatedAt: string
}

adminRouter.get('/stats', async (_req: Request, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Parallel queries — each is cheap (single index lookup or group-by).
    const [
      totalUsers,
      addedLast30,
      usersByRole,
      activeSubs,
      reportsLast30,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      // Active subscription = no cancellation OR scheduled cancellation in the future.
      // Schema-defined: subscription.status === 'ACTIVE' is the source of truth.
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.propertyReport.count({ where: { generatedAt: { gte: thirtyDaysAgo } } }),
    ])

    // Canceled-last-30-days has to be derived separately because the
    // schema typically uses status='CANCELED' with cancellation timestamp.
    // We tolerate the model lacking a canceledAt field by trying that
    // first and falling back to 0 — keeps this foundation PR resilient
    // to small schema variations.
    let canceledLast30 = 0
    try {
      canceledLast30 = await prisma.subscription.count({
        where: {
          status: 'CANCELED',
          updatedAt: { gte: thirtyDaysAgo },
        },
      })
    } catch (err) {
      logger.warn('admin stats: subscription cancellation count failed', { error: err instanceof Error ? err.message : err })
    }

    const byRole = Object.fromEntries(
      usersByRole.map((r) => [r.role, r._count]),
    )

    const data: AdminStatsResponse = {
      users: { total: totalUsers, addedLast30Days: addedLast30, byRole },
      subscriptions: { active: activeSubs, canceledLast30Days: canceledLast30 },
      reports: { last30Days: reportsLast30 },
      generatedAt: new Date().toISOString(),
    }

    // Short cache — admin home should be fresh, but a refresh between
    // tab opens shouldn't trigger five queries.
    res.set('Cache-Control', 'private, max-age=60')
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})


// ─── User management (P-B5.b) ───────────────────────────────────────────────

const ALLOWED_ROLES: ReadonlySet<string> = new Set(['BUYER', 'AGENT', 'LENDER', 'INSURANCE', 'ADMIN'])

adminRouter.get('/users', async (req: Request, res, next) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    if (role && !ALLOWED_ROLES.has(role)) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Unknown role filter' } })
      return
    }
    const data = await listAdminUsers({
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      role: role as UserRole | undefined,
    })
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

adminRouter.patch('/users/:id/role', async (req: Request, res, next) => {
  try {
    const { userId: actorUserId } = req as AuthenticatedRequest
    const targetUserId = req.params.id
    const newRole = (req.body as { role?: unknown })?.role

    if (typeof newRole !== 'string' || !ALLOWED_ROLES.has(newRole)) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'role must be one of BUYER, AGENT, LENDER, INSURANCE, ADMIN' },
      })
      return
    }

    const data = await changeUserRole({
      actorUserId,
      targetUserId,
      newRole: newRole as UserRole,
    })
    res.set('Cache-Control', 'no-store')
    res.json({ success: true, data })
  } catch (err) {
    if (err instanceof RoleChangeError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'NO_CHANGE' ? 409 : 403
      res.status(status).json({ success: false, error: { code: err.code, message: err.message } })
      return
    }
    next(err)
  }
})
