import { Router } from 'express'
import { z } from 'zod'
import { searchProperties, suggestProperties, getPropertyById } from '../services/propertyService'
import { getOrComputeRiskProfile } from '../services/riskService'
import { getOrComputeInsuranceEstimate } from '../services/insuranceService'
import { getCarriersForProperty } from '../services/carriersService'
import { getInsurabilityStatus } from '../services/insurabilityService'
import { insuranceCache, carriersCache, insurabilityCache } from '../utils/cache'
import { requireAuth } from '../middleware/auth'
import { requireSubscription } from '../middleware/subscription'
import { prisma } from '../utils/prisma'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { Request, Response } from 'express'

export const propertiesRouter = Router()

// ─── Property ID param validation ────────────────────────────────────────────

propertiesRouter.param('id', (req, res, next, id) => {
  if (!id || id === 'undefined' || id === 'null' || id.length > 50) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'A valid property ID is required' },
    })
    return
  }
  next()
})

// ─── Cache-Control helper ─────────────────────────────────────────────────────

/** CDN-cacheable data — `s-maxage` is honoured by CDNs (Vercel Edge, CloudFront, etc.)
 *  but NOT by browsers (`s-maxage` is a shared-cache directive only).
 *  Add a `max-age` directive here if browser caching is also desired. */
