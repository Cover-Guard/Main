import type { Property, PropertyRiskProfile, InsuranceCostEstimate, InsurabilityStatus, CarriersResult, PropertyPublicData } from '@coverguard/shared'

/**
 * Lightweight LRU cache for hot in-process data.
 * Sits in front of the DB to absorb repeated reads for the same property.
 *
 * TTL is stored per-entry so each cache level can have different expiry.
 *
 * NOTE on serverless (Vercel): each function instance is short-lived, so these
 * in-process caches will be recycled frequently. Size them conservatively via
 * the CACHE_MAX_* environment variables (defaults are tuned for serverless).
 * Long-lived Node.js servers can set larger values.
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number // epoch ms
}

export class LRUCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>()

  constructor(
    private readonly maxSize: number,
    private readonly defaultTtlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    // LRU: re-insert to move to end
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.map.has(key)) this.map.delete(key)
    if (this.map.size >= this.maxSize) {
      // Evict the oldest (first) entry
      const firstKey = this.map.keys().next().value as string | undefined
      if (firstKey !== undefined) this.map.delete(firstKey)
    }
    this.map.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) })
  }

  delete(key: string): void {
    this.map.delete(key)
  }

  has(key: string): boolean {
    return this.get(key) !== undefined
  }

  get size(): number {
    return this.map.size
  }
}

// ── Cache size config ───────────────────────────────────────────────────────
// Read from env vars so each deployment environment can tune independently.
// Defaults are intentionally small for serverless (Vercel); increase for
// long-lived servers where the cache actually persists across requests.

/**
 * Parse a cache size from env var with validation.
 * Ensures the value is a positive integer.
 * Falls back to default if env var is missing, invalid, or negative.
 */
function parseCacheSize(envValue: string | undefined, defaultValue: number): number {
  if (envValue === undefined) return defaultValue
  const parsed = parseInt(envValue, 10)
  // Reject NaN, negative, or zero values
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(
      `Invalid cache size "${envValue}" (parsed as ${parsed}). Using default: ${defaultValue}`,
    )
    return defaultValue
  }
  return parsed
}

const MAX_PROPERTIES  = parseCacheSize(process.env.CACHE_MAX_PROPERTIES,   2000)
const MAX_RISK        = parseCacheSize(process.env.CACHE_MAX_RISK,        2000)
const MAX_INSURANCE   = parseCacheSize(process.env.CACHE_MAX_INSURANCE,   2000)
const MAX_CARRIERS    = parseCacheSize(process.env.CACHE_MAX_CARRIERS,    1000)
const MAX_INSURABILITY= parseCacheSize(process.env.CACHE_MAX_INSURABILITY, 2000)
const MAX_PUBLIC_DATA = parseCacheSize(process.env.CACHE_MAX_PUBLIC_DATA,  500)
const MAX_TOKENS      = parseCacheSize(process.env.CACHE_MAX_TOKENS,      10000)

// ── Shared cache instances ──────────────────────────────────────────────────
/** Auth token → { userId, userRole, hasActiveSub, subPlan } — 5 min TTL */
export const tokenCache = new LRUCache<{ userId: string; userRole: string; hasActiveSub: boolean; subPlan?: 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM' | null }>(
  MAX_TOKENS,
  5 * 60 * 1000,
)

/** Property detail — 30 min TTL */
export const propertyCache = new LRUCache<Property>(MAX_PROPERTIES, 30 * 60 * 1000)

/** Risk profile — 2 hour TTL */
export const riskCache = new LRUCache<PropertyRiskProfile>(MAX_RISK, 2 * 60 * 60 * 1000)

/** Insurance estimate — 2 hour TTL */
export const insuranceCache = new LRUCache<InsuranceCostEstimate>(MAX_INSURANCE, 2 * 60 * 60 * 1000)

/** Carriers result — 1 hour TTL */
export const carriersCache = new LRUCache<CarriersResult>(MAX_CARRIERS, 60 * 60 * 1000)

/** Insurability status — 6 hour TTL */
export const insurabilityCache = new LRUCache<InsurabilityStatus>(MAX_INSURABILITY, 6 * 60 * 60 * 1000)

/** Public property data — 24 hour TTL */
export const publicDataCache = new LRUCache<PropertyPublicData>(MAX_PUBLIC_DATA, 24 * 60 * 60 * 1000)

// ── Token revocation store ──────────────────────────────────────────────────
/**
 * Tracks revoked tokens so sign-out and account deletion take effect
 * immediately rather than waiting for the in-process tokenCache TTL to expire.
 *
 * Entries are stored with the token's own JWT expiry so the store doesn't
 * accumulate stale entries indefinitely. Opportunistic pruning runs when
 * the store exceeds 10,000 entries.
 *
 * Limitation: this is in-process only. In a multi-instance deployment,
 * revocations on one instance won't propagate to others. For full coverage,
 * replace this with a shared Redis/Upstash store.
 */
export class TokenRevocationStore {
  private readonly store = new Map<string, number>() // token → expiresAt epoch ms

  revoke(token: string, expiresAtMs: number): void {
    this.store.set(token, expiresAtMs)
    if (this.store.size > 10_000) this.prune()
  }

  isRevoked(token: string): boolean {
    const exp = this.store.get(token)
    if (exp === undefined) return false
    if (Date.now() > exp) {
      this.store.delete(token)
      return false
    }
    return true
  }

  private prune(): void {
    const now = Date.now()
    for (const [token, exp] of this.store) {
      if (now > exp) this.store.delete(token)
    }
  }
}

export const tokenRevocationStore = new TokenRevocationStore()

// ── Request deduplication ───────────────────────────────────────────────────
/**
 * Deduplicates concurrent in-flight async operations for the same key.
 * The second caller waits on the first caller's Promise instead of
 * spawning a duplicate external API call (cache stampede prevention).
 */
export class RequestDeduplicator<T> {
  private readonly inFlight = new Map<string, Promise<T>>()

  async dedupe(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) return existing
    const promise = fn().finally(() => {
      this.inFlight.delete(key)
    })
    this.inFlight.set(key, promise)
    return promise
  }
}

export const riskDeduplicator = new RequestDeduplicator<PropertyRiskProfile>()
export const insuranceDeduplicator = new RequestDeduplicator<InsuranceCostEstimate>()
export const insurabilityDeduplicator = new RequestDeduplicator<InsurabilityStatus>()
export const carriersDeduplicator = new RequestDeduplicator<CarriersResult>()
export const publicDataDeduplicator = new RequestDeduplicator<PropertyPublicData>()
