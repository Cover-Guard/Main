import { Router } from 'express'
import { z } from 'zod'
import { searchProperties, suggestProperties, getPropertyById, geocodeAndCreateProperty, resolvePropertyId, ensurePropertyId } from '../services/propertyService'
import { getOrComputeRiskProfile } from '../services/riskService'
import { getOrComputeInsuranceEstimate } from '../services/insuranceService'
import { getCarriersForProperty } from '../services/carriersService'
import { getInsurabilityStatus } from '../services/insurabilityService'
import { getPropertyPublicData } from '../services/publicPropertyDataService'
import { generatePropertyReportPdf } from '../services/pdfReportService'
import { getOrFetchWalkScore } from '../services/walkscoreService'
import { insuranceCache, carriersCache, insurabilityCache, publicDataCache } from '../utils/cache'
import { logger } from '../utils/logger'
import { requireAuth } from '../middleware/auth'
import { requireSubscription, requireFeature } from '../middleware/subscription'
import { prisma } from '../utils/prisma'
import type { Prisma } from '../generated/prisma/client'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { Request, Response } from 'express'

export const propertiesRouter = Router()

// ─── Property ID param validation & slug resolution ─────────────────────────
propertiesRouter.param('id', async (req, res, next, id) => {
  if (!id || id === 'undefined' || id === 'null' || id.length > 200) {
    res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'A valid property ID is required' },
    })
    return
  }
  // Resolve address slugs / parcel IDs to the canonical DB id so that
  // sub-resource endpoints (risk, insurance, carriers, etc.) which use
  // findUniqueOrThrow on `id` don't 404 for slug-based URLs. If the slug
  // parses to a valid address but no row exists yet, ensurePropertyId
  // geocodes it and creates the row on-demand — this is what lets users
  // navigate directly to /api/properties/<address-slug>/report for a
  // property that's never been searched before.
  try {
    const resolved = await ensurePropertyId(id)
    if (!resolved) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }
    if (resolved !== id) {
      req.params.id = resolved
    }
  } catch (err) {
    logger.warn('ensurePropertyId failed in :id param middleware', {
      id,
      error: err instanceof Error ? err.message : err,
    })
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

/** Prevent CDN and browser from caching a force-refreshed response */
function setNoCacheHeaders(res: Response): void {
  res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate')
}

// ─── Search ───────────────────────────────────────────────────────────────────

const searchSchema = z.object({
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().length(2).regex(/^[A-Z]{2}$/, 'Invalid state code').optional(),
  zip: z.string().regex(/^\d{5}$/).optional(),
  parcelId: z.string().min(1).max(50).optional(),
  placeId: z.string().min(1).max(300).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/**
 * Extracts the Supabase user ID from a Bearer JWT WITHOUT verifying the signature.
 *
 * WARNING: NO cryptographic signature verification is performed here.
 * This is intentional — this helper is used ONLY for optional analytics
 * (search-history logging) and must NEVER be used for authorization or
 * access-control decisions.  For anything security-sensitive, verify the
 * token via the Supabase Auth client instead.
 */
function extractUnverifiedUserIdForAnalytics(req: Request): string | undefined {
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
    if (!params.address && !params.zip && !params.parcelId && !params.city && !params.placeId) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'Provide address, zip, city, placeId, or parcelId' },
      })
      return
    }
    const result = await searchProperties(params, extractUnverifiedUserIdForAnalytics(req))
    // Search results: short CDN TTL (60 s) since properties can be added
    setCacheHeaders(res, 60, 30)
    res.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof Error && err.message.includes('not configured')) {
      return res.status(503).json({ error: 'Property search service temporarily unavailable' })
    }
    next(err)
  }
})

// ─── Geocode (validate address via Google Place ID) ──────────────────────────

const geocodeSchema = z.object({
  placeId: z.string().min(1).max(300),
})

propertiesRouter.post('/geocode', async (req, res, next) => {
  try {
    const { placeId } = geocodeSchema.parse(req.body)
    const property = await geocodeAndCreateProperty(placeId, extractUnverifiedUserIdForAnalytics(req))
    if (!property) {
      res.status(422).json({
        success: false,
        error: { code: 'GEOCODE_FAILED', message: 'Could not validate this address. Please try a different address.' },
      })
      return
    }
    // No CDN caching for POST — response creates/mutates DB records
    res.json({ success: true, data: property })
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
      setNoCacheHeaders(res)
      try {
        insuranceCache.delete(req.params.id)
        carriersCache.delete(req.params.id)
        insurabilityCache.delete(req.params.id)
        publicDataCache.delete(req.params.id)
      } catch { /* cache invalidation is best-effort */ }
    } else {
      setCacheHeaders(res, 7200, 600)
    }
    res.json({ success: true, data: profile })
  } catch (err) {
    next(err)
  }
})

// ── WalkScore (walkability, transit, bike) ─────────────────────────────────

