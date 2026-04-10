import { Router } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'
import { requireAuth, requireAuthOnly } from '../middleware/auth'
import { tokenCache, tokenRevocationStore } from '../utils/cache'
import { logger } from '../utils/logger'
import { PROPERTY_PUBLIC_SELECT } from '../utils/propertySelect'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const authRouter = Router()

const VALID_ROLES = ['BUYER', 'AGENT', 'LENDER', 'ADMIN'] as const
type ValidRole = (typeof VALID_ROLES)[number]

function toValidRole(value: unknown): ValidRole {
  if (typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value)) {
    return value as ValidRole
  }
  return 'BUYER'
}

/** Decode JWT payload to extract user metadata without a network call.
 *  Safe to use after requireAuth has already verified the token. */
function decodeJwtPayload(req: Request): Record<string, unknown> | null {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return null
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Read the JWT exp claim from the Authorization header (ms). Returns 0 if absent. */
function getTokenExpMs(req: Request): number {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return 0
    const payload = token.split('.')[1]
    if (!payload) return 0
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : 0
  } catch {
    return 0
  }
}

// âââ FIX: Updated register schema to accept agreement flags ââââââââââââââââââ
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['BUYER', 'AGENT', 'LENDER']).default('BUYER'),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  termsAccepted: z.boolean().optional(),
  ndaAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().optional(),
})

// âââ Register âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)

    // Validate database connectivity BEFORE creating the Supabase auth user.
    try {
      await prisma.$queryRawUnsafe('SELECT 1')
    } catch (dbErr) {
      logger.error('Database connectivity check failed during registration', {
        error: dbErr instanceof Error ? dbErr.message : dbErr,
      })
      res.status(503).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable. Please try again later.' },
      })
      return
    }

    // âââ FIX: Check if a user with this email already exists in the DB âââââââ
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true },
    })

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message: 'A user with this email address already exists. Please sign in instead.',
        },
      })
      return
    }
    // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        company: body.company ?? null,
        licenseNumber: body.licenseNumber ?? null,
      },
    })

    if (authError || !authData.user) {
      const isDuplicate = authError?.message?.toLowerCase().includes('already registered')
      const status = isDuplicate ? 409 : 400
      const code = isDuplicate ? 'DUPLICATE_EMAIL' : 'AUTH_ERROR'
      res.status(status).json({
        success: false,
        error: { code, message: authError?.message ?? 'Registration failed' },
      })
      return
    }

    // âââ FIX: Build acceptance timestamps from boolean flags âââââââââââââââââ
    const now = new Date()
    const acceptanceData = {
      termsAcceptedAt: body.termsAccepted ? now : null,
      ndaAcceptedAt: body.ndaAccepted ? now : null,
      privacyAcceptedAt: body.privacyAccepted ? now : null,
    }
    // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

    const profileData = {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      company: body.company ?? null,
      licenseNumber: body.licenseNumber ?? null,
      ...acceptanceData,                           // FIX: include timestamps
    }

    try {
      const user = await prisma.user.upsert({
        where: { id: authData.user.id },
        update: profileData,
        create: { id: authData.user.id, ...profileData },
        select: { id: true, email: true, role: true },
      })

      res.status(201).json({ success: true, data: user })
    } catch (profileErr) {
      logger.error('Profile creation failed, rolling back auth user', {
        userId: authData.user.id,
        error: profileErr instanceof Error ? profileErr.message : profileErr,
      })
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch((delErr) => {
        logger.error('Failed to clean up orphaned auth user', {
          userId: authData.user.id,
          error: delErr instanceof Error ? delErr.message : delErr,
        })
      })
      throw profileErr
    }
  } catch (err) {
    next(err)
  }
})

// âââ Me ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.get('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        company: true,
        licenseNumber: true,
        avatarUrl: true,
        termsAcceptedAt: true,
        ndaAcceptedAt: true,
        privacyAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})

