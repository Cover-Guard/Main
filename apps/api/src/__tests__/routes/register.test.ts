/**
 * POST /api/auth/register endpoint tests
 *
 * Covers:
 *  - DB connectivity check before creating auth user (prevents orphaned records)
 *  - Auth user rollback when profile creation fails
 *  - Successful registration flow
 *  - Zod validation errors
 *  - Duplicate email handling
 *  - 503 response when DB is unavailable
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

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use(errorHandler)

const validBody = {
  email: 'test@example.com',
  password: 'securepass123',
  firstName: 'John',
  lastName: 'Doe',
  role: 'BUYER',
}

 
const mockPrisma = prisma as any
const mockSupabase = supabaseAdmin as unknown as {
  auth: {
    admin: {
      createUser: jest.Mock
      deleteUser: jest.Mock
    }
  }
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: DB is healthy
    mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])
  })

  // ── Validation ──────────────────────────────────────────────────────────

  describe('request validation', () => {
    it('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@test.com' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, email: 'not-an-email' })

      expect(res.status).toBe(400)
    })

    it('returns 400 for short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, password: 'short' })

      expect(res.status).toBe(400)
    })

    // NDA, terms, and privacy agreements are now handled during onboarding
    // (POST /me/terms), not at registration time.

    it('returns 400 for invalid role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, role: 'SUPERADMIN' })

      expect(res.status).toBe(400)
    })
  })

  // ── DB connectivity check ───────────────────────────────────────────────

  describe('database connectivity check', () => {
    it('returns 503 when DB is unreachable', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(
        new Error('Database connection string is not configured'),
      )

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE')
    })

    it('does NOT call supabaseAdmin.createUser when DB is down', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('connection refused'))

      await request(app).post('/api/auth/register').send(validBody)

      expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled()
    })

    it('returns 503 for connection timeout errors', async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error('Connection timed out'))

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(res.status).toBe(503)
    })

    it('proceeds to create auth user when DB check passes', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        role: 'BUYER',
      })

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(mockSupabase.auth.admin.createUser).toHaveBeenCalledTimes(1)
      expect(res.status).toBe(201)
    })
  })

  // ── Supabase auth errors ────────────────────────────────────────────────

  describe('Supabase auth errors', () => {
    it('returns 409 for duplicate email', async () => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User already registered' },
      })

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL')
    })

    it('returns 400 for generic auth error', async () => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth service unavailable' },
      })

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('AUTH_ERROR')
    })
  })

  // ── Auth user rollback ──────────────────────────────────────────────────

  describe('auth user rollback on profile failure', () => {
    beforeEach(() => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'user-456' } },
        error: null,
      })
    })

    it('deletes auth user when prisma upsert fails', async () => {
      mockPrisma.user.upsert.mockRejectedValue(new Error('DB write failed'))
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({ error: null })

      await request(app).post('/api/auth/register').send(validBody)

      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-456')
    })

    it('returns 500 when profile creation fails', async () => {
      mockPrisma.user.upsert.mockRejectedValue(new Error('DB write failed'))
      mockSupabase.auth.admin.deleteUser.mockResolvedValue({ error: null })

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(res.status).toBe(500)
    })

    it('still returns error even if auth user cleanup fails', async () => {
      mockPrisma.user.upsert.mockRejectedValue(new Error('DB write failed'))
      mockSupabase.auth.admin.deleteUser.mockRejectedValue(new Error('Delete failed'))

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      // Should not crash — the cleanup error is logged, original error returned
      expect(res.status).toBe(500)
      expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-456')
    })

    it('does NOT delete auth user on successful registration', async () => {
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-456',
        email: validBody.email,
        role: 'BUYER',
      })

      await request(app).post('/api/auth/register').send(validBody)

      expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled()
    })
  })

  // ── Successful registration ─────────────────────────────────────────────

  describe('successful registration', () => {
    beforeEach(() => {
      mockSupabase.auth.admin.createUser.mockResolvedValue({
        data: { user: { id: 'new-user-789' } },
        error: null,
      })
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'new-user-789',
        email: validBody.email,
        role: 'BUYER',
      })
    })

    it('returns 201 with user data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody)

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual({
        id: 'new-user-789',
        email: validBody.email,
        role: 'BUYER',
      })
    })

    it('does NOT set agreement timestamps in Supabase metadata (deferred to onboarding)', async () => {
      await request(app).post('/api/auth/register').send(validBody)

      const createCall = mockSupabase.auth.admin.createUser.mock.calls[0][0]
      expect(createCall.user_metadata.termsAcceptedAt).toBeUndefined()
      expect(createCall.user_metadata.ndaAcceptedAt).toBeUndefined()
      expect(createCall.user_metadata.privacyAcceptedAt).toBeUndefined()
    })

    it('does NOT set agreement timestamps in Prisma profile (deferred to onboarding)', async () => {
      await request(app).post('/api/auth/register').send(validBody)

      const upsertCall = mockPrisma.user.upsert.mock.calls[0][0]
      expect(upsertCall.create.termsAcceptedAt).toBeUndefined()
      expect(upsertCall.create.ndaAcceptedAt).toBeUndefined()
      expect(upsertCall.create.privacyAcceptedAt).toBeUndefined()
    })

    it('uses upsert to handle trigger race condition', async () => {
      await request(app).post('/api/auth/register').send(validBody)

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'new-user-789' },
          update: expect.any(Object),
          create: expect.objectContaining({ id: 'new-user-789' }),
        }),
      )
    })

    it('accepts AGENT role', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, role: 'AGENT', company: 'RE/MAX' })

      const createCall = mockSupabase.auth.admin.createUser.mock.calls[0][0]
      expect(createCall.user_metadata.role).toBe('AGENT')
      expect(createCall.user_metadata.company).toBe('RE/MAX')
    })

    it('accepts LENDER role', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, role: 'LENDER', licenseNumber: 'LIC-123' })

      const createCall = mockSupabase.auth.admin.createUser.mock.calls[0][0]
      expect(createCall.user_metadata.role).toBe('LENDER')
    })
  })
})
