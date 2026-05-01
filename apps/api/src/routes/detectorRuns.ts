/**
 * Internal detector-runs routes (PR 9).
 *
 * Mounted at `/api/internal/detector-runs`. Admin-only; the request must
 * carry an authenticated session for a user with `metadata.role === 'admin'`.
 *
 * Two endpoints:
 *   GET /api/internal/detector-runs/summary
 *     Returns per-detector rollup over the last 24h: success rate, avg
 *     duration, last error, total emitted/inserted. Drives the ops view.
 *
 *   GET /api/internal/detector-runs?detector=<name>&limit=50
 *     Returns the most recent N runs (default 50, max 200) for a single
 *     detector. Used to drill into a specific detector's history.
 */

import { Router, type Response } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { supabaseAdmin } from '../utils/supabaseAdmin'
import { logger } from '../utils/logger'

export const detectorRunsRouter = Router()

const WINDOW_MS = 24 * 60 * 60 * 1000

interface DetectorRunRow {
  id: string
  detectorName: string
  userId: string | null
  status: 'success' | 'error' | 'skipped'
  startedAt: string
  finishedAt: string
  durationMs: number
  emitted: number
  inserted: number
  skipped: number
  errorMessage: string | null
}

interface DetectorSummary {
  detector: string
  runs: number
  successes: number
  errors: number
  skipped: number
  successRate: number
  avgDurationMs: number
  totalEmitted: number
  totalInserted: number
  lastRunAt: string
  lastError: { message: string; at: string } | null
}

async function ensureAdmin(
  req: AuthenticatedRequest,
  res: Response,
): Promise<boolean> {
  const userId = req.user?.id
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' })
    return true
  }
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('metadata')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    logger.error('Admin check failed', { userId, error: error.message })
    res.status(500).json({ error: 'admin check failed' })
    return true
  }
  const role = (data?.metadata as { role?: string } | null)?.role
  if (role !== 'admin') {
    res.status(403).json({ error: 'admin only' })
    return true
  }
  return false
}

detectorRunsRouter.get(
  '/summary',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    if (await ensureAdmin(req, res)) return

    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const { data, error } = await supabaseAdmin
      .from('detector_runs')
      .select('detectorName,status,startedAt,durationMs,emitted,inserted,errorMessage')
      .gte('startedAt', since)
      .order('startedAt', { ascending: false })
      .limit(5000)

    if (error) {
      logger.error('detector-runs summary query failed', { error: error.message })
      res.status(500).json({ error: 'query failed' })
      return
    }

    const byDetector = new Map<string, DetectorSummary>()
    for (const row of (data ?? []) as DetectorRunRow[]) {
      const cur =
        byDetector.get(row.detectorName) ??
        ({
          detector: row.detectorName,
          runs: 0,
          successes: 0,
          errors: 0,
          skipped: 0,
          successRate: 0,
          avgDurationMs: 0,
          totalEmitted: 0,
          totalInserted: 0,
          lastRunAt: row.startedAt,
          lastError: null,
        } as DetectorSummary)
      cur.runs += 1
      if (row.status === 'success') cur.successes += 1
      else if (row.status === 'error') cur.errors += 1
      else cur.skipped += 1
      cur.avgDurationMs = cur.avgDurationMs + row.durationMs
      cur.totalEmitted += row.emitted ?? 0
      cur.totalInserted += row.inserted ?? 0
      if (row.startedAt > cur.lastRunAt) cur.lastRunAt = row.startedAt
      if (row.status === 'error' && row.errorMessage) {
        if (!cur.lastError || row.startedAt > cur.lastError.at) {
          cur.lastError = { message: row.errorMessage, at: row.startedAt }
        }
      }
      byDetector.set(row.detectorName, cur)
    }

    const summaries = Array.from(byDetector.values()).map((s) => ({
      ...s,
      successRate: s.runs > 0 ? s.successes / s.runs : 0,
      avgDurationMs: s.runs > 0 ? Math.round(s.avgDurationMs / s.runs) : 0,
    }))

    summaries.sort((a, b) => b.runs - a.runs)
    res.json({ windowMs: WINDOW_MS, summaries })
  },
)

const recentQuerySchema = z.object({
  detector: z.string().min(1).max(128),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

detectorRunsRouter.get(
  '/',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    if (await ensureAdmin(req, res)) return
    const parsed = recentQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ error: 'bad query', issues: parsed.error.issues })
      return
    }
    const limit = parsed.data.limit ?? 50

    const { data, error } = await supabaseAdmin
      .from('detector_runs')
      .select('*')
      .eq('detectorName', parsed.data.detector)
      .order('startedAt', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('detector-runs list query failed', { error: error.message })
      res.status(500).json({ error: 'query failed' })
      return
    }
    res.json({ runs: data ?? [] })
  },
)