// âââ Update profile ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  avatarUrl: z.string().max(2048).refine(
    (val) => /^https?:\/\//.test(val) || val.startsWith('data:'),
    { message: 'Must be a valid URL or data URI' },
  ).nullish(),
})

authRouter.patch('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = updateProfileSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        company: true,
        licenseNumber: true,
        avatarUrl: true,
        termsAcceptedAt: true,
        ndaAcceptedAt: true,
        privacyAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})

// âââ Saved properties ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.get('/me/saved', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const page = Math.min(10000, Math.max(1, parseInt(req.query.page as string, 10) || 1))
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))
    const saved = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        id: true,
        propertyId: true,
        notes: true,
        tags: true,
        savedAt: true,
        clientId: true,
        property: { select: PROPERTY_PUBLIC_SELECT },
      },
      orderBy: { savedAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
    })
    res.json({ success: true, data: saved })
  } catch (err) {
    next(err)
  }
})

// âââ Accept terms / NDA / privacy ââââââââââââââââââââââââââââââââââââââââââââ
authRouter.post('/me/terms', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const now = new Date()
    const agreements = { termsAcceptedAt: now, ndaAcceptedAt: now, privacyAcceptedAt: now }

    const updated = await prisma.user.updateMany({ where: { id: userId }, data: agreements })
    if (updated.count > 0) {
      res.json({ success: true, data: agreements })
      return
    }

    const jwt = decodeJwtPayload(req)
    const meta = (jwt?.user_metadata ?? {}) as Record<string, string | undefined>
    const email = (jwt?.email as string) ?? ''
    const fullName = meta.full_name ?? ''

    await prisma.user.upsert({
      where: { id: userId },
      update: agreements,
      create: {
        id: userId,
        email,
        firstName: meta.firstName ?? fullName.split(' ')[0] ?? '',
        lastName: meta.lastName ?? fullName.split(' ').slice(1).join(' ') ?? '',
        role: toValidRole(meta.role),
        company: meta.company ?? null,
        licenseNumber: meta.licenseNumber ?? null,
        ...agreements,
      },
      select: { id: true },
    })

    res.json({ success: true, data: agreements })
  } catch (err) {
    next(err)
  }
})

