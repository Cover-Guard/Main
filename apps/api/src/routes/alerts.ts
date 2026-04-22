import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { logger } from '../utils/logger'
import type { CarrierExitAlert } from '@coverguard/shared'

/**
 * VA-01 — Carrier-exit / re-open alerts for agents.
 *
 * v1 ships the HTTP surface only. The delta-detection job (comparing today's
 * carrier-availability snapshot to yesterday's) is out of scope for this PR
 * and must be implemented as a scheduled worker that writes into a new
 * `CarrierExitAlert` Supabase table. Until that lands this route returns an
 * empty list so the frontend widget can render its empty state cleanly.
 *
 * Spec: docs/gtm/value-add-activities/01-carrier-exit-alert.md
 */
export const alertsRouter = Router()
alertsRouter.use(requireAuth)

const listQuerySchema = z.object({
  // Allow scoping the read to a subset of severities.
  severity: z
    .enum(['INFO', 'WARNING', 'CRITICAL'])
    .optional(),
  /** Pagination. */
  limit: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
})

// ─── List carrier-exit alerts ──────────────────────────────────────────────
alertsRouter.get('/carrier-exits', async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: parsed.error.errors[0]?.message ?? 'Invalid query',
        },
      })
      return
    }

    const authReq = req as AuthenticatedRequest
    const userId = authReq.userId

    // TODO(VA-01): query Supabase `carrier_exit_alerts` scoped to the agent's
    // book of business. For now we return an empty list so the widget renders
    // its empty state without erroring.
    const alerts: CarrierExitAlert[] = []

    logger.debug('carrier-exit alerts fetched', {
      userId,
      count: alerts.length,
    })

    res.json({ success: true, data: alerts })
  } catch (err) {
    next(err)
  }
})

// ─── Acknowledge a carrier-exit alert ──────────────────────────────────────
const ackParamsSchema = z.object({
  id: z.string().min(1).max(200),
})

alertsRouter.post('/carrier-exits/:id/acknowledge', async (req, res, next) => {
  try {
    const parsed = ackParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: parsed.error.errors[0]?.message ?? 'Invalid id',
        },
      })
      return
    }

    const authReq = req as unknown as AuthenticatedRequest
    // TODO(VA-01): mark the alert acknowledged in the `carrier_exit_alerts`
    // table. No-op for now — the widget handles optimistic local state.
    logger.info('carrier-exit alert acknowledged', {
      userId: authReq.userId,
      alertId: parsed.data.id,
    })
    res.json({ success: true, data: { id: parsed.data.id, acknowledged: true } })
  } catch (err) {
    next(err)
  }
})
