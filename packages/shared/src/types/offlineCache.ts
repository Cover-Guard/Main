/**
 * Types for the offline cache + responsive overhaul (P1 #7).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #7 - Mobile-First
 * Responsive Overhaul + Offline Mode").
 *
 * These types describe the shape of the offline cache so that UI,
 * service-worker, and storage adapters can agree without depending on
 * each other. The actual service worker and IndexedDB persistence land
 * in a follow-up PR - this file ships the contract.
 */

/**
 * High-level network/cache state surfaced to the UI.
 *
 *  - `online`  : we have connectivity AND fresh data from the network
 *  - `offline` : navigator.onLine is false; we are reading from cache only
 *  - `stale`   : we are online but the report cached locally is older
 *                than the freshness window - banner should nudge a refresh
 */
export type OfflineStatus = 'online' | 'offline' | 'stale'

/**
 * One entry in the on-device offline cache. Keyed by report id; we cap
 * the cache at OFFLINE_CACHE_LIMIT entries (LRU by `cachedAt`).
 */
export interface OfflineCacheEntry {
  /** Report id (matches the property report this entry caches). */
  reportId: string
  /** Address of the property - shown in the offline list view. */
  addressLabel: string
  /** ISO-8601 timestamp of when the payload was last refreshed. */
  cachedAt: string
  /**
   * Opaque payload - the consumer is responsible for parsing this.
   * Stored as a string so it can round-trip through any storage layer
   * (IndexedDB, SW Cache API, localStorage shim, etc.).
   */
  payload: string
  /** Approximate byte size of `payload`, for quota accounting. */
  byteSize: number
}

/**
 * Configuration for the cache layer. The defaults match the spec
 * (50-entry cap, 24h freshness window).
 */
export interface OfflineCacheConfig {
  /** Maximum number of entries kept on device. */
  limit: number
  /**
   * Number of milliseconds after which an entry is considered `stale`.
   * (We still serve it offline - staleness is a UI hint, not an eviction
   * trigger.)
   */
  freshnessWindowMs: number
}

/** Default cache cap from the spec ("most recent 50 reports"). */
export const OFFLINE_CACHE_LIMIT = 50

/** Default freshness window (24h). */
export const OFFLINE_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000

/** Default config - exported so consumers don't reinvent the constants. */
export const DEFAULT_OFFLINE_CACHE_CONFIG: OfflineCacheConfig = {
  limit: OFFLINE_CACHE_LIMIT,
  freshnessWindowMs: OFFLINE_FRESHNESS_WINDOW_MS,
}
