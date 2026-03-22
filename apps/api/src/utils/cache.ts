/**
 * Lightweight LRU cache for hot in-process data.
 * Sits in front of the DB to absorb repeated reads for the same property.
 *
 * TTL is stored per-entry so each cache level can have different expiry.
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
      const firstKey = this.map.keys().next().value
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

// ── Shared cache instances ────────────────────────────────────────────────────

/** Auth token → { userId, userRole } — 5 min TTL, 50k entries */
export const tokenCache = new LRUCache<{ userId: string; userRole: string }>(
  50_000,
  5 * 60 * 1000,
)

/** Property detail — 30 min TTL, 200k entries */
export const propertyCache = new LRUCache<unknown>(200_000, 30 * 60 * 1000)

/** Risk profile — 2 hour TTL, 200k entries */
export const riskCache = new LRUCache<unknown>(200_000, 2 * 60 * 60 * 1000)

/** Insurance estimate — 2 hour TTL, 200k entries */
export const insuranceCache = new LRUCache<unknown>(200_000, 2 * 60 * 60 * 1000)

/** Carriers result — 1 hour TTL, 100k entries */
export const carriersCache = new LRUCache<unknown>(100_000, 60 * 60 * 1000)

// ── Request deduplication ─────────────────────────────────────────────────────

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

export const riskDeduplicator = new RequestDeduplicator<unknown>()
export const insuranceDeduplicator = new RequestDeduplicator<unknown>()
