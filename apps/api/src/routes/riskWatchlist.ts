import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const riskWatchlistRouter = Router()
riskWatchlistRouter.use(requireAuth)

// ─── List watchlist entries ──────────────────────────────────────────────────

riskWatchlistRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const entries = await prisma.riskWatchlist.findMany({
      where: { userId },
      include: {
        property: true,
        changeEvents: {
          orderBy: { detectedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { addedAt: 'desc' },
      take: 100,
    })
    res.json({ success: true, data: entries })
  } catch (err) {
    next(err)
  }
})

// ─── Add property to watchlist ───────────────────────────────────────────────

const addSchema = z.object({
  propertyId: z.string().min(1),
})

riskWatchlistRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { propertyId } = addSchema.parse(req.body)

    // Get current risk profile to store as baseline
    const riskProfile = await prisma.riskProfile.findUnique({
      where: { propertyId },
    })

    const entry = await prisma.riskWatchlist.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      update: {
        lastKnownOverallScore: riskProfile?.overallRiskScore ?? null,
        lastKnownFloodScore: riskProfile?.floodRiskScore ?? null,
        lastKnownFireScore: riskProfile?.fireRiskScore ?? null,
        lastKnownWindScore: riskProfile?.windRiskScore ?? null,
        lastKnownEarthquakeScore: riskProfile?.earthquakeRiskScore ?? null,
        lastKnownCrimeScore: riskProfile?.crimeRiskScore ?? null,
        lastCheckedAt: new Date(),
      },
      create: {
        userId,
        propertyId,
        lastKnownOverallScore: riskProfile?.overallRiskScore ?? null,
        lastKnownFloodScore: riskProfile?.floodRiskScore ?? null,
        lastKnownFireScore: riskProfile?.fireRiskScore ?? null,
        lastKnownWindScore: riskProfile?.windRiskScore ?? null,
        lastKnownEarthquakeScore: riskProfile?.earthquakeRiskScore ?? null,
        lastKnownCrimeScore: riskProfile?.crimeRiskScore ?? null,
        lastCheckedAt: riskProfile ? new Date() : null,
      },
      include: { property: true },
    })

    res.status(201).json({ success: true, data: entry })
  } catch (err) {
    next(err)
  }
})

// ─── Check for risk changes on a watchlist entry ─────────────────────────────

riskWatchlistRouter.post('/:id/check', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const watchlistId = String(req.params.id)

    const entry = await prisma.riskWatchlist.findFirst({
      where: { id: watchlistId, userId },
    })
    if (!entry) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Watchlist entry not found' } })
      return
    }

    const riskProfile = await prisma.riskProfile.findUnique({
      where: { propertyId: entry.propertyId },
    })

    if (!riskProfile) {
      res.json({ success: true, data: { changes: [], message: 'No risk profile available yet' } })
      return
    }

    // Detect changes
    const dimensions = [
      { name: 'overall', prev: entry.lastKnownOverallScore, curr: riskProfile.overallRiskScore, level: riskProfile.overallRiskLevel },
      { name: 'flood', prev: entry.lastKnownFloodScore, curr: riskProfile.floodRiskScore, level: riskProfile.floodRiskLevel },
      { name: 'fire', prev: entry.lastKnownFireScore, curr: riskProfile.fireRiskScore, level: riskProfile.fireRiskLevel },
      { name: 'wind', prev: entry.lastKnownWindScore, curr: riskProfile.windRiskScore, level: riskProfile.windRiskLevel },
      { name: 'earthquake', prev: entry.lastKnownEarthquakeScore, curr: riskProfile.earthquakeRiskScore, level: riskProfile.earthquakeRiskLevel },
      { name: 'crime', prev: entry.lastKnownCrimeScore, curr: riskProfile.crimeRiskScore, level: riskProfile.crimeRiskLevel },
    ] as const

    function getRiskLevel(score: number): 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'EXTREME' {
      if (score <= 25) return 'LOW'
      if (score <= 50) return 'MODERATE'
      if (score <= 70) return 'HIGH'
      if (score <= 85) return 'VERY_HIGH'
      return 'EXTREME'
    }

    const changes: Array<{ riskDimension: string; previousScore: number; newScore: number; previousLevel: string; newLevel: string }> = []

    for (const dim of dimensions) {
      if (dim.prev !== null && dim.prev !== dim.curr) {
        changes.push({
          riskDimension: dim.name,
          previousScore: dim.prev,
          newScore: dim.curr,
          previousLevel: getRiskLevel(dim.prev),
          newLevel: dim.level as string,
        })
      }
    }

    // Store change events and update baseline
    if (changes.length > 0) {
      await prisma.$transaction([
        ...changes.map((c) =>
          prisma.riskChangeEvent.create({
            data: {
              watchlistId,
              propertyId: entry.propertyId,
              userId,
              riskDimension: c.riskDimension,
              previousScore: c.previousScore,
              newScore: c.newScore,
              previousLevel: c.previousLevel as never,
              newLevel: c.newLevel as never,
            },
          })
        ),
        prisma.riskWatchlist.update({
          where: { id: watchlistId },
          data: {
            lastKnownOverallScore: riskProfile.overallRiskScore,
            lastKnownFloodScore: riskProfile.floodRiskScore,
            lastKnownFireScore: riskProfile.fireRiskScore,
            lastKnownWindScore: riskProfile.windRiskScore,
            lastKnownEarthquakeScore: riskProfile.earthquakeRiskScore,
            lastKnownCrimeScore: riskProfile.crimeRiskScore,
            lastCheckedAt: new Date(),
          },
        }),
      ])
    } else {
      await prisma.riskWatchlist.update({
        where: { id: watchlistId },
        data: { lastCheckedAt: new Date() },
      })
    }

    res.json({ success: true, data: { changes } })
  } catch (err) {
    next(err)
  }
})

// ─── Get change events for user ──────────────────────────────────────────────

riskWatchlistRouter.get('/changes', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const events = await prisma.riskChangeEvent.findMany({
      where: { userId },
      include: { property: true },
      orderBy: { detectedAt: 'desc' },
      take: 50,
    })
    res.json({ success: true, data: events })
  } catch (err) {
    next(err)
  }
})

// ─── Remove from watchlist ───────────────────────────────────────────────────

riskWatchlistRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    await prisma.riskWatchlist.deleteMany({
      where: { id: String(req.params.id), userId },
    })
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
