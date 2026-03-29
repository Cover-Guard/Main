import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const activityLogRouter = Router()
activityLogRouter.use(requireAuth)

const createSchema = z.object({
  propertyId: z.string().min(1),
  clientId: z.string().optional(),
  activityType: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'VIEWING', 'QUOTE_SENT', 'FOLLOW_UP', 'STATUS_CHANGE']).default('NOTE'),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
})

const listSchema = z.object({
  propertyId: z.string().optional(),
  clientId: z.string().optional(),
  activityType: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'VIEWING', 'QUOTE_SENT', 'FOLLOW_UP', 'STATUS_CHANGE']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── List activity log entries ───────────────────────────────────────────────

activityLogRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { propertyId, clientId, activityType, page, limit } = listSchema.parse(req.query)

    const where = {
      userId,
      ...(propertyId ? { propertyId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(activityType ? { activityType } : {}),
    }

    const [entries, total] = await Promise.all([
      prisma.propertyActivityLog.findMany({
        where,
        include: {
          property: true,
          client: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.propertyActivityLog.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        items: entries,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Create activity log entry ───────────────────────────────────────────────

activityLogRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = createSchema.parse(req.body)

    const entry = await prisma.propertyActivityLog.create({
      data: {
        userId,
        propertyId: body.propertyId,
        clientId: body.clientId ?? null,
        activityType: body.activityType,
        title: body.title,
        description: body.description ?? null,
      },
      include: {
        property: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.status(201).json({ success: true, data: entry })
  } catch (err) {
    next(err)
  }
})

// ─── Delete activity log entry ───────────────────────────────────────────────

activityLogRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    await prisma.propertyActivityLog.deleteMany({
      where: { id: String(req.params.id), userId },
    })
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
