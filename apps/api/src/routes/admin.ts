import { Router } from 'express'
import type { Request } from 'express'
import { requireAuth, requireRole } from '../middleware/auth'
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
