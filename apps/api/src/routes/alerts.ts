import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import { prisma } from '../utils/prisma'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { Request } from 'express'

export const alertsRouter = Router()

// ─── List alerts (paginated) ────────────────────────────────────────────────

const listSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
})

alertsRouter.get('/', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { page, limit, unreadOnly } = listSchema.parse(req.query)

    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    }

    const [alerts, total] = await Promise.all([
      prisma.riskAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          property: {
            select: { address: true, city: true, state: true },
          },
        },
      }),
      prisma.riskAlert.count({ where }),
    ])

    res.json({ success: true, data: { alerts, total } })
  } catch (err) {
    next(err)
  }
})

// ─── Unread count ───────────────────────────────────────────────────────────

alertsRouter.get('/unread-count', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const count = await prisma.riskAlert.count({
      where: { userId, isRead: false },
    })
    res.json({ success: true, data: { count } })
  } catch (err) {
    next(err)
  }
})

// ─── Mark single alert as read ──────────────────────────────────────────────

alertsRouter.patch('/:id/read', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const alertId = String(req.params.id)

    const result = await prisma.riskAlert.updateMany({
      where: { id: alertId, userId },
      data: { isRead: true },
    })

    if (result.count === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      })
      return
    }

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

// ─── Mark all alerts as read ────────────────────────────────────────────────

alertsRouter.patch('/read-all', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    await prisma.riskAlert.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

// ─── Get alert preferences ──────────────────────────────────────────────────

alertsRouter.get('/preferences', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { riskAlertEnabled: true, riskAlertThreshold: true },
    })

    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})

// ─── Update alert preferences ───────────────────────────────────────────────

const preferencesSchema = z.object({
  riskAlertEnabled: z.boolean().optional(),
  riskAlertThreshold: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']).optional(),
})

alertsRouter.patch('/preferences', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = preferencesSchema.parse(req.body)

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.riskAlertEnabled !== undefined ? { riskAlertEnabled: body.riskAlertEnabled } : {}),
        ...(body.riskAlertThreshold !== undefined ? { riskAlertThreshold: body.riskAlertThreshold } : {}),
      },
      select: { riskAlertEnabled: true, riskAlertThreshold: true },
    })

    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})
