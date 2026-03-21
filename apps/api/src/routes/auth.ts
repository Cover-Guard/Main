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

authRouter.post('/me/terms', requireAuth, async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const user = await prisma.user.update({
      where: { id: userId },
      data: { termsAcceptedAt: new Date() },
    })
    res.json({ success: true, data: { termsAcceptedAt: user.termsAcceptedAt } })
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
