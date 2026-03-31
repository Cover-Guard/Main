/**
 * Properties router tests
 *
 * Covers:
 *  - Property ID param validation (rejects 'undefined', 'null', >50 chars)
 *  - GET /suggest — typeahead suggestions
 *  - GET /search — property search by address/zip
 *  - POST /geocode — geocode via Google Place ID
 *  - GET /:id — property detail
 *  - GET /:id/risk — risk profile with force refresh
 *  - GET /:id/insurance — insurance estimate
 *  - GET /:id/report — full report bundle
 *  - GET /:id/public-data — public property data
 *  - POST /:id/save — save property (auth + subscription required)
 *  - DELETE /:id/save — unsave property (auth + subscription required)
 *  - GET /:id/insurability — insurability status
 *  - GET /:id/carriers — active carriers
 *  - POST /:id/quote-request — create binding quote request
 *  - GET /:id/quote-requests — list quote requests
 *  - GET /:id/checklists — list checklists
 *  - POST /:id/checklists — create/replace checklist
 *  - PATCH /:id/checklists/:checklistId — update checklist
 *  - DELETE /:id/checklists/:checklistId — delete checklist
 */

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
  },
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findUnique: jest.fn() },
    savedProperty: { upsert: jest.fn(), deleteMany: jest.fn() },
    quoteRequest: { create: jest.fn(), findMany: jest.fn() },
    propertyChecklist: { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(), $transaction: jest.fn() },
    client: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../utils/supabaseAdmin', () => ({
  supabaseAdmin: {},
}))

jest.mock('../../utils/cache', () => {
  const actual = jest.requireActual('../../utils/cache') as typeof import('../../utils/cache')
  return {
    LRUCache: actual.LRUCache,
    RequestDeduplicator: actual.RequestDeduplicator,
    insuranceCache: new actual.LRUCache(100, 1000),
    carriersCache: new actual.LRUCache(100, 1000),
    insurabilityCache: new actual.LRUCache(100, 1000),
    publicDataCache: new actual.LRUCache(100, 1000),
    carriersDeduplicator: new actual.RequestDeduplicator(),
    tokenCache: new actual.LRUCache(100, 1000),
    propertyCache: new actual.LRUCache(100, 1000),
    riskCache: new actual.LRUCache(100, 1000),
    riskDeduplicator: new actual.RequestDeduplicator(),
    insuranceDeduplicator: new actual.RequestDeduplicator(),
    insurabilityDeduplicator: new actual.RequestDeduplicator(),
    publicDataDeduplicator: new actual.RequestDeduplicator(),
  }
})

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

jest.mock('../../services/publicPropertyDataService', () => ({
  getPropertyPublicData: jest.fn(),
}))

jest.mock('../../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id'
    req.userRole = 'BUYER'
    next()
  },
}))

jest.mock('../../middleware/subscription', () => ({
  requireSubscription: (_req: any, _res: any, next: any) => {
    next()
  },
}))

import express from 'express'
import request from 'supertest'
import { propertiesRouter } from '../../routes/properties'
import { errorHandler } from '../../middleware/errorHandler'
import { prisma } from '../../utils/prisma'
import { searchProperties, suggestProperties, getPropertyById, geocodeAndCreateProperty } from '../../services/propertyService'
import { getOrComputeRiskProfile } from '../../services/riskService'
import { getOrComputeInsuranceEstimate } from '../../services/insuranceService'
import { getCarriersForProperty } from '../../services/carriersService'
import { getInsurabilityStatus } from '../../services/insurabilityService'
import { getPropertyPublicData } from '../../services/publicPropertyDataService'

const app = express()
app.use(express.json())
app.use('/api/properties', propertiesRouter)
app.use(errorHandler)

