import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const comparisonsRouter = Router()
comparisonsRouter.use(requireAuth)

const createSchema = z.object({
  name: z.string().min(1).max(100),
  propertyIds: z.array(z.string()).min(2).max(3),
  notes: z.string().max(1000).optional(),
})

// ─── List saved comparisons ──────────────────────────────────────────────────

comparisonsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const comparisons = await prisma.savedComparison.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ success: true, data: comparisons })
  } catch (err) {
    next(err)
  }
})

// ─── Create saved comparison ─────────────────────────────────────────────────

comparisonsRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = createSchema.parse(req.body)

    const comparison = await prisma.savedComparison.create({
      data: {
        userId,
        name: body.name,
        propertyIds: body.propertyIds,
        notes: body.notes ?? null,
      },
    })

    res.status(201).json({ success: true, data: comparison })
  } catch (err) {
    next(err)
  }
})

// ─── Get saved comparison ────────────────────────────────────────────────────

comparisonsRouter.get('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const comparison = await prisma.savedComparison.findFirst({
      where: { id: String(req.params.id), userId },
    })
    if (!comparison) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Comparison not found' } })
      return
    }
    res.json({ success: true, data: comparison })
  } catch (err) {
    next(err)
  }
})

// ─── Delete saved comparison ─────────────────────────────────────────────────

comparisonsRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    await prisma.savedComparison.deleteMany({
      where: { id: String(req.params.id), userId },
    })
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
