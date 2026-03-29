import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const quoteRequestsRouter = Router()
quoteRequestsRouter.use(requireAuth)

// ─── List all quote requests for the authenticated user ──────────────────────

const listSchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'RESPONDED', 'DECLINED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

quoteRequestsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { status, page, limit } = listSchema.parse(req.query)

    const where = {
      userId,
      ...(status ? { status } : {}),
    }

    const [requests, total] = await Promise.all([
      prisma.quoteRequest.findMany({
        where,
        include: { property: true },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.quoteRequest.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        items: requests,
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

// ─── Get single quote request ────────────────────────────────────────────────

quoteRequestsRouter.get('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const request = await prisma.quoteRequest.findFirst({
      where: { id: String(req.params.id), userId },
      include: { property: true },
    })
    if (!request) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quote request not found' } })
      return
    }
    res.json({ success: true, data: request })
  } catch (err) {
    next(err)
  }
})

// ─── Update quote request status ─────────────────────────────────────────────

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'RESPONDED', 'DECLINED']),
  statusNote: z.string().max(500).optional(),
})

quoteRequestsRouter.patch('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = updateStatusSchema.parse(req.body)
    const id = String(req.params.id)

    const updated = await prisma.quoteRequest.updateMany({
      where: { id, userId },
      data: { status: body.status, statusNote: body.statusNote ?? null },
    })

    if (updated.count === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quote request not found' } })
      return
    }

    const result = await prisma.quoteRequest.findUniqueOrThrow({
      where: { id },
      include: { property: true },
    })

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})
