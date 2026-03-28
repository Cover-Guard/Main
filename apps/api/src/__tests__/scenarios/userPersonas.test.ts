/**
 * User Persona & Scenario Integration Tests
 *
 * Tests complete user journeys through the API layer for the five key personas:
 * 1. First-Time Home Buyer (Sarah) — consumer searching/saving/quoting
 * 2. Real Estate Agent (Michael) — client management + property research
 * 3. Mortgage Lender (Jennifer) — insurability verification for loan approval
 * 4. Unauthorized User — public endpoints only, auth-gated endpoints blocked
 * 5. Edge Cases — null data, extreme risk, invalid IDs, force-refresh
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
jest.mock('../../utils/prisma', () => ({
  prisma: {
    property: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn(), findUniqueOrThrow: jest.fn() },
    savedProperty: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    searchHistory: { create: jest.fn().mockReturnValue({ catch: jest.fn() }) },
    quoteRequest: { create: jest.fn(), findMany: jest.fn() },
    client: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), findFirst: jest.fn() },
    propertyChecklist: { findMany: jest.fn(), upsert: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  },
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

import express from 'express'
import request from 'supertest'
import { propertiesRouter } from '../../routes/properties'
import { clientsRouter } from '../../routes/clients'
import { errorHandler } from '../../middleware/errorHandler'
import { prisma } from '../../utils/prisma'
import { supabaseAdmin } from '../../utils/supabaseAdmin'
import { searchProperties, getPropertyById, geocodeAndCreateProperty } from '../../services/propertyService'
import { getOrComputeRiskProfile } from '../../services/riskService'
import { getOrComputeInsuranceEstimate } from '../../services/insuranceService'
import { getCarriersForProperty } from '../../services/carriersService'
import { getInsurabilityStatus } from '../../services/insurabilityService'

const app = express()
app.use(express.json())
app.use('/api/properties', propertiesRouter)
app.use('/api/clients', clientsRouter)
app.use(errorHandler)

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjk5OTk5OTk5OTl9.sig'

function mockAuth(userId = 'user-1') {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId, role: 'authenticated' } },
    error: null,
  })
}

const mockPropertyData = {
  id: 'prop-austin-1',
  address: '123 Main Street',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  county: 'Travis',
  lat: 30.2672,
  lng: -97.7431,
  propertyType: 'SINGLE_FAMILY',
  yearBuilt: 1998,
  squareFeet: 2100,
  bedrooms: 3,
  bathrooms: 2,
  lotSize: 7200,
  estimatedValue: 620000,
  lastSalePrice: 485000,
  lastSaleDate: '2021-03-15',
  parcelId: 'MOCK-000001',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockRiskProfile = {
  propertyId: 'prop-austin-1',
  overallRiskScore: 35,
  overallRiskLevel: 'MODERATE',
  floodRisk: { score: 25, level: 'LOW', floodZone: 'X', inSFHA: false },
  fireRisk: { score: 30, level: 'LOW' },
  windRisk: { score: 40, level: 'MODERATE' },
  earthquakeRisk: { score: 15, level: 'LOW' },
  crimeRisk: { score: 45, level: 'MODERATE' },
  lastUpdated: new Date().toISOString(),
}

const mockInsurance = {
  propertyId: 'prop-austin-1',
  estimatedAnnualTotal: 2400,
  confidenceLevel: 'MEDIUM',
  coverages: [
    { type: 'HOMEOWNERS', averageAnnualPremium: 1800, lowEstimate: 1500, highEstimate: 2200, required: true, notes: null },
    { type: 'FLOOD', averageAnnualPremium: 600, lowEstimate: 400, highEstimate: 900, required: false, notes: null },
  ],
  recommendations: [],
  disclaimers: ['Estimates are for informational purposes only.'],
  lastUpdated: new Date().toISOString(),
}

const mockCarriers = {
  propertyId: 'prop-austin-1',
  carriers: [
    { id: 'state-farm', name: 'State Farm', writingStatus: 'ACTIVELY_WRITING', amBestRating: 'A++', coverageTypes: ['HOMEOWNERS'], avgPremiumModifier: 1.05, statesLicensed: ['ALL'], specialties: [], notes: null },
  ],
  marketCondition: 'MODERATE',
  lastUpdated: new Date().toISOString(),
}

const mockInsurability = {
  propertyId: 'prop-austin-1',
  difficultyLevel: 'MODERATE',
  isInsurable: true,
  potentialIssues: [],
  recommendedActions: ['Compare quotes from at least 3 carriers.'],
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── Persona 1: First-Time Home Buyer (Sarah) ──────────────────────────────

describe('Persona: First-Time Home Buyer (Sarah)', () => {
  beforeEach(() => mockAuth('sarah-001'))

  it('Scenario 1: searches for property by zip code', async () => {
    ;(searchProperties as jest.Mock).mockResolvedValue({
      properties: [mockPropertyData],
      total: 1,
      page: 1,
      limit: 20,
    })

    const res = await request(app).get('/api/properties/search?zip=78701')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.properties).toHaveLength(1)
    expect(res.body.data.properties[0].zip).toBe('78701')
  })

  it('Scenario 2: views property details', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(mockPropertyData)

    const res = await request(app).get('/api/properties/prop-austin-1')
    expect(res.status).toBe(200)
    expect(res.body.data.address).toBe('123 Main Street')
  })

  it('Scenario 3: checks risk profile for the property', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRiskProfile)

    const res = await request(app).get('/api/properties/prop-austin-1/risk')
    expect(res.status).toBe(200)
    expect(res.body.data.overallRiskLevel).toBe('MODERATE')
  })

  it('Scenario 4: checks insurance estimates', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRiskProfile)
    ;(getOrComputeInsuranceEstimate as jest.Mock).mockResolvedValue(mockInsurance)

    const res = await request(app).get('/api/properties/prop-austin-1/insurance')
    expect(res.status).toBe(200)
    expect(res.body.data.estimatedAnnualTotal).toBe(2400)
  })

  it('Scenario 5: saves a property she likes', async () => {
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop-austin-1' })
    ;(prisma.savedProperty.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.savedProperty.upsert as jest.Mock).mockResolvedValue({
      id: 'sp-1',
      userId: 'sarah-001',
      propertyId: 'prop-austin-1',
      notes: 'Love this house!',
      tags: ['favorite'],
    })

    const res = await request(app)
      .post('/api/properties/prop-austin-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ notes: 'Love this house!', tags: ['favorite'] })

    expect(res.status).toBe(201)
    expect(res.body.data.notes).toBe('Love this house!')
  })

  it('Scenario 6: requests a binding quote from an active carrier', async () => {
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop-austin-1' })
    ;(prisma.quoteRequest.create as jest.Mock).mockResolvedValue({
      id: 'qr-1',
      userId: 'sarah-001',
      propertyId: 'prop-austin-1',
      carrierId: 'state-farm',
      coverageTypes: ['HOMEOWNERS'],
    })

    const res = await request(app)
      .post('/api/properties/prop-austin-1/quote-request')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ carrierId: 'state-farm', coverageTypes: ['HOMEOWNERS'] })

    expect(res.status).toBe(201)
    expect(res.body.data.quoteRequestId).toBe('qr-1')
  })

  it('Scenario 7: views her quote request history', async () => {
    ;(prisma.quoteRequest.findMany as jest.Mock).mockResolvedValue([
      { id: 'qr-1', carrierId: 'state-farm', coverageTypes: ['HOMEOWNERS'], status: 'PENDING' },
    ])

    const res = await request(app)
      .get('/api/properties/prop-austin-1/quote-requests')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })
})

// ─── Persona 2: Real Estate Agent (Michael) ───────���─────────────────────────

describe('Persona: Real Estate Agent (Michael)', () => {
  beforeEach(() => mockAuth('michael-agent-001'))

  it('Scenario 1: creates a new client profile', async () => {
    ;(prisma.client.create as jest.Mock).mockResolvedValue({
      id: 'client-1',
      agentId: 'michael-agent-001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    })

    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' })

    expect(res.status).toBe(201)
    expect(res.body.data.firstName).toBe('Jane')
  })

  it('Scenario 2: searches for property for a client', async () => {
    ;(searchProperties as jest.Mock).mockResolvedValue({
      properties: [mockPropertyData],
      total: 1,
      page: 1,
      limit: 20,
    })

    const res = await request(app).get('/api/properties/search?city=Austin&state=TX')
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(1)
  })

  it('Scenario 3: reviews full property report', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(mockPropertyData)
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRiskProfile)
    ;(getOrComputeInsuranceEstimate as jest.Mock).mockResolvedValue(mockInsurance)
    ;(getInsurabilityStatus as jest.Mock).mockResolvedValue(mockInsurability)
    ;(getCarriersForProperty as jest.Mock).mockResolvedValue(mockCarriers)

    const res = await request(app).get('/api/properties/prop-austin-1/report')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('property')
    expect(res.body.data).toHaveProperty('risk')
    expect(res.body.data).toHaveProperty('insurance')
    expect(res.body.data).toHaveProperty('insurability')
    expect(res.body.data).toHaveProperty('carriers')
  })

  it('Scenario 4: saves property and associates with client', async () => {
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop-austin-1' })
    ;(prisma.client.findFirst as jest.Mock).mockResolvedValue({ id: 'client-1' })
    ;(prisma.savedProperty.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.savedProperty.upsert as jest.Mock).mockResolvedValue({
      id: 'sp-2',
      userId: 'michael-agent-001',
      propertyId: 'prop-austin-1',
      clientId: 'client-1',
    })

    const res = await request(app)
      .post('/api/properties/prop-austin-1/save')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ clientId: 'client-1', notes: 'For Jane Doe' })

    expect(res.status).toBe(201)
  })

  it('Scenario 5: updates client information', async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: Function) => fn(prisma))
    ;(prisma.client.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: 'client-1',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      _count: { savedProperties: 2 },
    })

    const res = await request(app)
      .patch('/api/clients/client-1')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ lastName: 'Smith', email: 'jane.smith@example.com' })

    expect(res.status).toBe(200)
  })

  it('Scenario 6: lists all clients with saved property counts', async () => {
    ;(prisma.client.findMany as jest.Mock).mockResolvedValue([
      { id: 'client-1', firstName: 'Jane', lastName: 'Doe', _count: { savedProperties: 3 } },
      { id: 'client-2', firstName: 'Bob', lastName: 'Smith', _count: { savedProperties: 1 } },
    ])

    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
  })

  it('Scenario 7: deletes a client', async () => {
    ;(prisma.client.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await request(app)
      .delete('/api/clients/client-1')
      .set('Authorization', `Bearer ${TOKEN}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})

// ─── Persona 3: Mortgage Lender (Jennifer) ────────���─────────────────────────

describe('Persona: Mortgage Lender (Jennifer)', () => {
  const highRiskFlProperty = {
    ...mockPropertyData,
    id: 'prop-miami-1',
    city: 'Miami',
    state: 'FL',
    zip: '33139',
  }

  const highRiskProfile = {
    propertyId: 'prop-miami-1',
    overallRiskScore: 78,
    overallRiskLevel: 'VERY_HIGH',
    floodRisk: { score: 85, level: 'VERY_HIGH', floodZone: 'AE', inSFHA: true },
    fireRisk: { score: 20, level: 'LOW' },
    windRisk: { score: 80, level: 'VERY_HIGH' },
    earthquakeRisk: { score: 10, level: 'LOW' },
    crimeRisk: { score: 55, level: 'MODERATE' },
  }

  const crisisCarriers = {
    propertyId: 'prop-miami-1',
    carriers: [
      { id: 'citizens-fl', name: 'Citizens Property Insurance', writingStatus: 'ACTIVELY_WRITING' },
      { id: 'state-farm', name: 'State Farm', writingStatus: 'LIMITED' },
      { id: 'lexington', name: 'Lexington Insurance', writingStatus: 'ACTIVELY_WRITING' },
    ],
    marketCondition: 'CRISIS',
    lastUpdated: new Date().toISOString(),
  }

  it('Scenario 1: searches high-risk coastal FL property', async () => {
    ;(searchProperties as jest.Mock).mockResolvedValue({
      properties: [highRiskFlProperty],
      total: 1,
      page: 1,
      limit: 20,
    })

    const res = await request(app).get('/api/properties/search?zip=33139')
    expect(res.status).toBe(200)
    expect(res.body.data.properties[0].state).toBe('FL')
  })

  it('Scenario 2: reviews risk profile showing VERY_HIGH risk', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(highRiskProfile)

    const res = await request(app).get('/api/properties/prop-miami-1/risk')
    expect(res.status).toBe(200)
    expect(res.body.data.overallRiskLevel).toBe('VERY_HIGH')
    expect(res.body.data.floodRisk.inSFHA).toBe(true)
  })

  it('Scenario 3: checks insurability — expects HIGH difficulty', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(highRiskProfile)
    ;(getInsurabilityStatus as jest.Mock).mockResolvedValue({
      propertyId: 'prop-miami-1',
      difficultyLevel: 'VERY_HIGH',
      isInsurable: true,
      potentialIssues: ['Property is in SFHA flood zone AE', 'High hurricane wind risk'],
      recommendedActions: ['Mandatory flood insurance required', 'Obtain wind/hurricane coverage'],
    })

    const res = await request(app).get('/api/properties/prop-miami-1/insurability')
    expect(res.status).toBe(200)
    expect(res.body.data.difficultyLevel).toBe('VERY_HIGH')
    expect(res.body.data.potentialIssues.length).toBeGreaterThan(0)
  })

  it('Scenario 4: reviews carriers — CRISIS market in FL', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(highRiskProfile)
    ;(getCarriersForProperty as jest.Mock).mockResolvedValue(crisisCarriers)

    const res = await request(app).get('/api/properties/prop-miami-1/carriers')
    expect(res.status).toBe(200)
    expect(res.body.data.marketCondition).toBe('CRISIS')
    // Citizens FL (insurer of last resort) is actively writing
    expect(res.body.data.carriers.find((c: { id: string }) => c.id === 'citizens-fl').writingStatus).toBe('ACTIVELY_WRITING')
  })

  it('Scenario 5: searches low-risk TX property for comparison', async () => {
    ;(searchProperties as jest.Mock).mockResolvedValue({
      properties: [mockPropertyData],
      total: 1,
      page: 1,
      limit: 20,
    })

    const res = await request(app).get('/api/properties/search?zip=78701')
    expect(res.status).toBe(200)
    expect(res.body.data.properties[0].state).toBe('TX')
  })

  it('Scenario 6: verifies standard market for low-risk TX property', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRiskProfile)
    ;(getCarriersForProperty as jest.Mock).mockResolvedValue(mockCarriers)

    const res = await request(app).get('/api/properties/prop-austin-1/carriers')
    expect(res.status).toBe(200)
    expect(res.body.data.marketCondition).toBe('MODERATE')
  })
})

// ─── Persona 4: Unauthorized User ───────��───────────────────────────��──────

describe('Persona: Unauthorized User', () => {
  it('Scenario 1: can search properties without auth', async () => {
    ;(searchProperties as jest.Mock).mockResolvedValue({
      properties: [mockPropertyData],
      total: 1,
      page: 1,
      limit: 20,
    })

    const res = await request(app).get('/api/properties/search?zip=78701')
    expect(res.status).toBe(200)
  })

  it('Scenario 2: can view risk profiles without auth', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue(mockRiskProfile)

    const res = await request(app).get('/api/properties/prop-austin-1/risk')
    expect(res.status).toBe(200)
  })

  it('Scenario 3: cannot save properties without auth (401)', async () => {
    const res = await request(app)
      .post('/api/properties/prop-austin-1/save')
      .send({ notes: 'test' })

    expect(res.status).toBe(401)
  })

  it('Scenario 4: cannot create quote requests without auth (401)', async () => {
    const res = await request(app)
      .post('/api/properties/prop-austin-1/quote-request')
      .send({ carrierId: 'state-farm', coverageTypes: ['HOMEOWNERS'] })

    expect(res.status).toBe(401)
  })

  it('Scenario 5: cannot access clients without auth (401)', async () => {
    const res = await request(app).get('/api/clients')
    expect(res.status).toBe(401)
  })

  it('Scenario 6: cannot create clients without auth (401)', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: 'Hacker', lastName: 'McHack', email: 'h@evil.com' })

    expect(res.status).toBe(401)
  })
})

// ─── Persona 5: Edge Cases & Error Scenarios ─────────────��──────────────────

describe('Persona: Edge Cases & Error Scenarios', () => {
  it('Scenario 1: property with no risk data returns defaults', async () => {
    ;(getOrComputeRiskProfile as jest.Mock).mockResolvedValue({
      ...mockRiskProfile,
      overallRiskScore: 25,
      overallRiskLevel: 'LOW',
    })

    const res = await request(app).get('/api/properties/prop-new/risk')
    expect(res.status).toBe(200)
    expect(res.body.data.overallRiskLevel).toBe('LOW')
  })

  it('Scenario 2: invalid property ID "undefined" returns 400', async () => {
    const res = await request(app).get('/api/properties/undefined')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('Scenario 3: invalid property ID "null" returns 400', async () => {
    const res = await request(app).get('/api/properties/null')
    expect(res.status).toBe(400)
  })

  it('Scenario 4: property not found returns 404', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(null)

    const res = await request(app).get('/api/properties/nonexistent-id')
    expect(res.status).toBe(404)
  })

  it('Scenario 5: report for nonexistent property returns 404', async () => {
    ;(getPropertyById as jest.Mock).mockResolvedValue(null)

    const res = await request(app).get('/api/properties/nonexistent-id/report')
    expect(res.status).toBe(404)
  })

  it('Scenario 6: search with no params returns 400', async () => {
    const res = await request(app).get('/api/properties/search')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('MISSING_PARAM')
  })

  it('Scenario 7: geocode failure returns 422', async () => {
    ;(geocodeAndCreateProperty as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/properties/geocode')
      .send({ placeId: 'invalid-place-id' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('GEOCODE_FAILED')
  })

  it('Scenario 8: saving non-existent property returns 404', async () => {
    mockAuth('user-edge')
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/properties/nonexistent/save')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({})

    expect(res.status).toBe(404)
  })

  it('Scenario 9: quote request for non-existent property returns 404', async () => {
    mockAuth('user-edge')
    ;(prisma.property.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await request(app)
      .post('/api/properties/nonexistent/quote-request')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ carrierId: 'state-farm', coverageTypes: ['HOMEOWNERS'] })

    expect(res.status).toBe(404)
  })

  it('Scenario 10: quote request with empty coverageTypes fails validation', async () => {
    mockAuth('user-edge')

    const res = await request(app)
      .post('/api/properties/prop-1/quote-request')
      .set('Authorization', `Bearer ${TOKEN}`)
      .send({ carrierId: 'state-farm', coverageTypes: [] })

    expect(res.status).not.toBe(201)
  })
})
