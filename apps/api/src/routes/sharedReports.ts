import { Router } from 'express'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const sharedReportsRouter = Router()

function generateShareToken(): string {
  return randomBytes(24).toString('base64url')
}

const createShareSchema = z.object({
  propertyId: z.string().uuid(),
  clientId: z.string().uuid().nullish(),
  recipientEmail: z.string().email().optional(),
  recipientName: z.string().max(100).optional(),
  message: z.string().max(1000).optional(),
  includeRisk: z.boolean().default(true),
  includeInsurance: z.boolean().default(true),
  includeCarriers: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(90).optional(),
})

// ─── Agent-authenticated routes ──────────────────────────────────────────────

// List shared reports for the current agent
sharedReportsRouter.get(
  '/',
  requireAuth,
  requireSubscription,
  async (req: Request, res, next) => {
    try {
      const { userId } = req as AuthenticatedRequest

      const shares = await prisma.sharedReport.findMany({
        where: { agentId: userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          property: {
            select: { id: true, address: true, city: true, state: true, zip: true },
          },
          client: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      })

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? ''
      const data = shares.map((s) => ({
        ...s,
        shareUrl: `${baseUrl}/shared/${s.shareToken}`,
      }))

      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },
)

// Create a shared report link
sharedReportsRouter.post(
  '/',
  requireAuth,
  requireSubscription,
  async (req: Request, res, next) => {
    try {
      const { userId } = req as AuthenticatedRequest
      const body = createShareSchema.parse(req.body)

      // Verify user is an agent/lender/admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
      if (!user || !['AGENT', 'LENDER', 'ADMIN'].includes(user.role)) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Only agents can share reports' },
        })
        return
      }

      // Verify property exists
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

      // Verify client belongs to this agent if provided
      if (body.clientId) {
        const clientOwned = await prisma.client.findFirst({
          where: { id: body.clientId, agentId: userId },
          select: { id: true },
        })
        if (!clientOwned) {
          res.status(404).json({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Client not found' },
          })
          return
        }
      }

      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
        : null

      const share = await prisma.sharedReport.create({
        data: {
          agentId: userId,
          propertyId: body.propertyId,
          clientId: body.clientId ?? null,
          shareToken: generateShareToken(),
          recipientEmail: body.recipientEmail ?? null,
          recipientName: body.recipientName ?? null,
          message: body.message ?? null,
          includeRisk: body.includeRisk,
          includeInsurance: body.includeInsurance,
          includeCarriers: body.includeCarriers,
          expiresAt,
        },
      })

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? ''
      res.status(201).json({
        success: true,
        data: { ...share, shareUrl: `${baseUrl}/shared/${share.shareToken}` },
      })
    } catch (err) {
      next(err)
    }
  },
)

// Delete a shared report
sharedReportsRouter.delete(
  '/:id',
  requireAuth,
  requireSubscription,
  async (req: Request, res, next) => {
    try {
      const { userId } = req as AuthenticatedRequest
      const id = String(req.params.id)

      const result = await prisma.sharedReport.deleteMany({
        where: { id, agentId: userId },
      })
      if (result.count === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Shared report not found' },
        })
        return
      }

      res.json({ success: true, data: null })
    } catch (err) {
      next(err)
    }
  },
)

// ─── Public access via share token ───────────────────────────────────────────

sharedReportsRouter.get('/view/:token', async (req: Request, res: Response, next) => {
  try {
    const token = String(req.params.token)

    const share = await prisma.sharedReport.findUnique({
      where: { shareToken: token },
      include: {
        property: true,
        agent: { select: { firstName: true, lastName: true, company: true, email: true } },
      },
    })

    if (!share) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Shared report not found or has been revoked' },
      })
      return
    }

    // Check expiration
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      res.status(410).json({
        success: false,
        error: { code: 'EXPIRED', message: 'This shared report link has expired' },
      })
      return
    }

    // Increment view count (fire and forget)
    prisma.sharedReport
      .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {})

    // Build response with only the sections the agent chose to share
    const result: Record<string, unknown> = {
      property: share.property,
      agent: share.agent,
      message: share.message,
      sections: {
        risk: share.includeRisk,
        insurance: share.includeInsurance,
        carriers: share.includeCarriers,
      },
    }

    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})
