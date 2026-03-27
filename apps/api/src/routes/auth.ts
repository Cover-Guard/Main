import { Router } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import { logger } from '../utils/logger'
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

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['BUYER', 'AGENT', 'LENDER']).default('BUYER'),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
  agreeNDA: z.literal(true, { errorMap: () => ({ message: 'NDA agreement is required' }) }),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: 'Terms of Use agreement is required' }) }),
  agreePrivacy: z.literal(true, { errorMap: () => ({ message: 'Privacy Policy agreement is required' }) }),
})

// ─── Register ─────────────────────────────────────────────────────────────────

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)

    const agreedAt = new Date()

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
        termsAcceptedAt: agreedAt.toISOString(),
        ndaAcceptedAt: agreedAt.toISOString(),
        privacyAcceptedAt: agreedAt.toISOString(),
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
      ndaAcceptedAt: agreedAt,
      privacyAcceptedAt: agreedAt,
      termsAcceptedAt: agreedAt,
    }
    const user = await prisma.user.upsert({
      where: { id: authData.user.id },
      update: profileData,
      create: { id: authData.user.id, ...profileData },
    })

    res.status(201).json({ success: true, data: { id: user.id, email: user.email, role: user.role } })
  } catch (err) {
    next(err)
  }
})

// ─── Me ───────────────────────────────────────────────────────────────────────

authRouter.get('/me', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    // Omit internal Stripe customer ID — return null to match the User type contract
    const { stripeCustomerId: _stripe, ...profile } = user
    res.json({ success: true, data: { ...profile, stripeCustomerId: null } })
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
    const user = await prisma.user.update({ where: { id: userId }, data: body })
    const { stripeCustomerId: _stripe, ...profile } = user
    res.json({ success: true, data: { ...profile, stripeCustomerId: null } })
  } catch (err) {
    next(err)
  }
})

// ─── Saved properties ─────────────────────────────────────────────────────────

authRouter.get('/me/saved', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const saved = await prisma.savedProperty.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            county: true,
            lat: true,
            lng: true,
            propertyType: true,
            yearBuilt: true,
            squareFeet: true,
            bedrooms: true,
            bathrooms: true,
            lotSize: true,
            estimatedValue: true,
            lastSalePrice: true,
            lastSaleDate: true,
            parcelId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { savedAt: 'desc' },
    })
    res.json({ success: true, data: saved })
  } catch (err) {
    next(err)
  }
})

// ─── Accept terms ─────────────────────────────────────────────────────────────
// Uses upsert so that OAuth users whose handle_new_user trigger fired correctly
// get an update, while any edge-case where the profile is missing gets a create.

authRouter.post('/me/terms', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest

    // Look up the Supabase auth user so we have email + metadata for the upsert
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
    const authUser = authData.user

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { termsAcceptedAt: new Date() },
      create: {
        id: userId,
        email: authUser?.email ?? '',
        firstName: authUser?.user_metadata?.firstName
          ?? authUser?.user_metadata?.full_name?.split(' ')[0]
          ?? '',
        lastName: authUser?.user_metadata?.lastName
          ?? authUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ')
          ?? '',
        role: toValidRole(authUser?.user_metadata?.role),
        company: authUser?.user_metadata?.company ?? null,
        licenseNumber: authUser?.user_metadata?.licenseNumber ?? null,
        termsAcceptedAt: new Date(),
      },
    })
    res.json({ success: true, data: { termsAcceptedAt: user.termsAcceptedAt } })
  } catch (err) {
    next(err)
  }
})

// ─── Sync profile (OAuth fallback) ────────────────────────────────────────────
// Called by the OAuth callback route when the handle_new_user trigger did not
// create a public.users row (e.g. trigger misconfigured or first-deploy race).
// Safe to call multiple times — upsert is idempotent.

authRouter.post('/sync-profile', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
    const authUser = authData.user

    if (!authUser) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Auth user not found' } })
      return
    }

    const user = await prisma.user.upsert({
      where: { id: userId },
      update: {}, // profile already exists — leave it untouched
      create: {
        id: userId,
        email: authUser.email ?? '',
        firstName: authUser.user_metadata?.firstName
          ?? authUser.user_metadata?.full_name?.split(' ')[0]
          ?? '',
        lastName: authUser.user_metadata?.lastName
          ?? authUser.user_metadata?.full_name?.split(' ').slice(1).join(' ')
          ?? '',
        role: toValidRole(authUser.user_metadata?.role),
        company: authUser.user_metadata?.company ?? null,
        licenseNumber: authUser.user_metadata?.licenseNumber ?? null,
        avatarUrl: authUser.user_metadata?.avatar_url ?? null,
      },
    })

    res.json({ success: true, data: { id: user.id, email: user.email, role: user.role } })
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
    const reports = await prisma.propertyReport.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            county: true,
            lat: true,
            lng: true,
            propertyType: true,
            yearBuilt: true,
            squareFeet: true,
            bedrooms: true,
            bathrooms: true,
            lotSize: true,
            estimatedValue: true,
            lastSalePrice: true,
            lastSaleDate: true,
            parcelId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    })
    res.json({ success: true, data: reports })
  } catch (err) {
    next(err)
  }
})