const mockPrisma = prisma as any
const mockSearchProperties = searchProperties as jest.Mock
const mockSuggestProperties = suggestProperties as jest.Mock
const mockGetPropertyById = getPropertyById as jest.Mock
const mockGeocodeAndCreateProperty = geocodeAndCreateProperty as jest.Mock
const mockGetOrComputeRiskProfile = getOrComputeRiskProfile as jest.Mock
const mockGetOrComputeInsuranceEstimate = getOrComputeInsuranceEstimate as jest.Mock
const mockGetCarriersForProperty = getCarriersForProperty as jest.Mock
const mockGetInsurabilityStatus = getInsurabilityStatus as jest.Mock
const mockGetPropertyPublicData = getPropertyPublicData as jest.Mock

const sampleProperty = {
  id: 'prop-123',
  address: '123 Main St',
  city: 'Miami',
  state: 'FL',
  zip: '33101',
}

const sampleRiskProfile = {
  propertyId: 'prop-123',
  overallScore: 65,
  floodRisk: { score: 80, zone: 'AE' },
  fireRisk: { score: 30 },
  windRisk: { score: 70 },
  earthquakeRisk: { score: 10 },
  crimeRisk: { score: 40 },
}

const sampleInsuranceEstimate = {
  propertyId: 'prop-123',
  totalAnnualPremium: 4500,
  breakdown: { flood: 2000, homeowners: 1500, wind: 1000 },
}

const sampleCarriers = {
  carriers: [
    { id: 'carrier-1', name: 'Citizens', writingStatus: 'ACTIVELY_WRITING' },
    { id: 'carrier-2', name: 'Universal', writingStatus: 'ACTIVELY_WRITING' },
  ],
  marketCondition: 'COMPETITIVE',
}

const sampleInsurability = {
  propertyId: 'prop-123',
  status: 'INSURABLE',
  restrictions: [],
}

const samplePublicData = {
  propertyId: 'prop-123',
  images: [],
  taxInfo: {},
  amenities: [],
}