function setCacheHeaders(res: Response, sMaxAge: number, staleWhileRevalidate = 60): void {
  res.set(
    'Cache-Control',
    `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  )
}

// ─── Search ───────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).regex(/^[A-Z]{2}$/, 'Invalid state code').optional(),
  zip: z.string().regex(/^\d{5}$/).optional(),
  parcelId: z.string().min(1).max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/** Extract the Supabase user id from a Bearer JWT without full verification.
 *  Used only for optional analytics (search history) — NOT for authorization. */
function extractOptionalUserId(req: Request): string | undefined {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  try {
    const token = header.split(' ')[1]
    if (!token) return undefined
    const payload = token.split('.')[1]
    if (!payload) return undefined
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string
    }
    return typeof decoded.sub === 'string' ? decoded.sub : undefined
  } catch {
    return undefined
  }
}

// ─── Typeahead suggestions ────────────────────────────────────────────────────

const suggestSchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

propertiesRouter.get('/suggest', async (req, res, next) => {
  try {
    const params = suggestSchema.parse(req.query)
    const suggestions = await suggestProperties(params.q, params.limit)
    setCacheHeaders(res, 300, 60) // 5 min CDN cache for suggestions
    res.json({ success: true, data: suggestions })
  } catch (err) {
    next(err)
  }
})

propertiesRouter.get('/search', async (req, res, next) => {
  try {
    const params = searchSchema.parse(req.query)
    if (!params.address && !params.zip && !params.parcelId && !params.city) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'Provide address, zip, city, or parcelId' },
      })
      return
    }
    const result = await searchProperties(params, extractOptionalUserId(req))
    // Search results: short CDN TTL (60 s) since properties can be added
    setCacheHeaders(res, 60, 30)
    res.json({ success: true, data: result })
  } catch (err) {
    next(err)
  }
})

// ─── Property detail ──────────────────────────────────────────────────────────

propertiesRouter.get('/:id', async (req, res, next) => {
  try {
    const property = await getPropertyById(req.params.id)
    if (!property) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }
    // Property data: 30 min CDN cache
    setCacheHeaders(res, 1800, 300)
    res.json({ success: true, data: property })
  } catch (err) {
    next(err)
  }
})

// ─── Risk profile ─────────────────────────────────────────────────────────────

propertiesRouter.get('/:id/risk', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    const profile = await getOrComputeRiskProfile(req.params.id, forceRefresh)
    // When risk is refreshed, invalidate dependent caches so they recompute with new scores
    if (forceRefresh) {
      try {
        insuranceCache.delete(req.params.id)
        carriersCache.delete(req.params.id)
        insurabilityCache.delete(req.params.id)
      } catch { /* cache invalidation is best-effort */ }
    } else {
      setCacheHeaders(res, 7200, 600)
    }
    res.json({ success: true, data: profile })
  } catch (err) {
    next(err)
  }
})

// ─── Insurance estimate ───────────────────────────────────────────────────────

propertiesRouter.get('/:id/insurance', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    // Ensure risk profile exists and is fresh (insurance depends on risk scores)
    await getOrComputeRiskProfile(req.params.id, forceRefresh)
    const estimate = await getOrComputeInsuranceEstimate(req.params.id, forceRefresh)
    if (!forceRefresh) setCacheHeaders(res, 7200, 600)
    res.json({ success: true, data: estimate })
  } catch (err) {
    next(err)
  }
})

// ─── Full report ──────────────────────────────────────────────────────────────

propertiesRouter.get('/:id/report', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    const property = await getPropertyById(req.params.id)
    if (!property) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }
    // Risk must be computed first since insurance depends on it
    const risk = await getOrComputeRiskProfile(req.params.id, forceRefresh)
    const [insurance, insurability, carriers] = await Promise.all([
      getOrComputeInsuranceEstimate(req.params.id, forceRefresh),
      getInsurabilityStatus(req.params.id, forceRefresh),
      getCarriersForProperty(req.params.id, forceRefresh),
    ])
    if (!forceRefresh) setCacheHeaders(res, 3600, 300)
    res.json({ success: true, data: { property, risk, insurance, insurability, carriers } })
  } catch (err) {
    next(err)
  }
})

// ─── Save property (authenticated) ───────────────────────────────────────────

const saveSchema = z.object({
  notes: z.string().max(500).transform((s) => s.trim()).optional(),
  tags: z.array(z.string()).max(10).default([]),
})

propertiesRouter.post('/:id/save', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = saveSchema.parse(req.body)
    const propertyId = String(req.params.id)

    const saved = await prisma.savedProperty.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      update: { notes: body.notes, tags: body.tags },
      create: { userId, propertyId, notes: body.notes, tags: body.tags },
    })
    res.json({ success: true, data: saved })
  } catch (err) {
    next(err)
  }
})

propertiesRouter.delete('/:id/save', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const result = await prisma.savedProperty.deleteMany({
      where: { userId, propertyId: String(req.params.id) },
    })
    if (result.count === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Saved property not found' } })
      return
    }
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})

// ─── Insurability status ──────────────────────────────────────────────────────

propertiesRouter.get('/:id/insurability', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    // Ensure risk profile exists and is fresh (insurability depends on risk scores)
    await getOrComputeRiskProfile(req.params.id, forceRefresh)
    const status = await getInsurabilityStatus(req.params.id, forceRefresh)
    if (!forceRefresh) setCacheHeaders(res, 7200, 600)
    res.json({ success: true, data: status })
  } catch (err) {
    next(err)
  }
})

// ─── Active carriers ──────────────────────────────────────────────────────────

propertiesRouter.get('/:id/carriers', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    // Ensure risk profile exists and is fresh (carrier decisions depend on risk scores)
    await getOrComputeRiskProfile(req.params.id, forceRefresh)
    const carriers = await getCarriersForProperty(req.params.id, forceRefresh)
    if (!forceRefresh) setCacheHeaders(res, 3600, 300)
    res.json({ success: true, data: carriers })
  } catch (err) {
    next(err)
  }
})

// ─── Quote requests ───────────────────────────────────────────────────────────

const quoteRequestSchema = z.object({
  carrierId: z.string().min(1),
  coverageTypes: z.array(
    z.enum(['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'WIND_HURRICANE', 'UMBRELLA', 'FIRE']),
  ).min(1).max(6),
  notes: z.string().max(1000).optional(),
})

propertiesRouter.post('/:id/quote-request', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = quoteRequestSchema.parse(req.body)

    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        userId,
        propertyId: String(req.params.id),
        carrierId: body.carrierId,
        coverageTypes: body.coverageTypes,
        notes: body.notes ?? null,
      },
    })

    res.status(201).json({ success: true, data: { quoteRequestId: quoteRequest.id } })
  } catch (err) {
    next(err)
  }
})

propertiesRouter.get('/:id/quote-requests', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const requests = await prisma.quoteRequest.findMany({
      where: { propertyId: String(req.params.id), userId },
      orderBy: { submittedAt: 'desc' },
      take: 50, // Limit result set; don't return unbounded rows
    })
    res.json({ success: true, data: requests })
  } catch (err) {
    next(err)
  }
})
