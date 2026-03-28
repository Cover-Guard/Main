/**
 * analytics route tests
 *
 * Tests the GET /api/analytics endpoint covering:
 *  - Successful response shape and all fields
 *  - Searches-by-day gap-filling (30 days)
 *  - Searches-by-month gap-filling (12 months)
 *  - Risk distribution filtering and ordering
 *  - Quote request status aggregation
 *  - Client pipeline aggregation
 *  - Regional risk mapping
 *  - Average insurance cost handling (present and null)
 *  - Recent activity merging and sorting
 *  - BigInt count conversion
 *  - Empty data scenarios (new user with no data)
 *  - Database error propagation
 */

jest.mock('../../utils/prisma', () => {
  const mockPrisma = {
    savedProperty: { count: jest.fn(), findMany: jest.fn() },
    client: { count: jest.fn(), groupBy: jest.fn() },
    propertyReport: { count: jest.fn(), findMany: jest.fn() },
    searchHistory: { count: jest.fn(), findMany: jest.fn() },
    quoteRequest: { groupBy: jest.fn() },
    $queryRaw: jest.fn(),
  }
  return { prisma: mockPrisma }
})

jest.mock('../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => {
    ;(_req as Record<string, unknown>).userId = 'test-user-id'
    ;(_req as Record<string, unknown>).userRole = 'AGENT'
    next()
  },
}))