describe('Properties Router', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Param validation ──────────────────────────────────────────────────────

  describe('param validation', () => {
    it('returns 400 when property ID is "undefined"', async () => {
      const res = await request(app).get('/api/properties/undefined')
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('BAD_REQUEST')
    })

    it('returns 400 when property ID is "null"', async () => {
      const res = await request(app).get('/api/properties/null')
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('BAD_REQUEST')
    })

    it('returns 400 when property ID exceeds 50 characters', async () => {
      const longId = 'a'.repeat(51)
      const res = await request(app).get(`/api/properties/${longId}`)
      expect(res.status).toBe(400)
      expect(res.body.error.message).toBe('A valid property ID is required')
    })

    it('allows valid property IDs through param validation', async () => {
      mockGetPropertyById.mockResolvedValue(sampleProperty)
      const res = await request(app).get('/api/properties/valid-id-123')
      expect(res.status).toBe(200)
    })
  })

  // ── GET /suggest ──────────────────────────────────────────────────────────

  describe('GET /api/properties/suggest', () => {
    it('returns 400 when query parameter is missing', async () => {
      const res = await request(app).get('/api/properties/suggest')
      expect(res.status).toBe(400)
    })

    it('returns 400 when query is too short (< 2 chars)', async () => {
      const res = await request(app).get('/api/properties/suggest?q=a')
      expect(res.status).toBe(400)
    })

    it('returns suggestions for a valid query', async () => {
      const suggestions = [
        { placeId: 'place-1', description: '123 Main St, Miami, FL' },
        { placeId: 'place-2', description: '124 Main St, Miami, FL' },
      ]
      mockSuggestProperties.mockResolvedValue(suggestions)

      const res = await request(app).get('/api/properties/suggest?q=123 Main')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(suggestions)
      expect(mockSuggestProperties).toHaveBeenCalledWith('123 Main', 5)
    })

    it('respects custom limit parameter', async () => {
      mockSuggestProperties.mockResolvedValue([])
      const res = await request(app).get('/api/properties/suggest?q=test&limit=3')
      expect(res.status).toBe(200)
      expect(mockSuggestProperties).toHaveBeenCalledWith('test', 3)
    })
  })

  // ── GET /search ───────────────────────────────────────────────────────────

  describe('GET /api/properties/search', () => {
    it('returns 400 when no search params are provided', async () => {
      const res = await request(app).get('/api/properties/search')
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('MISSING_PARAM')
    })

    it('returns results for a valid address search', async () => {
      const searchResult = { properties: [sampleProperty], total: 1, page: 1, limit: 20 }
      mockSearchProperties.mockResolvedValue(searchResult)

      const res = await request(app).get('/api/properties/search?address=123+Main+St')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(searchResult)
    })

    it('returns results for a valid zip search', async () => {
      const searchResult = { properties: [sampleProperty], total: 1, page: 1, limit: 20 }
      mockSearchProperties.mockResolvedValue(searchResult)

      const res = await request(app).get('/api/properties/search?zip=33101')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(mockSearchProperties).toHaveBeenCalledWith(
        expect.objectContaining({ zip: '33101' }),
        undefined,
      )
    })

    it('returns 400 for an invalid zip code format', async () => {
      const res = await request(app).get('/api/properties/search?zip=123')
      expect(res.status).toBe(400)
    })

    it('returns 400 for an invalid state code', async () => {
      const res = await request(app).get('/api/properties/search?state=Florida')
      expect(res.status).toBe(400)
    })
  })

  // ── POST /geocode ─────────────────────────────────────────────────────────

  describe('POST /api/properties/geocode', () => {
    it('returns 400 when placeId is missing', async () => {
      const res = await request(app).post('/api/properties/geocode').send({})
      expect(res.status).toBe(400)
    })

    it('returns 422 when geocode returns null', async () => {
      mockGeocodeAndCreateProperty.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/properties/geocode')
        .send({ placeId: 'ChIJ_invalid' })
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('GEOCODE_FAILED')
    })

    it('returns property on successful geocode', async () => {
      mockGeocodeAndCreateProperty.mockResolvedValue(sampleProperty)

      const res = await request(app)
        .post('/api/properties/geocode')
        .send({ placeId: 'ChIJ_valid_place_id' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(sampleProperty)
    })
  })

  // ── GET /:id ──────────────────────────────────────────────────────────────

  describe('GET /api/properties/:id', () => {
    it('returns 404 when property is not found', async () => {
      mockGetPropertyById.mockResolvedValue(null)

      const res = await request(app).get('/api/properties/nonexistent-id')
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns property detail on success', async () => {
      mockGetPropertyById.mockResolvedValue(sampleProperty)

      const res = await request(app).get('/api/properties/prop-123')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(sampleProperty)
    })

    it('sets Cache-Control headers for property detail', async () => {
      mockGetPropertyById.mockResolvedValue(sampleProperty)

      const res = await request(app).get('/api/properties/prop-123')
      expect(res.headers['cache-control']).toContain('s-maxage=1800')
    })
  })

  // ── GET /:id/risk ─────────────────────────────────────────────────────────

  describe('GET /api/properties/:id/risk', () => {
    it('returns risk profile', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)

      const res = await request(app).get('/api/properties/prop-123/risk')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(sampleRiskProfile)
    })

    it('calls getOrComputeRiskProfile with forceRefresh=false by default', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)

      await request(app).get('/api/properties/prop-123/risk')
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', false)
    })

    it('clears dependent caches on force refresh', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)

      const res = await request(app).get('/api/properties/prop-123/risk?refresh=true')
      expect(res.status).toBe(200)
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', true)
      expect(res.headers['cache-control']).toContain('no-cache')
    })
  })

  // ── GET /:id/insurance ────────────────────────────────────────────────────

  describe('GET /api/properties/:id/insurance', () => {
    it('returns insurance estimate', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetOrComputeInsuranceEstimate.mockResolvedValue(sampleInsuranceEstimate)

      const res = await request(app).get('/api/properties/prop-123/insurance')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(sampleInsuranceEstimate)
    })

    it('ensures risk profile is computed before insurance', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetOrComputeInsuranceEstimate.mockResolvedValue(sampleInsuranceEstimate)

      await request(app).get('/api/properties/prop-123/insurance')
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', false)
      expect(mockGetOrComputeInsuranceEstimate).toHaveBeenCalledWith('prop-123', false)
    })

    it('passes forceRefresh to both risk and insurance services', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetOrComputeInsuranceEstimate.mockResolvedValue(sampleInsuranceEstimate)

      await request(app).get('/api/properties/prop-123/insurance?refresh=true')
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', true)
      expect(mockGetOrComputeInsuranceEstimate).toHaveBeenCalledWith('prop-123', true)
    })
  })

  // ── GET /:id/report ───────────────────────────────────────────────────────

  describe('GET /api/properties/:id/report', () => {
    it('returns full report bundle', async () => {
      mockGetPropertyById.mockResolvedValue(sampleProperty)
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetOrComputeInsuranceEstimate.mockResolvedValue(sampleInsuranceEstimate)
      mockGetInsurabilityStatus.mockResolvedValue(sampleInsurability)
      mockGetCarriersForProperty.mockResolvedValue(sampleCarriers)
      mockGetPropertyPublicData.mockResolvedValue(samplePublicData)

      const res = await request(app).get('/api/properties/prop-123/report')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual({
        property: sampleProperty,
        risk: sampleRiskProfile,
        insurance: sampleInsuranceEstimate,
        insurability: sampleInsurability,
        carriers: sampleCarriers,
        publicData: samplePublicData,
      })
    })

    it('returns 404 when property is not found', async () => {
      mockGetPropertyById.mockResolvedValue(null)
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetPropertyPublicData.mockResolvedValue(null)

      const res = await request(app).get('/api/properties/nonexistent/report')
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns report with null publicData when public data fetch fails', async () => {
      mockGetPropertyById.mockResolvedValue(sampleProperty)
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetOrComputeInsuranceEstimate.mockResolvedValue(sampleInsuranceEstimate)
      mockGetInsurabilityStatus.mockResolvedValue(sampleInsurability)
      mockGetCarriersForProperty.mockResolvedValue(sampleCarriers)
      mockGetPropertyPublicData.mockRejectedValue(new Error('Public data unavailable'))

      const res = await request(app).get('/api/properties/prop-123/report')
      expect(res.status).toBe(200)
      expect(res.body.data.publicData).toBeNull()
    })
  })

  // ── GET /:id/public-data ──────────────────────────────────────────────────

  describe('GET /api/properties/:id/public-data', () => {
    it('returns public data', async () => {
      mockGetPropertyPublicData.mockResolvedValue(samplePublicData)

      const res = await request(app).get('/api/properties/prop-123/public-data')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(samplePublicData)
    })

    it('sets 24h CDN cache headers', async () => {
      mockGetPropertyPublicData.mockResolvedValue(samplePublicData)

      const res = await request(app).get('/api/properties/prop-123/public-data')
      expect(res.headers['cache-control']).toContain('s-maxage=86400')
    })
  })

  // ── POST /:id/save ────────────────────────────────────────────────────────

  describe('POST /api/properties/:id/save', () => {
    it('saves a property via upsert', async () => {
      const savedRecord = {
        id: 'saved-1',
        userId: 'test-user-id',
        propertyId: 'prop-123',
        clientId: null,
        notes: 'Great property',
        tags: ['favorite'],
        savedAt: new Date().toISOString(),
      }
      mockPrisma.property.findUnique.mockResolvedValue({ id: 'prop-123' })
      mockPrisma.savedProperty.upsert.mockResolvedValue(savedRecord)

      const res = await request(app)
        .post('/api/properties/prop-123/save')
        .send({ notes: 'Great property', tags: ['favorite'] })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(savedRecord)
    })

    it('returns 404 when property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/properties/prop-999/save')
        .send({})

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
      expect(res.body.error.message).toBe('Property not found')
    })

    it('returns 404 when clientId is not owned by user', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 'prop-123' })
      mockPrisma.client.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/properties/prop-123/save')
        .send({ clientId: '550e8400-e29b-41d4-a716-446655440000' })

      expect(res.status).toBe(404)
      expect(res.body.error.message).toBe('Client not found')
    })

    it('saves with empty body (defaults)', async () => {
      const savedRecord = {
        id: 'saved-2',
        userId: 'test-user-id',
        propertyId: 'prop-123',
        clientId: null,
        notes: undefined,
        tags: [],
        savedAt: new Date().toISOString(),
      }
      mockPrisma.property.findUnique.mockResolvedValue({ id: 'prop-123' })
      mockPrisma.savedProperty.upsert.mockResolvedValue(savedRecord)

      const res = await request(app)
        .post('/api/properties/prop-123/save')
        .send({})

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  // ── DELETE /:id/save ──────────────────────────────────────────────────────

  describe('DELETE /api/properties/:id/save', () => {
    it('unsaves a property', async () => {
      mockPrisma.savedProperty.deleteMany.mockResolvedValue({ count: 1 })

      const res = await request(app).delete('/api/properties/prop-123/save')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toBeNull()
    })

    it('returns 404 when saved property is not found', async () => {
      mockPrisma.savedProperty.deleteMany.mockResolvedValue({ count: 0 })

      const res = await request(app).delete('/api/properties/prop-999/save')
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
      expect(res.body.error.message).toBe('Saved property not found')
    })

    it('scopes delete to the authenticated user', async () => {
      mockPrisma.savedProperty.deleteMany.mockResolvedValue({ count: 1 })

      await request(app).delete('/api/properties/prop-123/save')
      expect(mockPrisma.savedProperty.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id', propertyId: 'prop-123' },
      })
    })
  })

  // ── GET /:id/insurability ─────────────────────────────────────────────────

  describe('GET /api/properties/:id/insurability', () => {
    it('returns insurability status', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetInsurabilityStatus.mockResolvedValue(sampleInsurability)

      const res = await request(app).get('/api/properties/prop-123/insurability')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(sampleInsurability)
    })

    it('ensures risk profile is computed before insurability', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetInsurabilityStatus.mockResolvedValue(sampleInsurability)

      await request(app).get('/api/properties/prop-123/insurability')
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', false)
    })

    it('passes forceRefresh flag through', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetInsurabilityStatus.mockResolvedValue(sampleInsurability)

      await request(app).get('/api/properties/prop-123/insurability?refresh=true')
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', true)
      expect(mockGetInsurabilityStatus).toHaveBeenCalledWith('prop-123', true)
    })
  })

  // ── GET /:id/carriers ─────────────────────────────────────────────────────

  describe('GET /api/properties/:id/carriers', () => {
    it('returns carriers', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetCarriersForProperty.mockResolvedValue(sampleCarriers)

      const res = await request(app).get('/api/properties/prop-123/carriers')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(sampleCarriers)
    })

    it('ensures risk profile is computed before carriers', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetCarriersForProperty.mockResolvedValue(sampleCarriers)

      await request(app).get('/api/properties/prop-123/carriers')
      expect(mockGetOrComputeRiskProfile).toHaveBeenCalledWith('prop-123', false)
    })

    it('sets 1h CDN cache headers', async () => {
      mockGetOrComputeRiskProfile.mockResolvedValue(sampleRiskProfile)
      mockGetCarriersForProperty.mockResolvedValue(sampleCarriers)

      const res = await request(app).get('/api/properties/prop-123/carriers')
      expect(res.headers['cache-control']).toContain('s-maxage=3600')
    })
  })

  // ── POST /:id/quote-request ───────────────────────────────────────────────

  describe('POST /api/properties/:id/quote-request', () => {
    it('creates a quote request and returns 201', async () => {
      mockPrisma.quoteRequest.create.mockResolvedValue({ id: 'qr-1' })

      const res = await request(app)
        .post('/api/properties/prop-123/quote-request')
        .send({
          carrierId: 'carrier-1',
          coverageTypes: ['HOMEOWNERS', 'FLOOD'],
          notes: 'Need coverage ASAP',
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual({ quoteRequestId: 'qr-1' })
    })

    it('returns 400 when coverageTypes is empty', async () => {
      const res = await request(app)
        .post('/api/properties/prop-123/quote-request')
        .send({ carrierId: 'carrier-1', coverageTypes: [] })

      expect(res.status).toBe(400)
    })

    it('returns 400 when carrierId is missing', async () => {
      const res = await request(app)
        .post('/api/properties/prop-123/quote-request')
        .send({ coverageTypes: ['FLOOD'] })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid coverage type', async () => {
      const res = await request(app)
        .post('/api/properties/prop-123/quote-request')
        .send({ carrierId: 'carrier-1', coverageTypes: ['INVALID_TYPE'] })

      expect(res.status).toBe(400)
    })

    it('creates quote request with all valid coverage types', async () => {
      mockPrisma.quoteRequest.create.mockResolvedValue({ id: 'qr-2' })

      const res = await request(app)
        .post('/api/properties/prop-123/quote-request')
        .send({
          carrierId: 'carrier-1',
          coverageTypes: ['HOMEOWNERS', 'FLOOD', 'EARTHQUAKE', 'WIND_HURRICANE', 'UMBRELLA', 'FIRE'],
        })

      expect(res.status).toBe(201)
    })
  })

  // ── GET /:id/quote-requests ───────────────────────────────────────────────

  describe('GET /api/properties/:id/quote-requests', () => {
    it('returns list of quote requests for the user', async () => {
      const quoteRequests = [
        { id: 'qr-1', carrierId: 'carrier-1', coverageTypes: ['FLOOD'], status: 'PENDING', notes: null, submittedAt: '2026-01-01T00:00:00Z' },
        { id: 'qr-2', carrierId: 'carrier-2', coverageTypes: ['HOMEOWNERS'], status: 'PENDING', notes: 'Rush', submittedAt: '2026-01-02T00:00:00Z' },
      ]
      mockPrisma.quoteRequest.findMany.mockResolvedValue(quoteRequests)

      const res = await request(app).get('/api/properties/prop-123/quote-requests')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(quoteRequests)
    })

    it('scopes quote requests to authenticated user', async () => {
      mockPrisma.quoteRequest.findMany.mockResolvedValue([])

      await request(app).get('/api/properties/prop-123/quote-requests')
      expect(mockPrisma.quoteRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId: 'prop-123', userId: 'test-user-id' },
        }),
      )
    })

    it('returns empty array when no quote requests exist', async () => {
      mockPrisma.quoteRequest.findMany.mockResolvedValue([])

      const res = await request(app).get('/api/properties/prop-123/quote-requests')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  // ── GET /:id/checklists ───────────────────────────────────────────────────

  describe('GET /api/properties/:id/checklists', () => {
    it('returns checklists for the user', async () => {
      const checklists = [
        { id: 'cl-1', checklistType: 'INSPECTION', title: 'Home Inspection', items: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', propertyId: 'prop-123' },
      ]
      mockPrisma.propertyChecklist.findMany.mockResolvedValue(checklists)

      const res = await request(app).get('/api/properties/prop-123/checklists')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(checklists)
    })

    it('scopes checklists to authenticated user', async () => {
      mockPrisma.propertyChecklist.findMany.mockResolvedValue([])

      await request(app).get('/api/properties/prop-123/checklists')
      expect(mockPrisma.propertyChecklist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId: 'prop-123', userId: 'test-user-id' },
        }),
      )
    })

    it('returns empty array when no checklists exist', async () => {
      mockPrisma.propertyChecklist.findMany.mockResolvedValue([])

      const res = await request(app).get('/api/properties/prop-123/checklists')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  // ── POST /:id/checklists ──────────────────────────────────────────────────

  describe('POST /api/properties/:id/checklists', () => {
    const validChecklist = {
      checklistType: 'INSPECTION',
      title: 'Home Inspection Checklist',
      items: [{ id: 'item-1', label: 'Check roof', checked: false }],
    }

    it('creates a checklist and returns 201', async () => {
      const created = { id: 'cl-new', ...validChecklist, createdAt: '2026-01-01', updatedAt: '2026-01-01', propertyId: 'prop-123' }
      mockPrisma.propertyChecklist.upsert.mockResolvedValue(created)

      const res = await request(app)
        .post('/api/properties/prop-123/checklists')
        .send(validChecklist)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(created)
    })

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/api/properties/prop-123/checklists')
        .send({ checklistType: 'INSPECTION', items: [] })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid checklistType', async () => {
      const res = await request(app)
        .post('/api/properties/prop-123/checklists')
        .send({ checklistType: 'INVALID', title: 'Test', items: [] })

      expect(res.status).toBe(400)
    })

    it('uses upsert with userId_propertyId_checklistType compound key', async () => {
      mockPrisma.propertyChecklist.upsert.mockResolvedValue({ id: 'cl-1' })

      await request(app)
        .post('/api/properties/prop-123/checklists')
        .send(validChecklist)

      expect(mockPrisma.propertyChecklist.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_propertyId_checklistType: {
              userId: 'test-user-id',
              propertyId: 'prop-123',
              checklistType: 'INSPECTION',
            },
          },
        }),
      )
    })
  })

  // ── PATCH /:id/checklists/:checklistId ────────────────────────────────────

  describe('PATCH /api/properties/:id/checklists/:checklistId', () => {
    it('updates a checklist', async () => {
      const updated = { id: 'cl-1', checklistType: 'INSPECTION', title: 'Updated Title', items: [], createdAt: '2026-01-01', updatedAt: '2026-01-02', propertyId: 'prop-123' }
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        propertyChecklist: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue(updated),
        },
      }))

      const res = await request(app)
        .patch('/api/properties/prop-123/checklists/cl-1')
        .send({ title: 'Updated Title' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(updated)
    })

    it('returns 404 when checklist is not found', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        propertyChecklist: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirst: jest.fn(),
        },
      }))

      const res = await request(app)
        .patch('/api/properties/prop-123/checklists/cl-nonexistent')
        .send({ title: 'New Title' })

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
      expect(res.body.error.message).toBe('Checklist not found')
    })

    it('updates items without changing title', async () => {
      const newItems = [{ id: 'item-1', label: 'Check roof', checked: true }]
      const updated = { id: 'cl-1', checklistType: 'INSPECTION', title: 'Original', items: newItems, createdAt: '2026-01-01', updatedAt: '2026-01-02', propertyId: 'prop-123' }
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn({
        propertyChecklist: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue(updated),
        },
      }))

      const res = await request(app)
        .patch('/api/properties/prop-123/checklists/cl-1')
        .send({ items: newItems })

      expect(res.status).toBe(200)
      expect(res.body.data.items).toEqual(newItems)
    })
  })

  // ── DELETE /:id/checklists/:checklistId ───────────────────────────────────

  describe('DELETE /api/properties/:id/checklists/:checklistId', () => {
    it('deletes a checklist', async () => {
      mockPrisma.propertyChecklist.deleteMany.mockResolvedValue({ count: 1 })

      const res = await request(app).delete('/api/properties/prop-123/checklists/cl-1')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toBeNull()
    })

    it('returns 404 when checklist is not found', async () => {
      mockPrisma.propertyChecklist.deleteMany.mockResolvedValue({ count: 0 })

      const res = await request(app).delete('/api/properties/prop-123/checklists/cl-nonexistent')
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
      expect(res.body.error.message).toBe('Checklist not found')
    })

    it('scopes delete to authenticated user', async () => {
      mockPrisma.propertyChecklist.deleteMany.mockResolvedValue({ count: 1 })

      await request(app).delete('/api/properties/prop-123/checklists/cl-1')
      expect(mockPrisma.propertyChecklist.deleteMany).toHaveBeenCalledWith({
        where: { id: 'cl-1', userId: 'test-user-id' },
      })
    })
  })
})
