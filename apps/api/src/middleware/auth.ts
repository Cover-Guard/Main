import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'

export interface AuthenticatedRequest extends Request {
  userId: string
  userRole: string
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' } })
    return
  }

  const token = authHeader.split(' ')[1]

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: data.user.id } })
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User profile not found' } })
    return
  }

  const authReq = req as AuthenticatedRequest
  authReq.userId = user.id
  authReq.userRole = user.role
  next()
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest
    if (!roles.includes(authReq.userRole)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } })
      return
    }
    next()
  }
}
