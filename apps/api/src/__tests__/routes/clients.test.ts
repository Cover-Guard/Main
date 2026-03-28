/**
 * clients route tests
 *
 * Tests the CRUD endpoints on /api/clients covering:
 *  - Authentication enforcement (401 without token)
 *  - GET / — list clients with pagination, savedPropertyCount
 *  - POST / — create client with validation, scoping to agentId
 *  - PATCH /:id — update with transaction, ownership scoping, 404, invalid ID
 *  - DELETE /:id — delete with ownership scoping, 404, invalid ID
 *  - Error propagation to error handler
 */

jest.mock('../../utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    client: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../utils/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { getUser: jest.fn() } },
}))

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: { stripeSubscriptionRequired: false },
}))

jest.mock('../../services/stripeService', () => ({
  hasActiveSubscription: jest.fn().mockResolvedValue(true),
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

import express from 'express'
import request from 'supertest'
import { clientsRouter } from '../../routes/clients'
import { errorHandler } from '../../middleware/errorHandler'
import { prisma } from '../../utils/prisma'
import { supabaseAdmin } from '../../utils/supabaseAdmin'

// ─── App setup ──────────────────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/api/clients', clientsRouter)
app.use(errorHandler)

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Each call generates a unique token so the auth middleware's in-process
 * LRUCache never serves a stale cached userId from a prior test.
 */
let tokenCounter = 0

function mockAuth(userId = 'user-1'): string {
  const token = `eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjk5OTk5OTk5OTl9.${++tokenCounter}`
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId, role: 'authenticated' } },
    error: null,
  })
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: userId,
    role: 'AGENT',
  })
  return `Bearer ${token}`
}

const sampleClient = {
  id: 'client-1',
  agentId: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '555-1234',
  notes: null,
  status: 'ACTIVE',
  createdAt: new Date('2026-03-01T00:00:00Z'),
  updatedAt: new Date('2026-03-01T00:00:00Z'),
}

