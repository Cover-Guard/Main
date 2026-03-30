import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import { prisma } from '../utils/prisma'
import { getPropertyById } from '../services/propertyService'
import { getOrComputeRiskProfile } from '../services/riskService'
import { getOrComputeInsuranceEstimate } from '../services/insuranceService'
import { getCarriersForProperty } from '../services/carriersService'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { Request } from 'express'

export const sharingRouter = Router()

// ─── Create shared link (agent only) ────────────────────────────────────────

const createLinkSchema = z.object({
  propertyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  includeRisk: z.boolean().default(true),
  includeInsurance: z.boolean().default(true),
  includeCarriers: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(90).default(30),
  maxViews: z.number().int().positive().optional(),
})

sharingRouter.post('/links', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId, userRole } = req as AuthenticatedRequest

    if (userRole !== 'AGENT' && userRole !== 'LENDER' && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only agents can create shared property links' },
      })
      return
    }

    const body = createLinkSchema.parse(req.body)

    // Verify property exists + client ownership in parallel
    const [propertyExists, clientOwned] = await Promise.all([
      prisma.property.findUnique({ where: { id: body.propertyId }, select: { id: true } }),
      body.clientId
        ? prisma.client.findFirst({ where: { id: body.clientId, agentId: userId }, select: { id: true } })
        : Promise.resolve(true),
    ])

    if (!propertyExists) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }

    if (!clientOwned) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Client not found' },
      })
      return
    }

    // Generate a long unique token (two UUIDs concatenated, no dashes)
    const accessToken = (randomUUID() + randomUUID()).replace(/-/g, '')

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + body.expiresInDays)

    const link = await prisma.sharedPropertyLink.create({
      data: {
        agentId: userId,
        propertyId: body.propertyId,
        clientId: body.clientId ?? null,
        accessToken,
        includeRisk: body.includeRisk,
        includeInsurance: body.includeInsurance,
        includeCarriers: body.includeCarriers,
        expiresAt,
        maxViews: body.maxViews ?? null,
      },
      include: {
        property: {
          select: { address: true, city: true, state: true, zip: true },
        },
      },
    })

    // Build the public share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.CORS_ALLOWED_ORIGINS?.split(',')[0] ?? 'http://localhost:3000'
    const shareUrl = `${baseUrl}/shared/${accessToken}`

    res.status(201).json({ success: true, data: { ...link, shareUrl } })
  } catch (err) {
    next(err)
  }
})

// ─── List agent's shared links ──────────────────────────────────────────────

sharingRouter.get('/links', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    const links = await prisma.sharedPropertyLink.findMany({
      where: { agentId: userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        property: {
          select: { address: true, city: true, state: true, zip: true },
        },
      },
    })

    res.json({ success: true, data: links })
  } catch (err) {
    next(err)
  }
})

// ─── Deactivate shared link ─────────────────────────────────────────────────

sharingRouter.delete('/links/:id', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const linkId = String(req.params.id)

    const result = await prisma.sharedPropertyLink.updateMany({
      where: { id: linkId, agentId: userId },
      data: { isActive: false },
    })

    if (result.count === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shared link not found' },
      })
      return
    }

    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

// ─── View shared property (public, no auth required) ────────────────────────

sharingRouter.get('/view/:token', async (req: Request, res, next) => {
  try {
    const token = String(req.params.token)

    const link = await prisma.sharedPropertyLink.findUnique({
      where: { accessToken: token },
      include: {
        agent: {
          select: { firstName: true, lastName: true, company: true },
        },
      },
    })

    if (!link) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shared link not found' },
      })
      return
    }

    if (!link.isActive) {
      res.status(410).json({
        success: false,
        error: { code: 'LINK_INACTIVE', message: 'This shared link has been deactivated' },
      })
      return
    }

    if (link.expiresAt < new Date()) {
      res.status(410).json({
        success: false,
        error: { code: 'LINK_EXPIRED', message: 'This shared link has expired' },
      })
      return
    }

    if (link.maxViews != null && link.viewCount >= link.maxViews) {
      res.status(410).json({
        success: false,
        error: { code: 'MAX_VIEWS_REACHED', message: 'This shared link has reached its maximum number of views' },
      })
      return
    }

    // Increment view count (fire-and-forget)
    prisma.sharedPropertyLink
      .update({ where: { id: link.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {})

    // Fetch property data
    const property = await getPropertyById(link.propertyId)
    if (!property) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }

    // Fetch optional data in parallel based on link settings
    const [risk, insurance, carriers] = await Promise.all([
      link.includeRisk ? getOrComputeRiskProfile(link.propertyId) : Promise.resolve(undefined),
      link.includeInsurance ? getOrComputeInsuranceEstimate(link.propertyId) : Promise.resolve(undefined),
      link.includeCarriers ? getCarriersForProperty(link.propertyId) : Promise.resolve(undefined),
    ])

    res.json({
      success: true,
      data: {
        property,
        ...(risk ? { risk } : {}),
        ...(insurance ? { insurance } : {}),
        ...(carriers ? { carriers } : {}),
        sharedBy: {
          firstName: link.agent.firstName,
          lastName: link.agent.lastName,
          company: link.agent.company,
        },
      },
    })
  } catch (err) {
    next(err)
  }
})
