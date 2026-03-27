import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const clientsRouter = Router()
clientsRouter.use(requireAuth)

const clientSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName:  z.string().min(1).max(50),
  email:     z.string().email(),
  phone:     z.string().optional(),
  notes:     z.string().max(500).optional(),
})

const updateSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName:  z.string().min(1).max(50).optional(),
  email:     z.string().email().optional(),
  phone:     z.string().optional(),
  notes:     z.string().max(500).optional(),
  status:    z.enum(['ACTIVE', 'PROSPECT', 'CLOSED', 'INACTIVE']).optional(),
})

// ─── List ─────────────────────────────────────────────────────────────────────

clientsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const clients = await prisma.client.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: clients })
  } catch (err) { next(err) }
})

// ─── Create ───────────────────────────────────────────────────────────────────

clientsRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = clientSchema.parse(req.body)
    const client = await prisma.client.create({
      data: { agentId: userId, ...body },
    })
    res.status(201).json({ success: true, data: client })
  } catch (err) { next(err) }
})

// ─── Update ───────────────────────────────────────────────────────────────────

clientsRouter.patch('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = updateSchema.parse(req.body)
    const id = String(req.params.id)
    if (!id || id === 'undefined') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Client ID is required' } })
      return
    }

    // updateMany scoped to agentId ensures no authorization bypass via race condition
    const result = await prisma.client.updateMany({
      where: { id, agentId: userId },
      data: body,
    })
    if (result.count === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } })
      return
    }

    const updated = await prisma.client.findUniqueOrThrow({ where: { id } })
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

// ─── Delete ───────────────────────────────────────────────────────────────────

clientsRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const id = String(req.params.id)
    if (!id || id === 'undefined') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Client ID is required' } })
      return
    }
    const result = await prisma.client.deleteMany({ where: { id, agentId: userId } })
    if (result.count === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } })
      return
    }
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
})
