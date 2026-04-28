/**
 * Pure helpers for the offline cache surface area (P1 #7).
 *
 * These are intentionally storage-agnostic: callers (a service worker,
 * an IndexedDB adapter, a Jest test) hand in entries + a clock and get
 * back decisions. No I/O happens here.
 */

import {
  DEFAULT_OFFLINE_CACHE_CONFIG,
  type OfflineCacheConfig,
  type OfflineCacheEntry,
  type OfflineStatus,
} from '../types/offlineCache'

/**
 * Decide which {@link OfflineStatus} to surface in the UI.
 *
 *  - If the browser is offline, return `'offline'`.
 *  - Else if the cached entry is older than `config.freshnessWindowMs`,
 *    return `'stale'` so the banner nudges a refresh.
 *  - Otherwise return `'online'`.
 *
 * Pass `null` for `cachedAtIso` to short-circuit to `'online'` when there
 * is nothing in the cache yet (we trust the live fetch).
 */
export function offlineStatusFromAge({
  isOnline,
  cachedAtIso,
  now,
  config = DEFAULT_OFFLINE_CACHE_CONFIG,
}: {
  isOnline: boolean
  cachedAtIso: string | null
  now: Date
  config?: OfflineCacheConfig
}): OfflineStatus {
  if (!isOnline) return 'offline'
  if (!cachedAtIso) return 'online'
  const cachedAt = new Date(cachedAtIso).getTime()
  if (Number.isNaN(cachedAt)) return 'online'
  const ageMs = now.getTime() - cachedAt
  return ageMs > config.freshnessWindowMs ? 'stale' : 'online'
}

/**
 * Convenience: is a cache entry stale right now?
 *
 * Returns `false` if the timestamp is missing/unparseable - we'd rather
 * fall through to a live fetch than display a misleading staleness chip.
 */
export function isCacheStale(
  cachedAtIso: string | null,
  now: Date,
  config: OfflineCacheConfig = DEFAULT_OFFLINE_CACHE_CONFIG,
): boolean {
  if (!cachedAtIso) return false
  const cachedAt = new Date(cachedAtIso).getTime()
  if (Number.isNaN(cachedAt)) return false
  return now.getTime() - cachedAt > config.freshnessWindowMs
}

/**
 * Format a "Last updated" hint for the offline banner.
 *
 * Resolution buckets (kept deliberately coarse to avoid timezone foot-guns):
 *  - <1 min   -> "just now"
 *  - <1 hr    -> "N min ago"
 *  - <24 hr   -> "N hr ago"
 *  - else     -> "N day(s) ago"
 *
 * Returns `'just now'` for negative deltas (clock skew safety net).
 */
export function formatLastUpdated(cachedAtIso: string, now: Date): string {
  const cachedAt = new Date(cachedAtIso).getTime()
  if (Number.isNaN(cachedAt)) return 'unknown'
  const deltaMs = now.getTime() - cachedAt
  if (deltaMs < 60_000) return 'just now'
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/**
 * Apply the LRU cap to a list of cache entries.
 *
 * Returns a new array containing the `config.limit` most recently cached
 * entries, sorted newest-first. Original array is not mutated.
 *
 * If the input is already within the cap, the entries are still returned
 * sorted (so consumers can rely on a stable order downstream).
 */
export function evictOldestEntries(
  entries: readonly OfflineCacheEntry[],
  config: OfflineCacheConfig = DEFAULT_OFFLINE_CACHE_CONFIG,
): OfflineCacheEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const aT = new Date(a.cachedAt).getTime()
    const bT = new Date(b.cachedAt).getTime()
    return bT - aT
  })
  return sorted.slice(0, Math.max(0, config.limit))
}

/**
 * Total bytes currently held in the cache (sum of `byteSize`).
 *
 * Provided so a future quota UI can show "12 of 50 reports cached, 4.3 MB"
 * without each consumer re-implementing the reduction.
 */
export function totalCacheBytes(entries: readonly OfflineCacheEntry[]): number {
  return entries.reduce((sum, e) => sum + (e.byteSize > 0 ? e.byteSize : 0), 0)
}
