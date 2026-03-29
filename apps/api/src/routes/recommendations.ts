import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const recommendationsRouter = Router()
recommendationsRouter.use(requireAuth)

const createSchema = z.object({
  clientId: z.string().min(1),
  propertyId: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  notes: z.string().max(1000).optional(),
})

const updateSchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PENDING', 'VIEWED', 'INTERESTED', 'NOT_INTERESTED', 'QUOTE_REQUESTED']).optional(),
  notes: z.string().max(1000).optional(),
})

const listSchema = z.object({
  clientId: z.string().optional(),
  status: z.enum(['PENDING', 'VIEWED', 'INTERESTED', 'NOT_INTERESTED', 'QUOTE_REQUESTED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── List recommendations ────────────────────────────────────────────────────

recommendationsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { clientId, status, page, limit } = listSchema.parse(req.query)

    const where = {
      agentId: userId,
      ...(clientId ? { clientId } : {}),
      ...(status ? { status } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.clientPropertyRecommendation.findMany({
        where,
        include: {
          property: true,
          client: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clientPropertyRecommendation.count({ where }),
    ])

    res.json({
      success: true,
      data: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    next(err)
  }
})

// ─── Create recommendation ───────────────────────────────────────────────────

recommendationsRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = createSchema.parse(req.body)

    // Verify agent owns the client
    const client = await prisma.client.findFirst({
      where: { id: body.clientId, agentId: userId },
    })
    if (!client) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } })
      return
    }

    const rec = await prisma.clientPropertyRecommendation.upsert({
      where: { clientId_propertyId: { clientId: body.clientId, propertyId: body.propertyId } },
      update: { priority: body.priority, notes: body.notes ?? null },
      create: {
        agentId: userId,
        clientId: body.clientId,
        propertyId: body.propertyId,
        priority: body.priority,
        notes: body.notes ?? null,
      },
      include: {
        property: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.status(201).json({ success: true, data: rec })
  } catch (err) {
    next(err)
  }
})

// ─── Update recommendation ───────────────────────────────────────────────────

recommendationsRouter.patch('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = updateSchema.parse(req.body)
    const id = String(req.params.id)

    const updated = await prisma.clientPropertyRecommendation.updateMany({
      where: { id, agentId: userId },
      data: {
        ...(body.priority ? { priority: body.priority } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    })

    if (updated.count === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recommendation not found' } })
      return
    }

    const result = await prisma.clientPropertyRecommendation.findUniqueOrThrow({
      where: { id },
      include: {
        property: true,
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// ─── Delete recommendation ───────────────────────────────────────────────────

recommendationsRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    await prisma.clientPropertyRecommendation.deleteMany({
      where: { id: String(req.params.id), agentId: userId },
    })
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