jest.mock('../../middleware/subscription', () => ({
  requireSubscription: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import express from 'express'
import request from 'supertest'
import { analyticsRouter } from '../../routes/analytics'
import { prisma } from '../../utils/prisma'

// ─── App setup ──────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/api/analytics', analyticsRouter)
// Express error handlers require all 4 params to be recognized as error middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ success: false, error: { message: err.message } })
})

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockSavedCount = prisma.savedProperty.count as jest.Mock
const mockClientCount = prisma.client.count as jest.Mock
const mockReportCount = prisma.propertyReport.count as jest.Mock
const mockSearchCount = prisma.searchHistory.count as jest.Mock
const mockSearchFindMany = prisma.searchHistory.findMany as jest.Mock
const mockSavedFindMany = prisma.savedProperty.findMany as jest.Mock
const mockReportFindMany = prisma.propertyReport.findMany as jest.Mock
const mockQuoteGroupBy = prisma.quoteRequest.groupBy as jest.Mock
const mockClientGroupBy = prisma.client.groupBy as jest.Mock
const mockQueryRaw = prisma.$queryRaw as jest.Mock

function setupDefaultMocks() {
  mockSavedCount.mockResolvedValue(3)
  mockClientCount.mockResolvedValue(2)
  mockReportCount.mockResolvedValue(1)
  mockSearchCount.mockResolvedValue(10)

  // Raw queries: searchesByDay, riskDistribution, topStates, regionalRisk, searchesByMonth, avgInsuranceCost
  mockQueryRaw
    .mockResolvedValueOnce([]) // searchesByDay
    .mockResolvedValueOnce([  // riskDistribution
      { level: 'LOW', count: BigInt(2) },
      { level: 'HIGH', count: BigInt(1) },
    ])
    .mockResolvedValueOnce([  // topStates
      { state: 'CA', count: BigInt(2) },
      { state: 'TX', count: BigInt(1) },
    ])
    .mockResolvedValueOnce([  // regionalRisk
      {
        state: 'CA',
        property_count: BigInt(2),
        avg_overall: '45.3',
        avg_flood: '20.1',
        avg_fire: '65.0',
        avg_wind: '30.5',
        avg_earthquake: '55.2',
        avg_crime: '25.8',
        dominant_level: 'MODERATE',
      },
    ])
    .mockResolvedValueOnce([]) // searchesByMonth
    .mockResolvedValueOnce([{ avg_cost: '2500' }]) // avgInsuranceCost

  mockSearchFindMany.mockResolvedValue([
    { query: 'test search', searchedAt: new Date('2026-03-27T10:00:00Z') },
  ])

  mockSavedFindMany.mockResolvedValue([
    {
      property: { address: '123 Main St', city: 'Springfield' },
      savedAt: new Date('2026-03-27T11:00:00Z'),
    },
  ])

  mockReportFindMany.mockResolvedValue([
    { reportType: 'FULL', generatedAt: new Date('2026-03-27T09:00:00Z') },
  ])

  mockQuoteGroupBy.mockResolvedValue([
    { status: 'PENDING', _count: { _all: 2 } },
    { status: 'SENT', _count: { _all: 1 } },
  ])

  mockClientGroupBy.mockResolvedValue([
    { status: 'ACTIVE', _count: { _all: 1 } },
    { status: 'PROSPECT', _count: { _all: 1 } },
  ])
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDefaultMocks()
  })

  // ── Response shape ─────────────────────────────────────────────────────

  describe('response shape', () => {
    it('returns 200 with success: true', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('returns all top-level data fields', async () => {
      const res = await request(app).get('/api/analytics')
      const { data } = res.body
      expect(data).toHaveProperty('totalSearches')
      expect(data).toHaveProperty('totalSavedProperties')
      expect(data).toHaveProperty('totalClients')
      expect(data).toHaveProperty('totalReports')
      expect(data).toHaveProperty('searchesByDay')
      expect(data).toHaveProperty('riskDistribution')
      expect(data).toHaveProperty('topStates')
      expect(data).toHaveProperty('recentActivity')
      expect(data).toHaveProperty('quoteRequests')
      expect(data).toHaveProperty('clientPipeline')
      expect(data).toHaveProperty('regionalRisk')
      expect(data).toHaveProperty('searchesByMonth')
      expect(data).toHaveProperty('avgInsuranceCost')
    })

    it('returns correct count values', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.totalSearches).toBe(10)
      expect(res.body.data.totalSavedProperties).toBe(3)
      expect(res.body.data.totalClients).toBe(2)
      expect(res.body.data.totalReports).toBe(1)
    })
  })

  // ── Searches by day ────────────────────────────────────────────────────

  describe('searchesByDay', () => {
    it('returns exactly 30 entries', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.searchesByDay).toHaveLength(30)
    })

    it('fills gaps with count 0', async () => {
      const res = await request(app).get('/api/analytics')
      const allZero = res.body.data.searchesByDay.every(
        (d: { count: number }) => d.count === 0,
      )
      expect(allZero).toBe(true) // no search data in mock
    })

    it('each entry has date and count fields', async () => {
      const res = await request(app).get('/api/analytics')
      for (const entry of res.body.data.searchesByDay) {
        expect(entry).toHaveProperty('date')
        expect(entry).toHaveProperty('count')
        expect(typeof entry.date).toBe('string')
        expect(typeof entry.count).toBe('number')
      }
    })

    it('dates are in YYYY-MM-DD format', async () => {
      const res = await request(app).get('/api/analytics')
      for (const entry of res.body.data.searchesByDay) {
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })
  })

  // ── Searches by month ──────────────────────────────────────────────────

  describe('searchesByMonth', () => {
    it('returns exactly 12 entries', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.searchesByMonth).toHaveLength(12)
    })

    it('each entry has month and count fields', async () => {
      const res = await request(app).get('/api/analytics')
      for (const entry of res.body.data.searchesByMonth) {
        expect(entry).toHaveProperty('month')
        expect(entry).toHaveProperty('count')
        expect(entry.month).toMatch(/^\d{4}-\d{2}$/)
      }
    })
  })

  // ── Risk distribution ──────────────────────────────────────────────────

  describe('riskDistribution', () => {
    it('converts BigInt counts to numbers', async () => {
      const res = await request(app).get('/api/analytics')
      for (const entry of res.body.data.riskDistribution) {
        expect(typeof entry.count).toBe('number')
      }
    })

    it('orders by risk level (LOW before HIGH)', async () => {
      const res = await request(app).get('/api/analytics')
      const levels = res.body.data.riskDistribution.map(
        (r: { level: string }) => r.level,
      )
      expect(levels).toEqual(['LOW', 'HIGH'])
    })

    it('filters out null risk levels', async () => {
      mockQueryRaw
        .mockReset()
        .mockResolvedValueOnce([]) // searchesByDay
        .mockResolvedValueOnce([
          { level: null, count: BigInt(1) },
          { level: 'LOW', count: BigInt(2) },
        ])
        .mockResolvedValueOnce([]) // topStates
        .mockResolvedValueOnce([]) // regionalRisk
        .mockResolvedValueOnce([]) // searchesByMonth
        .mockResolvedValueOnce([{ avg_cost: null }]) // avgInsuranceCost

      const res = await request(app).get('/api/analytics')
      const levels = res.body.data.riskDistribution.map(
        (r: { level: string }) => r.level,
      )
      expect(levels).not.toContain(null)
    })
  })

  // ── Top states ─────────────────────────────────────────────────────────

  describe('topStates', () => {
    it('converts BigInt counts to numbers', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.topStates).toEqual([
        { state: 'CA', count: 2 },
        { state: 'TX', count: 1 },
      ])
    })
  })

  // ── Quote requests ─────────────────────────────────────────────────────

  describe('quoteRequests', () => {
    it('aggregates status counts correctly', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.quoteRequests).toEqual({
        total: 3,
        pending: 2,
        sent: 1,
        responded: 0,
        declined: 0,
      })
    })

    it('defaults missing statuses to 0', async () => {
      mockQuoteGroupBy.mockResolvedValue([])
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.quoteRequests).toEqual({
        total: 0,
        pending: 0,
        sent: 0,
        responded: 0,
        declined: 0,
      })
    })
  })

  // ── Client pipeline ────────────────────────────────────────────────────

  describe('clientPipeline', () => {
    it('aggregates status counts correctly', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.clientPipeline).toEqual({
        active: 1,
        prospect: 1,
        closed: 0,
        inactive: 0,
      })
    })

    it('defaults all statuses to 0 when no clients', async () => {
      mockClientGroupBy.mockResolvedValue([])
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.clientPipeline).toEqual({
        active: 0,
        prospect: 0,
        closed: 0,
        inactive: 0,
      })
    })
  })

  // ── Regional risk ──────────────────────────────────────────────────────

  describe('regionalRisk', () => {
    it('maps raw DB fields to camelCase response', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.regionalRisk).toEqual([
        {
          state: 'CA',
          propertyCount: 2,
          avgOverallScore: 45.3,
          avgFloodScore: 20.1,
          avgFireScore: 65,
          avgWindScore: 30.5,
          avgEarthquakeScore: 55.2,
          avgCrimeScore: 25.8,
          dominantRiskLevel: 'MODERATE',
        },
      ])
    })

    it('returns empty array when no saved properties have risk data', async () => {
      mockQueryRaw
        .mockReset()
        .mockResolvedValueOnce([]) // searchesByDay
        .mockResolvedValueOnce([]) // riskDistribution
        .mockResolvedValueOnce([]) // topStates
        .mockResolvedValueOnce([]) // regionalRisk
        .mockResolvedValueOnce([]) // searchesByMonth
        .mockResolvedValueOnce([{ avg_cost: null }])

      const res = await request(app).get('/api/analytics')
      expect(res.body.data.regionalRisk).toEqual([])
    })
  })

  // ── Average insurance cost ─────────────────────────────────────────────

  describe('avgInsuranceCost', () => {
    it('returns numeric cost when data exists', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.avgInsuranceCost).toBe(2500)
    })

    it('returns null when no insurance estimates exist', async () => {
      mockQueryRaw
        .mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ avg_cost: null }])

      const res = await request(app).get('/api/analytics')
      expect(res.body.data.avgInsuranceCost).toBeNull()
    })

    it('returns null when result set is empty', async () => {
      mockQueryRaw
        .mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const res = await request(app).get('/api/analytics')
      expect(res.body.data.avgInsuranceCost).toBeNull()
    })
  })

  // ── Recent activity ────────────────────────────────────────────────────

  describe('recentActivity', () => {
    it('merges and sorts activities by timestamp descending', async () => {
      const res = await request(app).get('/api/analytics')
      const activity = res.body.data.recentActivity
      // savedAt 11:00 > searchedAt 10:00 > generatedAt 09:00
      expect(activity[0].type).toBe('save')
      expect(activity[1].type).toBe('search')
      expect(activity[2].type).toBe('report')
    })

    it('formats search descriptions with query text', async () => {
      const res = await request(app).get('/api/analytics')
      const searchItem = res.body.data.recentActivity.find(
        (a: { type: string }) => a.type === 'search',
      )
      expect(searchItem.description).toBe('Searched "test search"')
    })

    it('formats save descriptions with address and city', async () => {
      const res = await request(app).get('/api/analytics')
      const saveItem = res.body.data.recentActivity.find(
        (a: { type: string }) => a.type === 'save',
      )
      expect(saveItem.description).toBe('Saved 123 Main St, Springfield')
    })

    it('formats report descriptions with type', async () => {
      const res = await request(app).get('/api/analytics')
      const reportItem = res.body.data.recentActivity.find(
        (a: { type: string }) => a.type === 'report',
      )
      expect(reportItem.description).toBe('Generated full report')
    })

    it('each activity has type, description, and timestamp', async () => {
      const res = await request(app).get('/api/analytics')
      for (const item of res.body.data.recentActivity) {
        expect(item).toHaveProperty('type')
        expect(item).toHaveProperty('description')
        expect(item).toHaveProperty('timestamp')
      }
    })
  })

  // ── Empty user scenario ────────────────────────────────────────────────

  describe('empty user (no data)', () => {
    beforeEach(() => {
      mockSavedCount.mockResolvedValue(0)
      mockClientCount.mockResolvedValue(0)
      mockReportCount.mockResolvedValue(0)
      mockSearchCount.mockResolvedValue(0)
      mockQueryRaw
        .mockReset()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ avg_cost: null }])
      mockSearchFindMany.mockResolvedValue([])
      mockSavedFindMany.mockResolvedValue([])
      mockReportFindMany.mockResolvedValue([])
      mockQuoteGroupBy.mockResolvedValue([])
      mockClientGroupBy.mockResolvedValue([])
    })

    it('returns 200 with all zeroes', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.status).toBe(200)
      expect(res.body.data.totalSearches).toBe(0)
      expect(res.body.data.totalSavedProperties).toBe(0)
      expect(res.body.data.totalClients).toBe(0)
      expect(res.body.data.totalReports).toBe(0)
    })

    it('returns empty arrays for list fields', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.riskDistribution).toEqual([])
      expect(res.body.data.topStates).toEqual([])
      expect(res.body.data.regionalRisk).toEqual([])
      expect(res.body.data.recentActivity).toEqual([])
    })

    it('still returns 30 searchesByDay entries (all zero)', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.searchesByDay).toHaveLength(30)
      expect(
        res.body.data.searchesByDay.every((d: { count: number }) => d.count === 0),
      ).toBe(true)
    })

    it('still returns 12 searchesByMonth entries (all zero)', async () => {
      const res = await request(app).get('/api/analytics')
      expect(res.body.data.searchesByMonth).toHaveLength(12)
    })
  })

  // ── Error handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 when a DB query fails', async () => {
      mockSavedCount.mockRejectedValue(new Error('DB connection failed'))
      const res = await request(app).get('/api/analytics')
      expect(res.status).toBe(500)
    })

    it('propagates error to error handler', async () => {
      mockSearchCount.mockRejectedValue(new Error('timeout'))
      const res = await request(app).get('/api/analytics')
      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })
})
