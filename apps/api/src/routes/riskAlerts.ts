import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const riskAlertsRouter = Router()
riskAlertsRouter.use(requireAuth)
riskAlertsRouter.use(requireSubscription)

const riskTypeEnum = z.enum(['FLOOD', 'FIRE', 'WIND', 'EARTHQUAKE', 'CRIME'])
const frequencyEnum = z.enum(['IMMEDIATE', 'DAILY', 'WEEKLY'])

const createAlertSchema = z.object({
  propertyId: z.string().uuid(),
  frequency: frequencyEnum.default('WEEKLY'),
  riskTypes: z.array(riskTypeEnum).min(1).max(5).default(['FLOOD', 'FIRE', 'WIND', 'EARTHQUAKE', 'CRIME']),
})

const updateAlertSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: frequencyEnum.optional(),
  riskTypes: z.array(riskTypeEnum).min(1).max(5).optional(),
})

// List all risk alerts for the current user
riskAlertsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    const alerts = await prisma.riskAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: {
          select: { id: true, address: true, city: true, state: true, zip: true },
        },
      },
    })

    res.json({ success: true, data: alerts })
  } catch (err) {
    next(err)
  }
})

// Get alert for a specific property
riskAlertsRouter.get('/property/:propertyId', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const propertyId = String(req.params.propertyId)

    const alert = await prisma.riskAlert.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
    })

    res.json({ success: true, data: alert })
  } catch (err) {
    next(err)
  }
})

// Create or update a risk alert (upsert)
riskAlertsRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = createAlertSchema.parse(req.body)

    const propertyExists = await prisma.property.findUnique({
      where: { id: body.propertyId },
      select: { id: true },
    })
    if (!propertyExists) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }

    // Snapshot current risk score if available
    const riskProfile = await prisma.riskProfile.findUnique({
      where: { propertyId: body.propertyId },
      select: { overallRiskScore: true },
    })

    const alert = await prisma.riskAlert.upsert({
      where: { userId_propertyId: { userId, propertyId: body.propertyId } },
      create: {
        userId,
        propertyId: body.propertyId,
        frequency: body.frequency,
        riskTypes: body.riskTypes,
        lastRiskScore: riskProfile?.overallRiskScore ?? null,
      },
      update: {
        enabled: true,
        frequency: body.frequency,
        riskTypes: body.riskTypes,
      },
    })

    res.status(201).json({ success: true, data: alert })
  } catch (err) {
    next(err)
  }
})

// Update alert settings
riskAlertsRouter.patch('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const id = String(req.params.id)
    const body = updateAlertSchema.parse(req.body)

    const existing = await prisma.riskAlert.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      })
      return
    }

    const alert = await prisma.riskAlert.update({
      where: { id },
      data: body,
    })

    res.json({ success: true, data: alert })
  } catch (err) {
    next(err)
  }
})

// Delete an alert
riskAlertsRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const id = String(req.params.id)

    const existing = await prisma.riskAlert.findFirst({
      where: { id, userId },
    })
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Alert not found' },
      })
      return
    }

    await prisma.riskAlert.delete({ where: { id } })
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
