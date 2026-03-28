/**
 * Properties router tests — apps/api/src/routes/properties.ts
 *
 * Covers:
 *  - Property ID param validation (undefined, null)
 *  - GET /suggest (valid query, too-short query)
 *  - GET /search (zip search, missing params, invalid state)
 *  - POST /geocode (valid placeId, geocoding failure)
 *  - GET /:id (property detail, 404)
 *  - GET /:id/risk (risk profile, force refresh cache invalidation)
 *  - GET /:id/insurance (insurance estimate)
 *  - GET /:id/report (full bundle, 404)
 *  - POST /:id/save (auth required, save, 404, 401)
 *  - DELETE /:id/save (unsave, 404)
 *  - POST /:id/quote-request (create, validation error)
 *  - GET /:id/quote-requests (list)
 *  - Cache-Control header expectations
 */

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('../../utils/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { getUser: jest.fn() } },
}))

jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    tokenCache: new LRUCache(100, 60_000),
    propertyCache: new LRUCache(100, 60_000),
    riskCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
    insuranceDeduplicator: new RequestDeduplicator(),
    carriersDeduplicator: new RequestDeduplicator(),
  }
})

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: { stripeSubscriptionRequired: false },
}))

jest.mock('../../services/stripeService', () => ({
  hasActiveSubscription: jest.fn().mockResolvedValue(true),
}))

jest.mock('../../services/propertyService', () => ({
  searchProperties: jest.fn(),
  suggestProperties: jest.fn(),
  getPropertyById: jest.fn(),
  geocodeAndCreateProperty: jest.fn(),
}))

jest.mock('../../services/riskService', () => ({
  getOrComputeRiskProfile: jest.fn(),
}))

jest.mock('../../services/insuranceService', () => ({
  getOrComputeInsuranceEstimate: jest.fn(),
}))

jest.mock('../../services/carriersService', () => ({
  getCarriersForProperty: jest.fn(),
}))

jest.mock('../../services/insurabilityService', () => ({
  getInsurabilityStatus: jest.fn(),
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    property: { findUnique: jest.fn() },
    savedProperty: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    quoteRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    propertyChecklist: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    client: { findFirst: jest.fn() },
  },
}))

import express from 'express'
import request from 'supertest'
import { propertiesRouter } from '../../routes/properties'
import { errorHandler } from '../../middleware/errorHandler'
import { prisma } from '../../utils/prisma'
import { supabaseAdmin } from '../../utils/supabaseAdmin'
import { searchProperties, suggestProperties, getPropertyById, geocodeAndCreateProperty } from '../../services/propertyService'
import { getOrComputeRiskProfile } from '../../services/riskService'
import { getOrComputeInsuranceEstimate } from '../../services/insuranceService'
import { getCarriersForProperty } from '../../services/carriersService'
import { getInsurabilityStatus } from '../../services/insurabilityService'
import { insuranceCache, carriersCache, insurabilityCache } from '../../utils/cache'

const app = express()
app.use(express.json())
app.use('/api/properties', propertiesRouter)
app.use(errorHandler)

// Fake JWT with sub=user-1, exp far in the future
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjk5OTk5OTk5OTl9.sig'

/**
 * Mock Supabase auth.getUser AND prisma.user.findUnique so the requireAuth
 * middleware succeeds and populates req.userId / req.userRole.
 */
function mockAuth(userId = 'user-1') {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId, role: 'authenticated' } },
    error: null,
  })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: userId,
    role: 'AGENT',
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── Property ID validation ──────────────────────────────────────────────────

describe('Property ID param validation', () => {
  it('returns 400 for "undefined" property ID', async () => {
    const res = await request(app).get('/api/properties/undefined')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('BAD_REQUEST')
    expect(res.body.error.message).toMatch(/valid property ID/i)
  })

  it('returns 400 for "null" property ID', async () => {
    const res = await request(app).get('/api/properties/null')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })
})

// ─── GET /suggest ────────────────────────────────────────────────────────────

