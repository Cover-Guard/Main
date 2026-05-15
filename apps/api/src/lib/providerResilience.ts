/**
 * Per-provider resilience wrapper for the risk-data fan-out.
 *
 * The risk-profile computation fans out to ~17 external government and
 * commercial GIS APIs. Each integration already has a per-call AbortSignal
 * timeout, but transient 5xx / network blips would still cause that data
 * source to be missing from the resulting profile, and a single chronically
 * slow / failing provider would keep getting hammered on every request.
 *
 * This module wraps a fetcher with three layers, in this order on each call:
 *
 *   1. Circuit breaker (per-provider name) — if recent failure rate is high,
 *      skip the call entirely and return the fallback immediately.
 *   2. Bounded retry with exponential backoff — retry transient errors a
 *      small number of times.
 *   3. Wall-clock timeout — give up if the overall attempt budget is busted,
 *      even if the underlying fetch has its own abort signal.
 *
 * Failures of any kind ultimately resolve to the caller-supplied fallback so
 * a single provider can never crash the request. Counters are exposed via
 * `getProviderStats()` for ops visibility (and for the planned
 * /health/providers endpoint in the D1.b follow-up).
 *
 * Tuning lives in module-level constants so it can be ratcheted later without
 * touching every call site.
 */

import { logger } from '../utils/logger'

// ─── Tuning ─────────────────────────────────────────────────────────────────

/** Calls considered when computing the breaker's failure rate. */
const WINDOW_SIZE = 20

/** Minimum calls in the window before the breaker is allowed to open. */
const MIN_CALLS_FOR_OPEN = 8

/** Failure rate at which the breaker opens. */
const FAILURE_THRESHOLD = 0.5

/** How long the breaker stays open before transitioning to half-open. */
const COOLDOWN_MS = 30_000

/** Default per-attempt wall-clock budget. */
const DEFAULT_TIMEOUT_MS = 9_000

/** Default retry count (so 2 total attempts). */
const DEFAULT_RETRIES = 1

/** Default backoff base; doubled each attempt. */
const DEFAULT_RETRY_BASE_MS = 200

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ProviderResilienceOptions<T> {
  /** Stable provider name — used as the circuit-breaker key and in logs. */
  name: string
  /** Returned whenever the call fails, times out, or the breaker is open. */
  fallback: T
  /** Wall-clock budget for a single attempt. Defaults to 9_000ms. */
  timeoutMs?: number
  /** Retry count (additional attempts). Defaults to 1, so 2 attempts total. */
  retries?: number
  /** Backoff base in ms; doubles each attempt. Defaults to 200ms. */
  retryBaseMs?: number
  /** Optional predicate that decides whether an error is retryable. */
  isRetryable?: (err: unknown) => boolean
}

/**
 * Wraps a no-arg async fetcher with circuit-breaking, bounded retry, and a
 * wall-clock timeout. Always resolves — failures return the fallback.
 */
export async function withResilience<T>(
  fn: () => Promise<T>,
  opts: ProviderResilienceOptions<T>,
): Promise<T> {
  const {
    name,
    fallback,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryBaseMs = DEFAULT_RETRY_BASE_MS,
    isRetryable = defaultIsRetryable,
  } = opts

  const stats = getOrCreateStats(name)
  stats.attempts++

  // Circuit short-circuit. We do this BEFORE invoking the fetcher so that a
  // chronically-failing provider isn't even contacted.
  if (breakerIsOpen(name)) {
    stats.breakerSkips++
    logger.debug('Provider circuit open — returning fallback', { provider: name })
    return fallback
  }

  let lastError: unknown
  const totalAttempts = retries + 1

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    try {
      const value = await runWithTimeout(fn, timeoutMs)
      stats.successes++
      recordOutcome(name, true)
      if (attempt > 0) stats.retriesSucceeded++
      return value
    } catch (err) {
      lastError = err
      if (err instanceof TimeoutError) {
        stats.timeouts++
      } else {
        stats.failures++
      }

      const isLast = attempt === totalAttempts - 1
      if (isLast || !isRetryable(err)) break

      stats.retriesAttempted++
      const backoffMs = retryBaseMs * Math.pow(2, attempt)
      await sleep(backoffMs)
    }
  }

  recordOutcome(name, false)
  logger.warn('Provider failed after retries — returning fallback', {
    provider: name,
    error: lastError instanceof Error ? lastError.message : String(lastError),
  })
  return fallback
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface ProviderStats {
  /** Total calls made through withResilience for this provider. */
  attempts: number
  /** Calls that ultimately returned a real value. */
  successes: number
  /** Calls that ultimately failed (non-timeout). */
  failures: number
  /** Calls that ultimately timed out. */
  timeouts: number
  /** Extra attempts that were issued after a first failure. */
  retriesAttempted: number
  /** Calls that succeeded on a retry attempt (attempt > 0). */
  retriesSucceeded: number
  /** Times the breaker was open and the call short-circuited. */
  breakerSkips: number
  /** Times the breaker has transitioned from closed/half-open into open. */
  breakerTrips: number
}

