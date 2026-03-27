import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'
import { tokenCache } from '../utils/cache'

export interface AuthenticatedRequest extends Request {
  userId: string
  userRole: string
}

const MAX_TOKEN_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Decode the JWT payload (without verification — Supabase verifies on the slow
 * path) to read the `exp` claim so we can avoid caching a token past its own
 * expiry.  Returns 0 if the token is malformed or has no `exp`.
 */
function getJwtExp(token: string): number {
  try {
    const payload = token.split('.')[1]
    if (!payload) return 0
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: number
    }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : 0
  } catch {
    return 0
  }
}

/**
 * requireAuth — validates Bearer JWT and resolves the CoverGuard user profile.
 *
 * Performance: tokens are cached in-process using tokenCache so every
 * authenticated request does NOT hit Supabase Auth + the DB on every call.
 * Cache TTL is set to min(5 min, time-until-token-expiry) so we never serve a
 * cached entry for a token that has already expired. Tokens that fail Supabase
 * validation are never cached. Cache eviction is TTL-only; there is no active
 * invalidation on sign-out or token revocation.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
    })
    return
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Malformed bearer token' },
    })
    return
  }

  // Fast path: token already validated and not yet expired in local cache
  const cached = tokenCache.get(token)
  if (cached) {
    const authReq = req as AuthenticatedRequest
    authReq.userId = cached.userId
    authReq.userRole = cached.userRole
    next()
    return
  }

  // Slow path: verify with Supabase + load user profile
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    // Do NOT cache invalid tokens
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: data.user.id },
    select: { id: true, role: true },
  })
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User profile not found' },
    })
    return
  }

  // Cache with TTL = min(5 min, time until JWT expiry) to avoid serving
  // cached entries for tokens that have already expired.
  // - If exp is in the future: use min(5min, time-until-expiry)
  // - If exp is 0 (no exp claim or malformed): fall back to full 5 min TTL
  // - If exp is in the past but Supabase still validated (e.g., clock skew):
  //   use a minimal 30 s TTL to limit exposure without skipping the cache entirely
  const expMs = getJwtExp(token)
  let ttlMs: number
  if (expMs > Date.now()) {
    ttlMs = Math.min(MAX_TOKEN_CACHE_TTL_MS, expMs - Date.now())
  } else if (expMs === 0) {
    ttlMs = MAX_TOKEN_CACHE_TTL_MS
  } else {
    // Token appears expired (clock skew) — cache very briefly
    ttlMs = 30_000
  }
  tokenCache.set(token, { userId: user.id, userRole: user.role }, ttlMs)

  const authReq = req as AuthenticatedRequest
  authReq.userId = user.id
  authReq.userRole = user.role
  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest
    if (!roles.includes(authReq.userRole)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      })
      return
    }
    next()
  }
}