describe('GET /api/properties/suggest', () => {
  it('returns suggestions for a valid query', async () => {
    const mockSuggestions = [
      { placeId: 'place-1', description: '123 Main St, Springfield, IL' },
      { placeId: 'place-2', description: '124 Main St, Springfield, IL' },
    ]
    ;(suggestProperties as jest.Mock).mockResolvedValue(mockSuggestions)

    const res = await request(app).get('/api/properties/suggest').query({ q: 'Main St' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockSuggestions)
    expect(suggestProperties).toHaveBeenCalledWith('Main St', 5)
    // CDN cache header: 5 min
    expect(res.headers['cache-control']).toMatch(/s-maxage=300/)
  })

  it('returns validation error for query shorter than 2 chars', async () => {
    const res = await request(app).get('/api/properties/suggest').query({ q: 'M' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── GET /search ─────────────────────────────────────────────────────────────

describe('GET /api/properties/search', () => {
  it('returns search results for a zip code query', async () => {
    const mockResult = {
      properties: [{ id: 'prop-1', address: '123 Main St' }],
      total: 1,
      page: 1,
      limit: 20,
    }
    ;(searchProperties as jest.Mock).mockResolvedValue(mockResult)

    const res = await request(app).get('/api/properties/search').query({ zip: '60601' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockResult)
    expect(searchProperties).toHaveBeenCalledWith(
      expect.objectContaining({ zip: '60601', page: 1, limit: 20 }),
      undefined,
    )
    // CDN cache header: 60 s
    expect(res.headers['cache-control']).toMatch(/s-maxage=60/)
  })

  it('returns 400 when no search params are provided', async () => {
    const res = await request(app).get('/api/properties/search')

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('MISSING_PARAM')
    expect(res.body.error.message).toMatch(/address.*zip.*city.*placeId.*parcelId/i)
  })

  it('returns validation error for invalid state code', async () => {
    const res = await request(app)
      .get('/api/properties/search')
      .query({ address: '123 Main', state: 'XYZ' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── POST /geocode ───────────────────────────────────────────────────────────

describe('POST /api/properties/geocode', () => {
  it('returns property for a valid placeId', async () => {
    const mockProperty = { id: 'prop-1', address: '123 Main St', city: 'Chicago', state: 'IL' }
    ;(geocodeAndCreateProperty as jest.Mock).mockResolvedValue(mockProperty)

    const res = await request(app)
      .post('/api/properties/geocode')
      .send({ placeId: 'ChIJd18hjX-uEmsRUoOB3g' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockProperty)
    expect(geocodeAndCreateProperty).toHaveBeenCalledWith('ChIJd18hjX-uEmsRUoOB3g', undefined)
  })

  it('returns 422 when geocoding fails', async () => {
    ;(geocodeAndCreateProperty as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/properties/geocode')
      .send({ placeId: 'invalid-place-id' })

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('GEOCODE_FAILED')
  })
})

// ─── GET /:id ────────────────────────────────────────────────────────────────

describe('GET /api/properties/:id', () => {
  it('returns property detail', async () => {
    const mockProperty = { id: 'prop-1', address: '123 Main St', city: 'Chicago', state: 'IL' }
    ;(getPropertyById as jest.Mock).mockResolvedValue(mockProperty)

    const res = await request(app).get('/api/properties/prop-1')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockProperty)
    expect(getPropertyById).toHaveBeenCalledWith('prop-1')
    // CDN cache: 30 min
    expect(res.headers['cache-control']).toMatch(/s-maxage=1800/)
  })

  it('returns 404 when property is not found', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(null)

    const res = await request(app).get('/api/properties/nonexistent')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

// ─── GET /:id/risk ───────────────────────────────────────────────────────────

describe('GET /api/properties/:id/risk', () => {
  const mockRisk = {
    propertyId: 'prop-1',
    overallScore: 65,
    flood: { score: 70 },
    fire: { score: 40 },
  }

  it('returns risk profile', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRisk)

    const res = await request(app).get('/api/properties/prop-1/risk')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockRisk)
    expect(getOrComputeRiskProfile).toHaveBeenCalledWith('prop-1', false)
    // CDN cache: 2 hours
    expect(res.headers['cache-control']).toMatch(/s-maxage=7200/)
  })

  it('force refresh invalidates dependent caches and sets no-cache headers', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRisk)

    // Seed dependent caches so we can verify they get invalidated
    insuranceCache.set('prop-1', { totalAnnualPremium: 5000 } as any)
    carriersCache.set('prop-1', { carriers: [] } as any)
    insurabilityCache.set('prop-1', { status: 'STANDARD' } as any)

    const res = await request(app).get('/api/properties/prop-1/risk').query({ refresh: 'true' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(getOrComputeRiskProfile).toHaveBeenCalledWith('prop-1', true)

    // Dependent caches should be invalidated
    expect(insuranceCache.get('prop-1')).toBeUndefined()
    expect(carriersCache.get('prop-1')).toBeUndefined()
    expect(insurabilityCache.get('prop-1')).toBeUndefined()

    // No-cache headers
    expect(res.headers['cache-control']).toMatch(/no-cache/)
    expect(res.headers['cache-control']).toMatch(/no-store/)
  })
})

// ─── GET /:id/insurance ──────────────────────────────────────────────────────

describe('GET /api/properties/:id/insurance', () => {
  it('returns insurance estimate', async () => {
    const mockRisk = { propertyId: 'prop-1', overallScore: 65 }
    const mockEstimate = { propertyId: 'prop-1', totalAnnualPremium: 4500, breakdown: {} }

    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRisk)
    ;(getOrComputeInsuranceEstimate as jest.Mock).mockResolvedValue(mockEstimate)

    const res = await request(app).get('/api/properties/prop-1/insurance')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockEstimate)
    // Risk profile is computed first
    expect(getOrComputeRiskProfile).toHaveBeenCalledWith('prop-1', false)
    expect(getOrComputeInsuranceEstimate).toHaveBeenCalledWith('prop-1', false)
    // CDN cache: 2 hours
    expect(res.headers['cache-control']).toMatch(/s-maxage=7200/)
  })
})

// ─── GET /:id/report ─────────────────────────────────────────────────────────

describe('GET /api/properties/:id/report', () => {
  const mockProperty = { id: 'prop-1', address: '123 Main St' }
  const mockRisk = { propertyId: 'prop-1', overallScore: 65 }
  const mockInsurance = { propertyId: 'prop-1', totalAnnualPremium: 4500 }
  const mockInsurability = { propertyId: 'prop-1', status: 'STANDARD' }
  const mockCarriers = { propertyId: 'prop-1', carriers: [{ name: 'ACME Insurance' }] }

  it('returns full report bundle', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(mockProperty)
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRisk)
    ;(getOrComputeInsuranceEstimate as jest.Mock).mockResolvedValue(mockInsurance)
    ;(getInsurabilityStatus as jest.Mock).mockResolvedValue(mockInsurability)
    ;(getCarriersForProperty as jest.Mock).mockResolvedValue(mockCarriers)

    const res = await request(app).get('/api/properties/prop-1/report')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual({
      property: mockProperty,
      risk: mockRisk,
      insurance: mockInsurance,
      insurability: mockInsurability,
      carriers: mockCarriers,
    })
    // CDN cache: 1 hour
    expect(res.headers['cache-control']).toMatch(/s-maxage=3600/)
  })

  it('returns 404 when property not found', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(null)

    const res = await request(app).get('/api/properties/nonexistent/report')

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

// ─── POST /:id/save (auth required) ─────────────────────────────────────────

describe('POST /api/properties/:id/save', () => {
  it('saves property for authenticated user and returns 201', async () => {
    mockAuth()
    const savedRecord = {
      id: 'sp-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      notes: 'Great yard',
      tags: ['favorite'],
    }
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop-1' })
    ;(prisma.savedProperty.findUnique as jest.Mock).mockResolvedValue(null) // not previously saved
    ;(prisma.savedProperty.upsert as jest.Mock).mockResolvedValue(savedRecord)

    const res = await request(app)
      .post('/api/properties/prop-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ notes: 'Great yard', tags: ['favorite'] })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(savedRecord)
    expect(prisma.savedProperty.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_propertyId: { userId: 'user-1', propertyId: 'prop-1' } },
      }),
    )
  })

  it('returns 404 when property does not exist', async () => {
    mockAuth()
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/properties/prop-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ tags: [] })

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/properties/prop-1/save')
      .send({ tags: [] })

    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })
})

// ─── DELETE /:id/save (auth required) ────────────────────────────────────────

describe('DELETE /api/properties/:id/save', () => {
  it('unsaves property for authenticated user', async () => {
    mockAuth()
    ;(prisma.savedProperty.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await request(app)
      .delete('/api/properties/prop-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeNull()
    expect(prisma.savedProperty.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', propertyId: 'prop-1' },
    })
  })

  it('returns 404 when saved property not found', async () => {
    mockAuth()
    ;(prisma.savedProperty.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await request(app)
      .delete('/api/properties/prop-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

// ─── POST /:id/quote-request (auth required) ────────────────────────────────

describe('POST /api/properties/:id/quote-request', () => {
  it('creates a quote request and returns 201', async () => {
    mockAuth()
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop-1' })
    ;(prisma.quoteRequest.create as jest.Mock).mockResolvedValue({
      id: 'qr-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      carrierId: 'carrier-1',
      coverageTypes: ['HOMEOWNERS', 'FLOOD'],
      notes: null,
    })

    const res = await request(app)
      .post('/api/properties/prop-1/quote-request')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        carrierId: 'carrier-1',
        coverageTypes: ['HOMEOWNERS', 'FLOOD'],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.quoteRequestId).toBe('qr-1')
    expect(prisma.quoteRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        propertyId: 'prop-1',
        carrierId: 'carrier-1',
        coverageTypes: ['HOMEOWNERS', 'FLOOD'],
        notes: null,
      }),
    })
  })

  it('returns validation error for empty coverageTypes', async () => {
    mockAuth()

    const res = await request(app)
      .post('/api/properties/prop-1/quote-request')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        carrierId: 'carrier-1',
        coverageTypes: [],
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── GET /:id/quote-requests (auth required) ────────────────────────────────

describe('GET /api/properties/:id/quote-requests', () => {
  it('returns quote requests for the authenticated user', async () => {
    mockAuth()
    const mockRequests = [
      {
        id: 'qr-1',
        userId: 'user-1',
        propertyId: 'prop-1',
        carrierId: 'carrier-1',
        coverageTypes: ['HOMEOWNERS'],
        status: 'PENDING',
        submittedAt: '2026-03-01T00:00:00.000Z',
      },
      {
        id: 'qr-2',
        userId: 'user-1',
        propertyId: 'prop-1',
        carrierId: 'carrier-2',
        coverageTypes: ['FLOOD'],
        status: 'PENDING',
        submittedAt: '2026-03-02T00:00:00.000Z',
      },
    ]
    ;(prisma.quoteRequest.findMany as jest.Mock).mockResolvedValue(mockRequests)

    const res = await request(app)
      .get('/api/properties/prop-1/quote-requests')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockRequests)
    expect(prisma.quoteRequest.findMany).toHaveBeenCalledWith({
      where: { propertyId: 'prop-1', userId: 'user-1' },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    })
  })
})

// ─── GET /:id/insurability ───────────────────────────────────────────────────

describe('GET /api/properties/:id/insurability', () => {
  it('returns insurability status', async () => {
    const mockRisk = { propertyId: 'prop-1', overallScore: 65 }
    const mockStatus = { propertyId: 'prop-1', status: 'STANDARD', warnings: [] }

    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRisk)
    ;(getInsurabilityStatus as jest.Mock).mockResolvedValue(mockStatus)

    const res = await request(app).get('/api/properties/prop-1/insurability')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockStatus)
    expect(getOrComputeRiskProfile).toHaveBeenCalledWith('prop-1', false)
    expect(getInsurabilityStatus).toHaveBeenCalledWith('prop-1', false)
    expect(res.headers['cache-control']).toMatch(/s-maxage=7200/)
  })
})

// ─── GET /:id/carriers ──────────────────────────────────────────────────────

describe('GET /api/properties/:id/carriers', () => {
  it('returns active carriers', async () => {
    const mockRisk = { propertyId: 'prop-1', overallScore: 65 }
    const mockCarriers = {
      propertyId: 'prop-1',
      carriers: [{ name: 'ACME Insurance', status: 'ACTIVE' }],
    }

    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRisk)
    ;(getCarriersForProperty as jest.Mock).mockResolvedValue(mockCarriers)

    const res = await request(app).get('/api/properties/prop-1/carriers')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(mockCarriers)
    expect(getOrComputeRiskProfile).toHaveBeenCalledWith('prop-1', false)
    expect(getCarriersForProperty).toHaveBeenCalledWith('prop-1', false)
    expect(res.headers['cache-control']).toMatch(/s-maxage=3600/)
  })
})

// ─── POST /:id/save returns 200 on re-save ──────────────────────────────────

describe('POST /:id/save re-save behavior', () => {
  it('returns 200 when property was already saved (update)', async () => {
    mockAuth()
    const existingRecord = { id: 'sp-1' }
    const updatedRecord = {
      id: 'sp-1',
      userId: 'user-1',
      propertyId: 'prop-1',
      notes: 'Updated notes',
      tags: [],
    }

    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop-1' })
    ;(prisma.savedProperty.findUnique as jest.Mock).mockResolvedValue(existingRecord)
    ;(prisma.savedProperty.upsert as jest.Mock).mockResolvedValue(updatedRecord)

    const res = await request(app)
      .post('/api/properties/prop-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ notes: 'Updated notes', tags: [] })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toEqual(updatedRecord)
  })
})

// ─── POST /:id/quote-request — property not found ───────────────────────────

describe('POST /:id/quote-request property not found', () => {
  it('returns 404 when property does not exist', async () => {
    mockAuth()
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/properties/prop-1/quote-request')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({
        carrierId: 'carrier-1',
        coverageTypes: ['HOMEOWNERS'],
      })

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