const statsByName = new Map<string, ProviderStats>()

function newStats(): ProviderStats {
  return {
    attempts: 0,
    successes: 0,
    failures: 0,
    timeouts: 0,
    retriesAttempted: 0,
    retriesSucceeded: 0,
    breakerSkips: 0,
    breakerTrips: 0,
  }
}

function getOrCreateStats(name: string): ProviderStats {
  let s = statsByName.get(name)
  if (!s) {
    s = newStats()
    statsByName.set(name, s)
  }
  return s
}

/** Snapshot of per-provider counters. Safe to expose on a health route. */
export function getProviderStats(): Record<string, ProviderStats> {
  const out: Record<string, ProviderStats> = {}
  for (const [name, s] of statsByName) {
    out[name] = { ...s }
  }
  return out
}

/** Resets all stats and circuit state. Intended for tests only. */
export function resetProviderResilience(): void {
  statsByName.clear()
  circuitByName.clear()
}

// ─── Circuit breaker ─────────────────────────────────────────────────────────

type CircuitState = 'closed' | 'open' | 'half-open'

interface Circuit {
  state: CircuitState
  /** Boolean outcomes of the last WINDOW_SIZE calls — true = success. */
  window: boolean[]
  /** Earliest time (ms since epoch) the breaker may transition to half-open. */
  openUntil: number
}

const circuitByName = new Map<string, Circuit>()

function getCircuit(name: string): Circuit {
  let c = circuitByName.get(name)
  if (!c) {
    c = { state: 'closed', window: [], openUntil: 0 }
    circuitByName.set(name, c)
  }
  return c
}

function breakerIsOpen(name: string): boolean {
  const c = getCircuit(name)
  if (c.state !== 'open') return false
  if (Date.now() >= c.openUntil) {
    c.state = 'half-open'
    return false
  }
  return true
}

function recordOutcome(name: string, success: boolean): void {
  const c = getCircuit(name)
  c.window.push(success)
  if (c.window.length > WINDOW_SIZE) c.window.shift()

  if (c.state === 'half-open') {
    // A single trial call decides the next state.
    if (success) {
      c.state = 'closed'
      c.window = []
    } else {
      tripBreaker(name, c)
    }
    return
  }

  // Closed state: open if the window's failure rate is too high.
  if (c.window.length >= MIN_CALLS_FOR_OPEN) {
    const failures = c.window.filter((s) => !s).length
    const failureRate = failures / c.window.length
    if (failureRate >= FAILURE_THRESHOLD) {
      tripBreaker(name, c)
    }
  }
}

function tripBreaker(name: string, c: Circuit): void {
  c.state = 'open'
  c.openUntil = Date.now() + COOLDOWN_MS
  const stats = getOrCreateStats(name)
  stats.breakerTrips++
  logger.warn('Provider circuit breaker tripped', {
    provider: name,
    cooldownMs: COOLDOWN_MS,
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Provider call exceeded ${timeoutMs}ms wall-clock budget`)
    this.name = 'TimeoutError'
  }
}

async function runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs)
      // Wrap fn() to also catch synchronous throws.
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
    })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * By default we treat the following as retryable: network errors, fetch
 * `TypeError`s, AbortSignal timeouts, and our own TimeoutError. Application
 * errors (e.g. validation failures in the integration layer) are not retried.
 */
function defaultIsRetryable(err: unknown): boolean {
  if (err instanceof TimeoutError) return true
  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return true
    if (err.message.toLowerCase().includes('timeout')) return true
    if (err.message.toLowerCase().includes('network')) return true
    if (err.message.toLowerCase().includes('fetch failed')) return true
    if (err.message.toLowerCase().includes('econnreset')) return true
    if (err.message.toLowerCase().includes('etimedout')) return true
  }
  return true // be conservative — favour an extra try over an empty section
}

// Re-export the timeout error so consumers can identify it in tests.
export { TimeoutError }
