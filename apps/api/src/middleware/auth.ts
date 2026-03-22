import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'
import { tokenCache } from '../utils/cache'

export interface AuthenticatedRequest extends Request {
  userId: string
  userRole: string
}

/**
 * requireAuth — validates Bearer JWT and resolves the CoverGuard user profile.
 *
 * Performance: tokens are cached in-process for 5 minutes using tokenCache so
 * every authenticated request does NOT hit Supabase Auth + the DB on every
 * call. Invalid or expired tokens (401 from Supabase) are never cached; valid
 * tokens are evicted automatically by the cache TTL.
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

  const token = authHeader.split(' ')[1]!

  // Fast path: token already validated within the last 5 minutes
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

  // Cache for 5 minutes (TTL set in tokenCache constructor)
  tokenCache.set(token, { userId: user.id, userRole: user.role })

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
