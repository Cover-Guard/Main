import { Router } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
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

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['BUYER', 'AGENT', 'LENDER']).default('BUYER'),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  // NDA, terms, and privacy agreements are handled during onboarding (POST /me/terms)
  // to ensure the same workflow for email and OAuth users.
})

// ─── Register ─────────────────────────────────────────────────────────────────

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)

    // Validate database connectivity BEFORE creating the Supabase auth user.
    // If the DB is unreachable (e.g. missing connection string env var), we
    // fail fast with a 503 instead of creating an orphaned auth user that
    // blocks the email from future registration attempts.
    try {
      await prisma.$queryRawUnsafe('SELECT 1')
    } catch (dbErr) {
      logger.error('Database connectivity check failed during registration', {
        error: dbErr instanceof Error ? dbErr.message : dbErr,
      })
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable. Please try again later.',
        },
      })
      return
    }

    // Create Supabase auth user with metadata so it stays in sync with the
    // Prisma profile and downstream checks (e.g. OAuth callback termsAcceptedAt
    // guard) work correctly.
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
        // Agreement timestamps are NOT set here — they are set during the
        // unified onboarding step (POST /me/terms) so email and OAuth users
        // go through the same NDA/terms/privacy acceptance workflow.
      },
    })

    if (authError || !authData.user) {
      // Supabase returns "User already registered" for duplicate emails
      const isDuplicate = authError?.message?.toLowerCase().includes('already registered')
      const status = isDuplicate ? 409 : 400
      const code = isDuplicate ? 'DUPLICATE_EMAIL' : 'AUTH_ERROR'
      res.status(status).json({ success: false, error: { code, message: authError?.message ?? 'Registration failed' } })
      return
    }

    // Upsert user profile in our DB.  The Supabase handle_new_user trigger may
    // have already inserted a skeleton row (without agreement timestamps) by the
    // time this code runs, so we use upsert to fill in / overwrite the record
    // rather than failing with a P2002 unique constraint violation.
    const profileData = {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      company: body.company ?? null,
      licenseNumber: body.licenseNumber ?? null,
      // Agreement timestamps left null — set during onboarding (POST /me/terms)
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
      // Profile creation failed after auth user was created — roll back the
      // Supabase auth user so the email isn't permanently "taken".
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

// ─── Me ───────────────────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        company: true, licenseNumber: true, avatarUrl: true,
        termsAcceptedAt: true, ndaAcceptedAt: true, privacyAcceptedAt: true,
        createdAt: true, updatedAt: true,
      },
    })
    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})

// ─── Update profile ───────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
})

authRouter.patch('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const body = updateProfileSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: userId },
      data: body,
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        company: true, licenseNumber: true, avatarUrl: true,
        termsAcceptedAt: true, ndaAcceptedAt: true, privacyAcceptedAt: true,
        createdAt: true, updatedAt: true,
      },
    })
    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})

// ─── Saved properties ─────────────────────────────────────────────────────────

authRouter.get('/me/saved', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const page = Math.min(10000, Math.max(1, parseInt(req.query.page as string, 10) || 1))
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))
    const saved = await prisma.savedProperty.findMany({
      where: { userId },
      select: {
        id: true, notes: true, tags: true, savedAt: true, clientId: true,
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

// ─── Accept terms / NDA / privacy (unified onboarding endpoint) ─────────────
// Used by both email-registered and OAuth-registered users. Sets all three
// agreement timestamps in a single call. Optimistic update first (profile
// already exists from register or sync-profile), create fallback if missing.

authRouter.post('/me/terms', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const now = new Date()

    const agreements = {
      termsAcceptedAt: now,
      ndaAcceptedAt: now,
      privacyAcceptedAt: now,
    }

    // Fast path: profile already exists (99% of cases after register or OAuth sync)
    const updated = await prisma.user.updateMany({
      where: { id: userId },
      data: agreements,
    })

    if (updated.count > 0) {
      res.json({ success: true, data: agreements })
      return
    }

    // Slow path: profile missing — extract metadata from JWT (already verified by
    // requireAuth) to avoid a redundant Supabase Admin API round trip.
    const jwt = decodeJwtPayload(req)
    const meta = (jwt?.user_metadata ?? {}) as Record<string, string | undefined>
    const email = (jwt?.email as string) ?? ''
    const fullName = meta.full_name ?? ''

    await prisma.user.create({
      data: {
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

// ─── Sync profile (OAuth fallback) ────────────────────────────────────────────
// Called by the OAuth callback route when the handle_new_user trigger did not
// create a public.users row (e.g. trigger misconfigured or first-deploy race).
// Safe to call multiple times — upsert is idempotent.
// Uses JWT claims (already verified by requireAuth) instead of a second Supabase
// Admin API call, saving ~50-200ms on the critical onboarding path.

authRouter.post('/sync-profile', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const jwt = decodeJwtPayload(req)
    const meta = (jwt?.user_metadata ?? {}) as Record<string, string | undefined>
    const email = (jwt?.email as string) ?? ''
    const fullName = meta.full_name ?? meta.name ?? ''

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {}, // profile already exists — leave it untouched
      create: {
        id: userId,
        email,
        firstName: meta.firstName ?? fullName.split(' ')[0] ?? '',
        lastName: meta.lastName ?? fullName.split(' ').slice(1).join(' ') ?? '',
        role: toValidRole(meta.role),
        company: meta.company ?? null,
        licenseNumber: meta.licenseNumber ?? null,
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
      },
      select: { id: true, email: true, role: true },
    })

    res.json({ success: true, data: user })
  } catch (err) {
    next(err)
  }
})

// ─── Delete account ───────────────────────────────────────────────────────────

authRouter.delete('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    // Delete all user data from DB first (cascades via Prisma relations)
    await prisma.user.delete({ where: { id: userId } })

    // Delete the Supabase auth user
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      // DB already deleted — log but don't fail the request
      logger.error(`Supabase auth delete failed: ${error.message}`)
    }

    res.json({ success: true, data: { deleted: true } })
  } catch (err) {
    next(err)
  }
})

// ─── Reports ──────────────────────────────────────────────────────────────────

authRouter.get('/me/reports', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const rPage = Math.min(10000, Math.max(1, parseInt(req.query.page as string, 10) || 1))
    const rLimit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50))
    const reports = await prisma.propertyReport.findMany({
      where: { userId },
      select: {
        id: true, reportType: true, generatedAt: true, propertyId: true,
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
