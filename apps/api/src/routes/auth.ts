import { Router } from 'express'
import { z } from 'zod'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../middleware/auth'
import type { Request } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth'

export const authRouter = Router()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['BUYER', 'AGENT', 'LENDER']).default('BUYER'),
  company: z.string().optional(),
  licenseNumber: z.string().optional(),
})

// ─── Register ─────────────────────────────────────────────────────────────────

authRouter.post('/register', async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body)

    // Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      res.status(400).json({ success: false, error: { code: 'AUTH_ERROR', message: authError?.message ?? 'Registration failed' } })
      return
    }

    // Create user profile in our DB
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        company: body.company ?? null,
        licenseNumber: body.licenseNumber ?? null,
      },
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
    const user = await prisma.user.update({ where: { id: userId }, data: body })
    res.json({ success: true, data: user })
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
      include: { property: true },
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
        role: (authUser?.user_metadata?.role as never) ?? 'BUYER',
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
        role: (authUser.user_metadata?.role as never) ?? 'BUYER',
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
      console.error('Supabase auth delete failed:', error.message)
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
      include: { property: true },
      orderBy: { generatedAt: 'desc' },
    })
    res.json({ success: true, data: reports })
  } catch (err) {
    next(err)
  }
})
