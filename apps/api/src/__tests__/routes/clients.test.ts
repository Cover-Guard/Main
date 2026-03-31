/**
 * /api/clients endpoint tests
 *
 * Covers:
 *  - GET /  — paginated client list with savedPropertyCount
 *  - POST / — create client with validation
 *  - PATCH /:id — update client with ownership check
 *  - DELETE /:id — delete client with ownership check
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
    client: {
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('../../middleware/auth', () => ({
  requireAuth: jest.fn((req: any, _res: any, next: any) => {
    req.userId = 'agent-1'
    req.userRole = 'AGENT'
    next()
  }),
}))

jest.mock('../../middleware/subscription', () => ({
  requireSubscription: jest.fn((_req: any, _res: any, next: any) => {
    next()
  }),
}))

jest.mock('../../utils/featureFlags', () => ({
  featureFlags: {
    stripeSubscriptionRequired: false,
  },
}))

import express from 'express'
import request from 'supertest'
import { clientsRouter } from '../../routes/clients'
import { errorHandler } from '../../middleware/errorHandler'
import { prisma } from '../../utils/prisma'

const app = express()
app.use(express.json())
app.use('/api/clients', clientsRouter)
app.use(errorHandler)

const mockPrisma = prisma as any

const sampleClient = {
  id: 'client-1',
  agentId: 'agent-1',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane@example.com',
  phone: '555-1234',
  notes: null,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('/api/clients', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── GET / — List clients ────────────────────────────────────────────────

  describe('GET /', () => {
    it('returns paginated list with savedPropertyCount', async () => {
      mockPrisma.client.findMany.mockResolvedValue([
        { ...sampleClient, _count: { savedProperties: 3 } },
      ])

      const res = await request(app).get('/api/clients')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].savedPropertyCount).toBe(3)
      expect(res.body.data[0]._count).toBeUndefined()
    })

    it('passes custom page and limit params', async () => {
      mockPrisma.client.findMany.mockResolvedValue([])

      await request(app).get('/api/clients?page=2&limit=10')

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 10, // (page 2 - 1) * 10
        }),
      )
    })

    it('clamps page and limit to valid ranges', async () => {
      mockPrisma.client.findMany.mockResolvedValue([])

      await request(app).get('/api/clients?page=-5&limit=999')

      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100, // max 100
          skip: 0,   // page clamped to 1 → (1-1)*100
        }),
      )
    })
  })

  // ── POST / — Create client ──────────────────────────────────────────────

  describe('POST /', () => {
    const validBody = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
    }

    it('creates client with valid data', async () => {
      mockPrisma.client.create.mockResolvedValue(sampleClient)

      const res = await request(app)
        .post('/api/clients')
        .send(validBody)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.savedPropertyCount).toBe(0)
      expect(mockPrisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agentId: 'agent-1',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
          }),
        }),
      )
    })

    it('returns 400 when firstName is missing', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({ lastName: 'Smith', email: 'jane@example.com' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({ ...validBody, email: 'not-an-email' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── PATCH /:id — Update client ──────────────────────────────────────────

  describe('PATCH /:id', () => {
    it('updates client successfully', async () => {
      const updatedClient = {
        ...sampleClient,
        firstName: 'Janet',
        _count: { savedProperties: 2 },
      }

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(updatedClient),
          },
        }
        return cb(tx)
      })

      const res = await request(app)
        .patch('/api/clients/client-1')
        .send({ firstName: 'Janet' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.firstName).toBe('Janet')
      expect(res.body.data.savedPropertyCount).toBe(2)
    })

    it('returns 404 when client not owned by user', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
            findFirst: jest.fn(),
          },
        }
        return cb(tx)
      })

      const res = await request(app)
        .patch('/api/clients/other-client')
        .send({ firstName: 'Hacker' })

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for id=undefined', async () => {
      const res = await request(app)
        .patch('/api/clients/undefined')
        .send({ firstName: 'Test' })

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('BAD_REQUEST')
    })

    it('updates status to valid enum values', async () => {
      const updatedClient = {
        ...sampleClient,
        status: 'CLOSED',
        _count: { savedProperties: 0 },
      }

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          client: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findFirst: jest.fn().mockResolvedValue(updatedClient),
          },
        }
        return cb(tx)
      })

      const res = await request(app)
        .patch('/api/clients/client-1')
        .send({ status: 'CLOSED' })

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('CLOSED')
    })
  })

  // ── DELETE /:id — Delete client ─────────────────────────────────────────

  describe('DELETE /:id', () => {
    it('deletes client successfully', async () => {
      mockPrisma.client.deleteMany.mockResolvedValue({ count: 1 })

      const res = await request(app).delete('/api/clients/client-1')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toBeNull()
      expect(mockPrisma.client.deleteMany).toHaveBeenCalledWith({
        where: { id: 'client-1', agentId: 'agent-1' },
      })
    })

    it('returns 404 when client not found', async () => {
      mockPrisma.client.deleteMany.mockResolvedValue({ count: 0 })

      const res = await request(app).delete('/api/clients/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })

    it('returns 400 for id=undefined', async () => {
      const res = await request(app).delete('/api/clients/undefined')

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('BAD_REQUEST')
    })
  })
})
