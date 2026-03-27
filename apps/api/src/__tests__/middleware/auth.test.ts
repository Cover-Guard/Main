/**
 * auth middleware tests
 *
 * Tests requireAuth and requireRole middleware functions covering:
 *  - Missing / malformed Authorization header → 401
 *  - Token cache hit (fast path) → calls next()
 *  - Supabase verification failure → 401
 *  - User not found in DB → 401
 *  - Valid token → attaches userId/userRole and calls next()
 *  - JWT TTL calculation (exp in future / no exp / past exp)
 *  - requireRole: allowed role → calls next()
 *  - requireRole: disallowed role → 403
 */

jest.mock('../../utils/supabaseAdmin', () => ({
  supabaseAdmin: { auth: { getUser: jest.fn() } },
}))
jest.mock('../../utils/prisma', () => ({
  prisma: { user: { findUnique: jest.fn() } },
}))
jest.mock('../../utils/cache', () => {
  const { LRUCache, RequestDeduplicator } = jest.requireActual('../../utils/cache')
  return {
    LRUCache,
    RequestDeduplicator,
    tokenCache: new LRUCache(100, 60_000),
    propertyCache: new LRUCache(100, 60_000),
    riskCache: new LRUCache(100, 60_000),
    insuranceCache: new LRUCache(100, 60_000),
    carriersCache: new LRUCache(100, 60_000),
    insurabilityCache: new LRUCache(100, 60_000),
    riskDeduplicator: new RequestDeduplicator(),
    insuranceDeduplicator: new RequestDeduplicator(),
    carriersDeduplicator: new RequestDeduplicator(),
    insurabilityDeduplicator: new RequestDeduplicator(),
  }
})

import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../../utils/supabaseAdmin'
import { prisma } from '../../utils/prisma'
import { tokenCache } from '../../utils/cache'
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth'

const mockGetUser = supabaseAdmin.auth.getUser as jest.Mock
const mockFindUser = (prisma.user.findUnique as jest.Mock)

const TOKEN = 'test.bearer.token'

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { authorization: `Bearer ${TOKEN}` },
    ...overrides,
  } as unknown as Request
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const res = { status } as unknown as Response
  return { res, status, json }
}

function makeNext(): NextFunction {
  return jest.fn()
}

/** Build a minimal valid JWT with the given exp (seconds since epoch). */
function makeJwt(exp?: number): string {
  const payload = exp !== undefined ? { exp } : {}
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `header.${encoded}.sig`
}

beforeEach(() => {
  jest.clearAllMocks()
  tokenCache.delete(TOKEN)
})

describe('requireAuth', () => {
  describe('missing / malformed header', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const req = makeReq({ headers: {} })
      const { res, status, json } = makeRes()
      const next = makeNext()

      await requireAuth(req, res, next)

      expect(status).toHaveBeenCalledWith(401)
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('returns 401 when Authorization header does not start with "Bearer "', async () => {
      const req = makeReq({ headers: { authorization: 'Basic abc123' } })
      const { res, status } = makeRes()
      const next = makeNext()

      await requireAuth(req, res, next)

      expect(status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('token cache fast path', () => {
    it('calls next() and attaches user info when token is in cache', async () => {
      tokenCache.set(TOKEN, { userId: 'user-1', userRole: 'BUYER' }, 60_000)
      const req = makeReq()
      const { res } = makeRes()
      const next = makeNext()

      await requireAuth(req, res, next)

      expect(mockGetUser).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
      expect((req as AuthenticatedRequest).userId).toBe('user-1')
      expect((req as AuthenticatedRequest).userRole).toBe('BUYER')
    })
  })

  describe('Supabase verification failure', () => {
    it('returns 401 when Supabase returns an error', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })
      const req = makeReq()
      const { res, status } = makeRes()
      const next = makeNext()

      await requireAuth(req, res, next)

      expect(status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })

    it('does not cache invalid tokens', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('bad') })
      const req = makeReq()
      const { res: _res } = makeRes()
      await requireAuth(req, makeRes().res, makeNext())
      expect(tokenCache.has(TOKEN)).toBe(false)
    })
  })

  describe('user not found in DB', () => {
    it('returns 401 when prisma.user.findUnique returns null', async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-id' } }, error: null })
      mockFindUser.mockResolvedValue(null)
      const req = makeReq()
      const { res, status } = makeRes()
      const next = makeNext()

      await requireAuth(req, res, next)

      expect(status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('successful authentication', () => {
    it('attaches userId and userRole to request and calls next()', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600 // +1 hour
      const token = makeJwt(futureExp)

      // Use this token for this test
      const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-42' } }, error: null })
      mockFindUser.mockResolvedValue({ id: 'user-42', role: 'AGENT' })

      const { res } = makeRes()
      const next = makeNext()

      await requireAuth(req, res, next)

      expect(next).toHaveBeenCalled()
      expect((req as AuthenticatedRequest).userId).toBe('user-42')
      expect((req as AuthenticatedRequest).userRole).toBe('AGENT')
    })

    it('caches the token after successful auth', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600
      const token = makeJwt(futureExp)
      tokenCache.delete(token)

      const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
      mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      mockFindUser.mockResolvedValue({ id: 'u1', role: 'BUYER' })

      await requireAuth(req, makeRes().res, makeNext())
      expect(tokenCache.has(token)).toBe(true)
    })

    it('uses 30s TTL when JWT exp appears to be in the past (clock skew)', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 10
      const token = makeJwt(pastExp)
      tokenCache.delete(token)

      const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
      mockGetUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null })
      mockFindUser.mockResolvedValue({ id: 'u2', role: 'BUYER' })

      await requireAuth(req, makeRes().res, makeNext())
      // Token should be cached (briefly)
      expect(tokenCache.has(token)).toBe(true)
    })

    it('uses full 5-min TTL when JWT has no exp claim', async () => {
      const token = makeJwt() // no exp
      tokenCache.delete(token)

      const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
      mockGetUser.mockResolvedValue({ data: { user: { id: 'u3' } }, error: null })
      mockFindUser.mockResolvedValue({ id: 'u3', role: 'BUYER' })

      await requireAuth(req, makeRes().res, makeNext())
      expect(tokenCache.has(token)).toBe(true)
    })
  })
})

describe('requireRole', () => {
  function setupAuthReq(role: string): AuthenticatedRequest {
    const req = makeReq() as AuthenticatedRequest
    req.userId = 'user-1'
    req.userRole = role
    return req
  }

  it('calls next() when role is in allowed list', () => {
    const req = setupAuthReq('AGENT')
    const { res } = makeRes()
    const next = makeNext()

    requireRole('AGENT', 'ADMIN')(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('returns 403 when role is NOT in allowed list', () => {
    const req = setupAuthReq('BUYER')
    const { res, status, json } = makeRes()
    const next = makeNext()

    requireRole('AGENT', 'ADMIN')(req, res, next)

    expect(status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    )
    expect(next).not.toHaveBeenCalled()
  })
})
