import { Redis } from '@upstash/redis'
import { logger } from './logger'

/**
 * Upstash Redis singleton for the API.
 *
 * Used by:
 *   - Token revocation propagation across Vercel function instances (P-A3 wires this).
 *   - Optional: distributed cache for hot-path data (token validation cache).
 *
 * No-op if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset, so local
 * development without an Upstash project still works — callers fall back to the
 * in-process stores in `cache.ts`.
 *
 * Graceful degrade: every helper here returns null / false on transport error
 * rather than throwing. The middleware should treat "Redis unreachable" the
 * same as "Redis says no" — never fail the request, log to Sentry, fall back
 * to in-process state. The blast radius of a Redis outage is "sign-out
 * propagation gap of up to 5 min" (the in-process tokenCache TTL), which is
 * exactly the situation we already live with today.
 */

let client: Redis | null = null
let clientChecked = false

function getClient(): Redis | null {
  if (clientChecked) return client
  clientChecked = true
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    logger.info('Redis disabled — UPSTASH_REDIS_REST_URL/TOKEN not set; using in-process stores only')
    return null
  }
  client = new Redis({ url, token })
  return client
}

/** True if Redis is configured (env vars are present and the client is initialized). */
export function isRedisEnabled(): boolean {
  return getClient() !== null
}

/**
 * Set a key with a TTL in seconds. Returns true on success, false on failure
 * (including "Redis not configured" — that case is silent; transport errors
 * are logged).
 */
export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const c = getClient()
  if (!c) return false
  try {
    // Upstash's set with EX option, mirroring redis-cli semantics.
    await c.set(key, value, { ex: Math.max(1, Math.floor(ttlSeconds)) })
    return true
  } catch (err) {
    logger.warn('Redis set failed for key %s: %s', key, err instanceof Error ? err.message : String(err))
    return false
  }
}

/**
 * Get a key's value, or null if missing / expired / unreachable. The caller
 * must always be prepared for null (treat as "not in cache").
 */
export async function redisGet(key: string): Promise<string | null> {
  const c = getClient()
  if (!c) return null
  try {
    const v = await c.get<string>(key)
    return v ?? null
  } catch (err) {
    logger.warn('Redis get failed for key %s: %s', key, err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Check if a key exists. Returns false if missing, expired, or unreachable.
 * Used for revocation: "is this token revoked?" — false means "not revoked
 * according to Redis," which the caller combines with the in-process store.
 */
export async function redisExists(key: string): Promise<boolean> {
  const c = getClient()
  if (!c) return false
  try {
    const n = await c.exists(key)
    return n === 1
  } catch (err) {
    logger.warn('Redis exists failed for key %s: %s', key, err instanceof Error ? err.message : String(err))
    return false
  }
}

/** Delete a key. Idempotent; never throws. */
export async function redisDel(key: string): Promise<boolean> {
  const c = getClient()
  if (!c) return false
  try {
    await c.del(key)
    return true
  } catch (err) {
    logger.warn('Redis del failed for key %s: %s', key, err instanceof Error ? err.message : String(err))
    return false
  }
}

// ── Key namespaces ────────────────────────────────────────────────────────
// Centralize key construction so the auth middleware and the future cache
// wrapper both use consistent patterns. Tokens are hashed (sha256) before use
// as cache keys — they're sensitive material; we don't want them in Redis
// log dumps in cleartext.

export const RedisKeys = {
  /** revoked:<token-sha256> → "1" while revoked, with TTL = remaining JWT lifetime. */
  revokedToken: (tokenSha: string) => `cg:revoked:${tokenSha}`,
  /** tok:<token-sha256> → JSON-stringified user envelope, TTL = min(JWT exp, 5min). */
  tokenCache: (tokenSha: string) => `cg:tok:${tokenSha}`,
} as const
