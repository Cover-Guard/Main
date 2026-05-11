import { prisma } from './prisma'
import { supabaseAdmin } from './supabaseAdmin'
import { logger } from './logger'

/**
 * Deep health check (P-A6).
 *
 * GET /health (existing) stays fast — < 50ms liveness probe, no I/O. Vercel,
 * Railway, and any uptime monitor poll it dozens of times per minute.
 *
 * GET /health/dependencies (new) actually exercises the things that can break:
 *   - Postgres reachability via a `SELECT 1` through Prisma.
 *   - Supabase Auth reachability via `auth.admin.listUsers({ perPage: 1 })`.
 *   - One external risk source (FEMA NFHL `?f=json`) to canary upstream APIs.
 *
 * Each check has its own timeout so a slow dependency doesn't drag the whole
 * probe past a useful response time. Aggregate status is the WORST of the
 * individual results (`unhealthy` if any required dep fails; `degraded` if a
 * non-required dep fails). The handler in index.ts maps `unhealthy` and
 * `degraded` to 503 and `healthy` to 200.
 *
 * This module never throws. The probes catch their own errors and return a
 * structured failure record so the staging-promotion gate can read it cleanly.
 */

export type DependencyStatus = 'ok' | 'fail' | 'skipped'

export interface DependencyResult {
  name: string
  status: DependencyStatus
  latencyMs: number
  required: boolean
  error?: string
}

export interface HealthEnvelope {
  status: 'healthy' | 'degraded' | 'unhealthy'
  healthy: boolean
  checkedAt: string
  durationMs: number
  dependencies: DependencyResult[]
}

/** Race a promise against a timeout. Resolves to the inner result or rejects
 * with `TimeoutError` so the caller can distinguish "the dep failed" from "we
 * gave up waiting for it." */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label} timed out after ${ms}ms`)
      e.name = 'TimeoutError'
      reject(e)
    }, ms)
  })
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

/** Best-effort probe wrapper. Captures latency, normalizes errors. */
async function probe(
  name: string,
  required: boolean,
  timeoutMs: number,
  fn: () => Promise<void>,
): Promise<DependencyResult> {
  const start = Date.now()
  try {
    await withTimeout(fn(), timeoutMs, name)
    return { name, status: 'ok', latencyMs: Date.now() - start, required }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn('Health probe failed: %s — %s', name, message)
    return {
      name,
      status: 'fail',
      latencyMs: Date.now() - start,
      required,
      error: message.slice(0, 200), // cap to keep response bounded
    }
  }
}

/** Postgres reachability. Required. 1s timeout — production DB connections
 * should return SELECT 1 in single-digit ms; >1s is a problem worth a 503. */
async function checkDatabase(): Promise<DependencyResult> {
  return probe('database', true, 1_000, async () => {
    await prisma.$queryRawUnsafe('SELECT 1')
  })
}

/** Supabase Auth reachability. Required. 2s timeout — Supabase Auth typically
 * returns the first page of users in <300ms, but allow headroom for cold
 * regional routing. */
async function checkSupabaseAuth(): Promise<DependencyResult> {
  return probe('supabase_auth', true, 2_000, async () => {
    const { error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 })
    if (error) throw new Error(error.message)
  })
}

/** FEMA NFHL canary. NOT required — FEMA goes down for maintenance windows and
 * the platform survives via cached risk profiles. 5s timeout. */
async function checkFemaCanary(): Promise<DependencyResult> {
  return probe('fema_nfhl', false, 5_000, async () => {
    const base =
      process.env.FEMA_API_BASE_URL || 'https://hazards.fema.gov/gis/nfhl/rest/services'
    const res = await fetch(`${base}?f=json`, {
      signal: AbortSignal.timeout(4_500),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  })
}

/**
 * Run all dependency probes in parallel and build the envelope.
 *
 * Aggregate status logic:
 *   - any required dep `fail` → 'unhealthy' (handler returns 503)
 *   - any non-required dep `fail` → 'degraded' (handler returns 503)
 *   - all required ok and all non-required ok → 'healthy' (200)
 *
 * The staging-promotion gate in PR-A7 reads `healthy` (the boolean) to decide
 * whether to promote a deploy. `degraded` blocks promotion just like
 * `unhealthy` does, because shipping over a known-broken upstream is bad form
 * even when the platform technically survives the outage.
 */
export async function checkDependencies(): Promise<HealthEnvelope> {
  const start = Date.now()
  const results = await Promise.all([
    checkDatabase(),
    checkSupabaseAuth(),
    checkFemaCanary(),
  ])

  const requiredFailed = results.some((r) => r.required && r.status === 'fail')
  const anyFailed = results.some((r) => r.status === 'fail')
  const status: HealthEnvelope['status'] = requiredFailed
    ? 'unhealthy'
    : anyFailed
      ? 'degraded'
      : 'healthy'

  return {
    status,
    healthy: status === 'healthy',
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    dependencies: results,
  }
}
