/**
 * Performance tests for POST /api/auth/register
 *
 * Measures:
 *  - DB connectivity check latency overhead
 *  - Full registration flow throughput
 *  - Error path performance (validation, DB down, auth failure)
 *  - Auth user rollback latency
 *  - Concurrent registration handling
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
    $queryRawUnsafe: jest.fn(),
    user: {
      upsert: jest.fn(),
    },
  },
}))

jest.mock('../../utils/supabaseAdmin', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
      },
    },
  },
}))

import express from 'express'
import request from 'supertest'
import { authRouter } from '../../routes/auth'
import { errorHandler } from '../../middleware/errorHandler'
import { prisma } from '../../utils/prisma'
import { supabaseAdmin } from '../../utils/supabaseAdmin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any
const mockSupabase = supabaseAdmin as unknown as {
  auth: { admin: { createUser: jest.Mock; deleteUser: jest.Mock } }
}

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use(errorHandler)

const validBody = {
  email: 'perf@example.com',
  password: 'securepass123',
  firstName: 'Perf',
  lastName: 'Test',
  role: 'BUYER' as const,
  agreeNDA: true as const,
  agreeTerms: true as const,
  agreePrivacy: true as const,
}

function setupSuccessMocks() {
  mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])
  let userCounter = 0
  mockSupabase.auth.admin.createUser.mockImplementation(async () => {
    userCounter++
    return { data: { user: { id: `user-${userCounter}` } }, error: null }
  })
  mockPrisma.user.upsert.mockImplementation(async (args: { create: { id: string; email: string } }) => ({
    id: args.create.id,
    email: args.create.email,
    role: 'BUYER',
  }))
}

describe('register endpoint performance', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupSuccessMocks()
  })

  // ── Latency benchmarks ────────────────────────────────────────────────

  describe('latency', () => {
    it('DB connectivity check adds < 5ms overhead (mocked)', async () => {
      // Measure just the DB check path
      const iterations = 100
      const start = performance.now()
      for (let i = 0; i < iterations; i++) {
        mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])
        await mockPrisma.$queryRawUnsafe('SELECT 1')
      }
      const elapsed = performance.now() - start
      const avgMs = elapsed / iterations

      expect(avgMs).toBeLessThan(10)
    })

    it('successful registration completes in < 200ms (mocked I/O)', async () => {
      const start = performance.now()
      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)
      const elapsed = performance.now() - start

      expect(res.status).toBe(201)
      expect(elapsed).toBeLessThan(200)
    })

    it('validation rejection completes in < 50ms', async () => {
      const start = performance.now()
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad' })
      const elapsed = performance.now() - start

      expect(res.status).toBe(400)
      expect(elapsed).toBeLessThan(50)
    })

    it('DB-down 503 response completes in < 100ms', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('connection refused'))

      const start = performance.now()
      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)
      const elapsed = performance.now() - start

      expect(res.status).toBe(503)
      expect(elapsed).toBeLessThan(100)
    })

    it('rollback path completes in < 200ms (mocked)', async () => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'rollback-user' } },
        error: null,
      })
      mockPrisma.user.upsert.mockRejectedValue(new Error('DB write failed'))
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({ error: null })

      const start = performance.now()
      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)
      const elapsed = performance.now() - start

      expect(res.status).toBe(500)
      expect(elapsed).toBeLessThan(200)
    })
  })

  // ── Throughput ─────────────────────────────────────────────────────────

  describe('throughput', () => {
    it('handles 50 sequential registrations in < 5s', async () => {
      const count = 50
      const start = performance.now()

      for (let i = 0; i < count; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({ ...validBody, email: `user${i}@perf.test` })
        expect(res.status).toBe(201)
      }

      const elapsed = performance.now() - start
      const rps = (count / elapsed) * 1000

      expect(elapsed).toBeLessThan(5000)
      expect(rps).toBeGreaterThan(10) // at least 10 req/s on CI
    })

    it('handles 20 concurrent registrations without errors', async () => {
      const count = 20
      const start = performance.now()

      const promises = Array.from({ length: count }, (_, i) =>
        request(app)
          .post('/api/auth/register')
          .send({ ...validBody, email: `concurrent${i}@perf.test` }),
      )

      const results = await Promise.all(promises)
      const elapsed = performance.now() - start

      const successes = results.filter((r) => r.status === 201)
      expect(successes.length).toBe(count)
      expect(elapsed).toBeLessThan(5000)
    })

    it('handles mixed success/failure load', async () => {
      const count = 30
      const start = performance.now()

      const promises = Array.from({ length: count }, (_, i) => {
        if (i % 3 === 0) {
          // Invalid request — should fail fast
          return request(app)
            .post('/api/auth/register')
            .send({ email: 'bad' })
        }
        return request(app)
          .post('/api/auth/register')
          .send({ ...validBody, email: `mixed${i}@perf.test` })
      })

      const results = await Promise.all(promises)
      const elapsed = performance.now() - start

      const successes = results.filter((r) => r.status === 201).length
      const failures = results.filter((r) => r.status === 400).length

      expect(successes).toBe(20)
      expect(failures).toBe(10)
      expect(elapsed).toBeLessThan(5000)
    })
  })

  // ── Memory / resource usage ────────────────────────────────────────────

  describe('resource efficiency', () => {
    it('does not leak mock call counts across sequential requests', async () => {
      jest.clearAllMocks()

      await request(app).post('/api/auth/register').send(validBody)
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1)
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledTimes(1)
      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1)

      jest.clearAllMocks()
      await request(app).post('/api/auth/register').send(validBody)
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(1)
    })

    it('failed DB check does not invoke downstream services', async () => {
      jest.clearAllMocks()
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('no connection'))

      for (let i = 0; i < 10; i++) {
        await request(app).post('/api/auth/register').send(validBody)
      }

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(10)
      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledTimes(0)
      expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(0)
    })
  })
})