// âââ Sync profile (OAuth fallback) âââââââââââââââââââââââââââââââââââââââââââ
// FIX: Use requireAuthOnly instead of requireAuth to break the circular
// dependency. requireAuth requires a DB profile to exist, but sync-profile
// is the endpoint that CREATES the profile for new OAuth users.
authRouter.post('/sync-profile', requireAuthOnly, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const jwt = decodeJwtPayload(req)
    const meta = (jwt?.user_metadata ?? {}) as Record<string, string | undefined>
    const email = (jwt?.email as string) ?? ''
    const fullName = meta.full_name ?? meta.name ?? ''
    const oauthAvatar = meta.avatar_url ?? meta.picture ?? null

    // âââ FIX: Check if a user with this email already exists under a
    //     different auth ID (e.g. previously registered with password,
    //     now signing in with Google OAuth). ââââââââââââââââââââââââââââââââ
    if (email) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (existingByEmail && existingByEmail.id !== userId) {
        logger.warn('OAuth sync-profile blocked: email already belongs to another user', {
          oauthUserId: userId,
          existingUserId: existingByEmail.id,
          email,
        })
        res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_EMAIL',
            message:
              'An account with this email address already exists. Please sign in with your original method (email/password) or contact support to link your accounts.',
          },
        })
        return
      }
    }
    // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

    // âââ FIX: Read acceptance timestamps from JWT metadata if present ââââ
    const acceptanceData = {
      termsAcceptedAt: meta.termsAcceptedAt ? new Date(meta.termsAcceptedAt) : undefined,
      ndaAcceptedAt: meta.ndaAcceptedAt ? new Date(meta.ndaAcceptedAt) : undefined,
      privacyAcceptedAt: meta.privacyAcceptedAt ? new Date(meta.privacyAcceptedAt) : undefined,
    }

    // Strip undefined values so Prisma doesn't overwrite existing timestamps
    // with undefined on update.
    const cleanAcceptance = Object.fromEntries(
      Object.entries(acceptanceData).filter(([, v]) => v !== undefined)
    )
    // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

    // Backfill avatar from OAuth provider when user has none
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    })

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {
        ...(existing && !existing.avatarUrl && oauthAvatar ? { avatarUrl: oauthAvatar } : {}),
        ...cleanAcceptance,                          // FIX: backfill timestamps
      },
      create: {
        id: userId,
        email,
        firstName: meta.firstName ?? fullName.split(' ')[0] ?? '',
        lastName: meta.lastName ?? fullName.split(' ').slice(1).join(' ') ?? '',
        role: toValidRole(meta.role),
        company: meta.company ?? null,
        licenseNumber: meta.licenseNumber ?? null,
        avatarUrl: oauthAvatar,
        ...cleanAcceptance,                          // FIX: set timestamps on create
      },
      select: { id: true, email: true, role: true, avatarUrl: true, firstName: true, lastName: true },
    })

    res.json({ success: true, data: user })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const catchUserId = (req as AuthenticatedRequest).userId
    const catchEmail = (decodeJwtPayload(req)?.email as string) ?? ''
    if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('connect')) {
      res.set('Retry-After', '5')
      return res.status(503).json({ error: 'Profile sync temporarily unavailable, please retry' })
    }
    // âââ FIX: Catch Prisma unique constraint violations gracefully ââââââââ
    if (msg.includes('Unique constraint') && msg.includes('email')) {
      logger.warn('sync-profile unique constraint violation on email', {
        userId: catchUserId,
        email: catchEmail,
        error: msg,
      })
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_EMAIL',
          message:
            'An account with this email address already exists. Please sign in with your original method or contact support.',
        },
      })
      return
    }
    // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    next(err)
  }
})

// âââ Delete account âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.delete('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    // Delete all user data from DB FIRST (cascades via Prisma relations).
    // If this fails, the user still has their auth account and can retry.
    // If we delete auth first and DB delete fails, the user is left with an
    // orphaned DB record and cannot re-register with the same email.
    try {
      await prisma.user.delete({ where: { id: userId } })
    } catch (dbErr) {
      logger.error(`Database deletion failed for user ${userId}`, {
        error: dbErr instanceof Error ? dbErr.message : dbErr,
      })
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Failed to delete account. Please try again.' },
      })
      return
    }

    // Delete the Supabase auth user only after DB deletion succeeds.
    // If this fails, we log it but don't fail the response since the user
    // data is already gone from the database.
    const { error: supabaseError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (supabaseError) {
      logger.error(`Supabase auth delete failed for user ${userId}: ${supabaseError.message}`)
      // Note: We don't return here because the DB user is already deleted.
      // The auth account being orphaned is less critical than DB data consistency.
    }

    // Revoke the current token immediately so it can't be reused even within
    // the cache TTL window.
    const token = req.headers.authorization?.split(' ')[1]
    if (token) {
      const expMs = getTokenExpMs(req)
      tokenRevocationStore.revoke(token, expMs > Date.now() ? expMs : Date.now() + 5 * 60_000)
      tokenCache.delete(token)
    }

    res.json({ success: true, data: { deleted: true } })
  } catch (err) {
    next(err)
  }
})

// âââ Reports âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.get('/me/reports', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const rPage = Math.min(10000, Math.max(1, parseInt(req.query.page as string, 10) || 1))
    const rLimit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))
    const reports = await prisma.propertyReport.findMany({
      where: { userId },
      select: {
        id: true,
        reportType: true,
        generatedAt: true,
        propertyId: true,
        property: { select: PROPERTY_PUBLIC_SELECT },
      },
      orderBy: { generatedAt: 'desc' },
      take: rLimit,
      skip: (rPage - 1) * rLimit,
    })
    res.json({ success: true, data: reports })
  } catch (err) {
    next(err)
  }
})
