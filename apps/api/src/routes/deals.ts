import { Router } from 'express'
import { z } from 'zod'
import type { Request } from 'express'
import { requireAuth } from '../middleware/auth'
import type { AuthenticatedRequest } from '../middleware/auth'
import {
  createDeal,
  deleteDeal,
  getDealStats,
  listDeals,
  updateDeal,
} from '../services/dealsService'

export const dealsRouter = Router()
dealsRouter.use(requireAuth)

const stageEnum = z.enum(['PROSPECT', 'IN_PROGRESS', 'UNDER_CONTRACT', 'CLOSED_WON', 'FELL_OUT'])
const falloutReasonEnum = z.enum([
  'INSURABILITY',
  'PRICING_TOO_HIGH',
  'CARRIER_DECLINED',
  'CLIENT_BACKED_OUT',
  'INSPECTION_ISSUES',
  'FINANCING_FELL_THROUGH',
  'APPRAISAL_LOW',
  'TITLE_ISSUES',
  'COMPETING_OFFER',
  'PROPERTY_CONDITION',
  'OTHER',
])

const createSchema = z.object({
  title: z.string().min(1).max(200),
  stage: stageEnum.optional(),
  propertyId: z.string().min(1).max(200).nullable().optional(),
  clientId: z.string().min(1).max(200).nullable().optional(),
  dealValue: z.number().int().nonnegative().nullable().optional(),
  carrierName: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  stage: stageEnum.optional(),
  propertyId: z.string().min(1).max(200).nullable().optional(),
  clientId: z.string().min(1).max(200).nullable().optional(),
  dealValue: z.number().int().nonnegative().nullable().optional(),
  carrierName: z.string().max(120).nullable().optional(),
  falloutReason: falloutReasonEnum.nullable().optional(),
  falloutNotes: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// ─── List ─────────────────────────────────────────────────────────────────────

dealsRouter.get('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await listDeals(userId)
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ─── Stats ───────────────────────────────────────────────────────────────────

dealsRouter.get('/stats', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const data = await getDealStats(userId)
    res.set('Cache-Control', 'private, max-age=15')
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ─── Create ───────────────────────────────────────────────────────────────────

dealsRouter.post('/', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid deal payload', details: parsed.error.flatten() },
      })
      return
    }
    const data = await createDeal(userId, parsed.data)
    res.status(201).json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ─── Update ───────────────────────────────────────────────────────────────────

dealsRouter.patch('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const id = String(req.params.id)
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid deal payload', details: parsed.error.flatten() },
      })
      return
    }
    // If marking the deal as fell-out, require a falloutReason so the
    // dashboard breakdown stays meaningful.
    if (parsed.data.stage === 'FELL_OUT' && !parsed.data.falloutReason) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'falloutReason is required when stage is FELL_OUT' },
      })
      return
    }
    const data = await updateDeal(userId, id, parsed.data)
    if (!data) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deal not found' } })
      return
    }
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// ─── Delete ───────────────────────────────────────────────────────────────────

dealsRouter.delete('/:id', async (req: Request, res, next) => {
  try {
    const { userId } = req as AuthenticatedRequest
    const id = String(req.params.id)
    const ok = await deleteDeal(userId, id)
    if (!ok) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Deal not found' } })
      return
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})