const sampleClientWithCount = {
  ...sampleClient,
  _count: { savedProperties: 3 },
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('/api/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── Authentication ──────────────────────────────────────────────────────

  describe('authentication', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app).get('/api/clients')
      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    })
  })

  // ── GET /api/clients ────────────────────────────────────────────────────

  describe('GET /api/clients', () => {
    it('returns client list for authenticated user', async () => {
      const auth = mockAuth()
      ;(prisma.client.findMany as jest.Mock).mockResolvedValue([sampleClientWithCount])

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].firstName).toBe('Jane')
      expect(res.body.data[0].lastName).toBe('Doe')
    })

    it('includes savedPropertyCount from _count', async () => {
      const auth = mockAuth()
      ;(prisma.client.findMany as jest.Mock).mockResolvedValue([sampleClientWithCount])

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', auth)

      expect(res.body.data[0].savedPropertyCount).toBe(3)
      expect(res.body.data[0]._count).toBeUndefined()
    })

    it('respects pagination params (page, limit)', async () => {
      const auth = mockAuth()
      ;(prisma.client.findMany as jest.Mock).mockResolvedValue([])

      await request(app)
        .get('/api/clients?page=2&limit=10')
        .set('Authorization', auth)

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 10, // (page 2 - 1) * limit 10
        }),
      )
    })

    it('scopes query to authenticated user agentId', async () => {
      const auth = mockAuth('user-42')
      ;(prisma.client.findMany as jest.Mock).mockResolvedValue([])

      await request(app)
        .get('/api/clients')
        .set('Authorization', auth)

      expect(prisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agentId: 'user-42' },
        }),
      )
    })

    it('returns empty array when user has no clients', async () => {
      const auth = mockAuth()
      ;(prisma.client.findMany as jest.Mock).mockResolvedValue([])

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  // ── POST /api/clients ───────────────────────────────────────────────────

  describe('POST /api/clients', () => {
    const validBody = {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com',
      phone: '555-9999',
    }

    it('creates client with valid body and returns 201', async () => {
      const auth = mockAuth()
      ;(prisma.client.create as jest.Mock).mockResolvedValue({
        id: 'client-new',
        agentId: 'user-1',
        ...validBody,
        notes: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', auth)
        .send(validBody)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.firstName).toBe('John')
      expect(res.body.data.savedPropertyCount).toBe(0)
    })

    it('returns 400 for missing required fields', async () => {
      const auth = mockAuth()

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', auth)
        .send({ firstName: 'John' }) // missing lastName, email

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for invalid email', async () => {
      const auth = mockAuth()

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', auth)
        .send({ firstName: 'John', lastName: 'Smith', email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('scopes created client to authenticated user (agentId)', async () => {
      const auth = mockAuth('agent-99')
      ;(prisma.client.create as jest.Mock).mockResolvedValue({
        id: 'client-new',
        agentId: 'agent-99',
        ...validBody,
        notes: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await request(app)
        .post('/api/clients')
        .set('Authorization', auth)
        .send(validBody)

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ agentId: 'agent-99' }),
      })
    })
  })

  // ── PATCH /api/clients/:id ──────────────────────────────────────────────

  describe('PATCH /api/clients/:id', () => {
    it('updates client with valid partial body and returns 200', async () => {
      const auth = mockAuth()
      const updated = {
        ...sampleClient,
        firstName: 'Janet',
        _count: { savedProperties: 5 },
      }
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(updated),
          },
        }
        return fn(tx)
      })

      const res = await request(app)
        .patch('/api/clients/client-1')
        .set('Authorization', auth)
        .send({ firstName: 'Janet' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.firstName).toBe('Janet')
      expect(res.body.data.savedPropertyCount).toBe(5)
    })

    it('returns 404 when client not found', async () => {
      const auth = mockAuth()
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn(),
          },
        }
        return fn(tx)
      })

      const res = await request(app)
        .patch('/api/clients/nonexistent')
        .set('Authorization', auth)
        .send({ firstName: 'Janet' })

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for invalid ID (undefined)', async () => {
      const auth = mockAuth()

      const res = await request(app)
        .patch('/api/clients/undefined')
        .set('Authorization', auth)
        .send({ firstName: 'Janet' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('BAD_REQUEST')
    })

    it('only updates clients owned by the authenticated user', async () => {
      const auth = mockAuth('agent-7')
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue({
              ...sampleClient,
              agentId: 'agent-7',
              _count: { savedProperties: 0 },
            }),
          },
        }
        return fn(tx)
      })

      await request(app)
        .patch('/api/clients/client-1')
        .set('Authorization', auth)
        .send({ firstName: 'Updated' })

      // Replay the transaction callback with a spy to verify scoping
      const txFn = (prisma.$transaction as jest.Mock).mock.calls[0][0]
      const spyTx = {
        client: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findFirst: jest.fn().mockResolvedValue({
            ...sampleClient,
            _count: { savedProperties: 0 },
          }),
        },
      }
      await txFn(spyTx)

      expect(spyTx.client.updateMany).toHaveBeenCalledWith({
        where: { id: 'client-1', agentId: 'agent-7' },
        data: { firstName: 'Updated' },
      })
    })

    it('uses transaction for atomicity', async () => {
      const auth = mockAuth()
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue({
              ...sampleClient,
              _count: { savedProperties: 0 },
            }),
          },
        }
        return fn(tx)
      })

      await request(app)
        .patch('/api/clients/client-1')
        .set('Authorization', auth)
        .send({ status: 'CLOSED' })

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function))
    })
  })

  // ── DELETE /api/clients/:id ─────────────────────────────────────────────

  describe('DELETE /api/clients/:id', () => {
    it('deletes client and returns 200', async () => {
      const auth = mockAuth()
      ;(prisma.client.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

      const res = await request(app)
        .delete('/api/clients/client-1')
        .set('Authorization', auth)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toBeNull()
    })

    it('returns 404 when client not found', async () => {
      const auth = mockAuth()
      ;(prisma.client.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

      const res = await request(app)
        .delete('/api/clients/nonexistent')
        .set('Authorization', auth)

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for invalid ID (undefined)', async () => {
      const auth = mockAuth()

      const res = await request(app)
        .delete('/api/clients/undefined')
        .set('Authorization', auth)

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('BAD_REQUEST')
    })

    it('only deletes clients owned by the authenticated user', async () => {
      const auth = mockAuth('agent-5')
      ;(prisma.client.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

      await request(app)
        .delete('/api/clients/client-1')
        .set('Authorization', auth)

      expect(prisma.client.deleteMany).toHaveBeenCalledWith({
        where: { id: 'client-1', agentId: 'agent-5' },
      })
    })
  })

  // ── Error handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 when a DB query fails on GET', async () => {
      const auth = mockAuth()
      ;(prisma.client.findMany as jest.Mock).mockRejectedValue(new Error('DB down'))

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', auth)

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })

    it('returns 500 when a DB query fails on POST', async () => {
      const auth = mockAuth()
      ;(prisma.client.create as jest.Mock).mockRejectedValue(new Error('DB down'))

      const res = await request(app)
        .post('/api/clients')
        .set('Authorization', auth)
        .send({ firstName: 'A', lastName: 'B', email: 'a@b.com' })

      expect(res.status).toBe(500)
      expect(res.body.success).toBe(false)
    })
  })
})