propertiesRouter.get('/:id/walkscore', async (req, res, next) => {
    try {
          const forceRefresh = req.query.refresh === 'true'
          const data = await getOrFetchWalkScore(req.params.id, forceRefresh)

          if (forceRefresh) setNoCacheHeaders(res)
          else setCacheHeaders(res, 86400, 3600) // 24h CDN cache (scores change rarely)

          res.json({ success: true, data })
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
    if (forceRefresh) setNoCacheHeaders(res)
    else setCacheHeaders(res, 7200, 600)
    res.json({ success: true, data: estimate })
  } catch (err) {
    next(err)
  }
})

// ─── Full report ──────────────────────────────────────────────────────────────

propertiesRouter.get('/:id/report', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    // Resolve slug/external IDs (e.g. RentCast address slugs) to the canonical
    // DB id before calling downstream services, which all use findUniqueOrThrow
    // on `id` and would otherwise throw for slug lookups.
    const rawId = req.params.id
    const resolvedId = await resolvePropertyId(rawId)
    if (!resolvedId) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }
    const id = resolvedId
    // Fetch property + compute risk + public data in parallel
    const [property, risk, publicData] = await Promise.all([
      getPropertyById(id),
      getOrComputeRiskProfile(id, forceRefresh),
      getPropertyPublicData(id, forceRefresh).catch((err) => {
        logger.warn('Public data fetch failed for report', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
    ])
    if (!property) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Property not found' },
      })
      return
    }
    // Insurance/insurability/carriers depend on risk — run in parallel now that risk is ready.
    // Each is individually caught so a single failure returns partial data instead of 500.
    const [insurance, insurability, carriers] = await Promise.all([
      getOrComputeInsuranceEstimate(id, forceRefresh).catch((err) => {
        logger.warn('Insurance estimate failed for report', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
      getInsurabilityStatus(id, forceRefresh).catch((err) => {
        logger.warn('Insurability status failed for report', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
      getCarriersForProperty(id, forceRefresh).catch((err) => {
        logger.warn('Carriers fetch failed for report', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
    ])
    if (forceRefresh) setNoCacheHeaders(res)
    else setCacheHeaders(res, 3600, 300)
    res.json({ success: true, data: { property, risk, insurance, insurability, carriers, publicData } })
  } catch (err) {
    next(err)
  }
})

// ─── Report PDF download ────────────────────────────────────────────────────

propertiesRouter.get('/:id/report.pdf', requireAuth, async (req, res, next) => {
  try {
    // Already resolved by the `id` param middleware (string after ensurePropertyId).
    const id = String(req.params.id)
    const [property, risk] = await Promise.all([
      getPropertyById(id),
      getOrComputeRiskProfile(id, false),
    ])
    if (!property) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } })
      return
    }
    // Insurance / insurability / carriers fail independently — we still emit
    // a PDF if one of them is unavailable, with a placeholder for the section.
    const [insurance, insurability, carriers] = await Promise.all([
      getOrComputeInsuranceEstimate(id, false).catch((err) => {
        logger.warn('PDF: insurance estimate unavailable', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
      getInsurabilityStatus(id, false).catch((err) => {
        logger.warn('PDF: insurability unavailable', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
      getCarriersForProperty(id, false).catch((err) => {
        logger.warn('PDF: carriers unavailable', { propertyId: id, error: err instanceof Error ? err.message : err })
        return null
      }),
    ])

    const pdf = await generatePropertyReportPdf({ property, risk, insurance, insurability, carriers })

    const safeAddr = property.address.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'property'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="coverguard-report-${safeAddr}.pdf"`)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.send(pdf)
  } catch (err) {
    next(err)
  }
})

// ─── Public property data (images, tax, listings, amenities) ────────────────

propertiesRouter.get('/:id/public-data', async (req, res, next) => {
  try {
    const forceRefresh = req.query.refresh === 'true'
    const publicData = await getPropertyPublicData(req.params.id, forceRefresh)
    if (forceRefresh) setNoCacheHeaders(res)
    else setCacheHeaders(res, 86400, 3600) // 24h CDN cache
    res.json({ success: true, data: publicData })
  } catch (err) {
    next(err)
  }
})

// ─── Save property (authenticated) ───────────────────────────────────────────

const saveSchema = z.object({
  notes: z.string().max(500).transform((s) => s.trim()).optional(),
  tags: z.array(z.string()).max(10).default([]),
  clientId: z.string().uuid().nullish(),
})

propertiesRouter.post('/:id/save', requireAuth, requireSubscription, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = saveSchema.parse(req.body)
    const propertyId = String(req.params.id)

    // Verify property exists + client ownership in parallel (skip existence
    // check for savedProperty — upsert handles create-or-update implicitly)
    const [propertyExists, clientOwned] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } }),
      body.clientId
        ? prisma.client.findFirst({ where: { id: body.clientId, agentId: userId }, select: { id: true } })
        : Promise.resolve(true),
    ])
    if (!propertyExists) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } })
      return
    }
    if (!clientOwned) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } })
      return
    }

    // body.clientId is string | null | undefined:
    //   string    → set the association
    //   null      → explicitly remove the association
    //   undefined → leave unchanged on update, null on create
    const clientIdUpdate = body.clientId === undefined ? undefined : body.clientId

    const saved = await prisma.savedProperty.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      update: { notes: body.notes, tags: body.tags, clientId: clientIdUpdate },
      create: { userId, propertyId, notes: body.notes, tags: body.tags, clientId: body.clientId ?? null },
      select: { id: true, userId: true, propertyId: true, clientId: true, notes: true, tags: true, savedAt: true },
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
    if (forceRefresh) setNoCacheHeaders(res)
    else setCacheHeaders(res, 7200, 600)
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
    if (forceRefresh) setNoCacheHeaders(res)
    else setCacheHeaders(res, 3600, 300)
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

propertiesRouter.post('/:id/quote-request', requireAuth, requireFeature('quote_requests'), async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = quoteRequestSchema.parse(req.body)
    const propertyId = String(req.params.id)

    // Create directly — the FK constraint on propertyId will reject invalid IDs
    // with a P2003 error, which the error handler maps to 400. This saves a
    // separate findUnique round trip (~5-20ms).
    const quoteRequest = await prisma.quoteRequest.create({
      data: {
        userId,
        propertyId,
        carrierId: body.carrierId,
        coverageTypes: body.coverageTypes,
        notes: body.notes ?? null,
      },
      select: { id: true },
    })

    res.status(201).json({ success: true, data: { quoteRequestId: quoteRequest.id } })
  } catch (err) {
    next(err)
  }
})

propertiesRouter.get('/:id/quote-requests', requireAuth, requireFeature('quote_requests'), async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const requests = await prisma.quoteRequest.findMany({
      where: { propertyId: String(req.params.id), userId },
      orderBy: { submittedAt: 'desc' },
      take: 50,
      select: { id: true, carrierId: true, coverageTypes: true, status: true, notes: true, submittedAt: true },
    })
    res.json({ success: true, data: requests })
  } catch (err) {
    next(err)
  }
})

// ─── Property Checklists ─────────────────────────────────────────────────────

const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(500),
  checked: z.boolean(),
})

const checklistTypeEnum = z.enum(['INSPECTION', 'NEW_BUYER', 'AGENT'])

const createChecklistSchema = z.object({
  checklistType: checklistTypeEnum,
  title: z.string().min(1).max(200),
  items: z.array(checklistItemSchema).max(100),
})

const updateChecklistSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  items: z.array(checklistItemSchema).max(100).optional(),
})

// Get all checklists for a property (for current user)
propertiesRouter.get('/:id/checklists', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const checklists = await prisma.propertyChecklist.findMany({
      where: { propertyId: String(req.params.id), userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, checklistType: true, title: true, items: true,
        createdAt: true, updatedAt: true, propertyId: true,
      },
    })
    res.json({ success: true, data: checklists })
  } catch (err) {
    next(err)
  }
})

// Create or replace a checklist for a property
propertiesRouter.post('/:id/checklists', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const propertyId = String(req.params.id)
    const body = createChecklistSchema.parse(req.body)

    // FK constraint on propertyId handles invalid IDs (saves 1 DB round trip)
    const checklist = await prisma.propertyChecklist.upsert({
      where: {
        userId_propertyId_checklistType: {
          userId,
          propertyId,
          checklistType: body.checklistType,
        },
      },
      create: {
        userId,
        propertyId,
        checklistType: body.checklistType,
        title: body.title,
        items: body.items as unknown as Prisma.InputJsonValue,
      },
      update: {
        title: body.title,
        items: body.items as unknown as Prisma.InputJsonValue,
      },
    })

    res.status(201).json({ success: true, data: checklist })
  } catch (err) {
    next(err)
  }
})

// Update a checklist (title and/or items)
propertiesRouter.patch('/:id/checklists/:checklistId', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const checklistId = String(req.params.checklistId)
    const body = updateChecklistSchema.parse(req.body)

    // Atomically verify ownership + update + return in one transaction
    const checklist = await prisma.$transaction(async (tx) => {
      const result = await tx.propertyChecklist.updateMany({
        where: { id: checklistId, userId },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.items !== undefined ? { items: body.items as unknown as Prisma.InputJsonValue } : {}),
        },
      })
      if (result.count === 0) return null
      return tx.propertyChecklist.findFirst({
        where: { id: checklistId, userId },
        select: {
          id: true, checklistType: true, title: true, items: true,
          createdAt: true, updatedAt: true, propertyId: true,
        },
      })
    })
    if (!checklist) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Checklist not found' },
      })
      return
    }

    res.json({ success: true, data: checklist })
  } catch (err) {
    next(err)
  }
})

// Delete a checklist
propertiesRouter.delete('/:id/checklists/:checklistId', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const checklistId = String(req.params.checklistId)
    // Combine auth check + delete in one query (2 queries → 1)
    const result = await prisma.propertyChecklist.deleteMany({
      where: { id: checklistId, userId },
    })
    if (result.count === 0) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Checklist not found' },
      })
      return
    }
    res.json({ success: true, data: null })
  } catch (err) {
    next(err)
  }
})
