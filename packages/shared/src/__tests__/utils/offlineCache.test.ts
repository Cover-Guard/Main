import {
  evictOldestEntries,
  formatLastUpdated,
  isCacheStale,
  offlineStatusFromAge,
  totalCacheBytes,
} from '../../utils/offlineCache'
import {
  DEFAULT_OFFLINE_CACHE_CONFIG,
  OFFLINE_CACHE_LIMIT,
  OFFLINE_FRESHNESS_WINDOW_MS,
  type OfflineCacheEntry,
} from '../../types/offlineCache'

const NOW = new Date('2026-04-28T12:00:00Z')

function entry(reportId: string, cachedAt: string, byteSize = 1000): OfflineCacheEntry {
  return {
    reportId,
    addressLabel: `${reportId} address`,
    cachedAt,
    payload: '{}',
    byteSize,
  }
}

describe('offlineStatusFromAge', () => {
  it('returns offline when navigator.onLine is false', () => {
    expect(
      offlineStatusFromAge({
        isOnline: false,
        cachedAtIso: NOW.toISOString(),
        now: NOW,
      }),
    ).toBe('offline')
  })

  it('returns online when there is no cache entry yet', () => {
    expect(
      offlineStatusFromAge({ isOnline: true, cachedAtIso: null, now: NOW }),
    ).toBe('online')
  })

  it('returns online when cache is within the freshness window', () => {
    const cachedAt = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString() // 1h old
    expect(
      offlineStatusFromAge({ isOnline: true, cachedAtIso: cachedAt, now: NOW }),
    ).toBe('online')
  })

  it('returns stale when cache is older than the freshness window', () => {
    const cachedAt = new Date(
      NOW.getTime() - (OFFLINE_FRESHNESS_WINDOW_MS + 1000),
    ).toISOString()
    expect(
      offlineStatusFromAge({ isOnline: true, cachedAtIso: cachedAt, now: NOW }),
    ).toBe('stale')
  })

  it('treats unparseable timestamps as online so a live fetch can win', () => {
    expect(
      offlineStatusFromAge({
        isOnline: true,
        cachedAtIso: 'not-a-date',
        now: NOW,
      }),
    ).toBe('online')
  })
})

describe('isCacheStale', () => {
  it('is false when cachedAtIso is null', () => {
    expect(isCacheStale(null, NOW)).toBe(false)
  })

  it('is true when entry is older than the freshness window', () => {
    const old = new Date(NOW.getTime() - 48 * 60 * 60 * 1000).toISOString()
    expect(isCacheStale(old, NOW)).toBe(true)
  })

  it('is false when entry is within the freshness window', () => {
    const recent = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString()
    expect(isCacheStale(recent, NOW)).toBe(false)
  })
})

describe('formatLastUpdated', () => {
  it('returns "just now" for sub-minute deltas', () => {
    const ts = new Date(NOW.getTime() - 10_000).toISOString()
    expect(formatLastUpdated(ts, NOW)).toBe('just now')
  })

  it('returns "just now" for negative deltas (clock skew)', () => {
    const ts = new Date(NOW.getTime() + 5000).toISOString()
    expect(formatLastUpdated(ts, NOW)).toBe('just now')
  })

  it('returns "N min ago" for sub-hour deltas', () => {
    const ts = new Date(NOW.getTime() - 7 * 60 * 1000).toISOString()
    expect(formatLastUpdated(ts, NOW)).toBe('7 min ago')
  })

  it('returns "N hr ago" for sub-day deltas', () => {
    const ts = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString()
    expect(formatLastUpdated(ts, NOW)).toBe('3 hr ago')
  })

  it('returns "1 day ago" for exactly 1 day', () => {
    const ts = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
    expect(formatLastUpdated(ts, NOW)).toBe('1 day ago')
  })

  it('returns "N days ago" for multi-day deltas', () => {
    const ts = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatLastUpdated(ts, NOW)).toBe('5 days ago')
  })

  it('returns "unknown" for unparseable input', () => {
    expect(formatLastUpdated('garbage', NOW)).toBe('unknown')
  })
})

describe('evictOldestEntries', () => {
  it('returns at most config.limit entries, newest-first', () => {
    const entries: OfflineCacheEntry[] = []
    for (let i = 0; i < 60; i++) {
      const cachedAt = new Date(NOW.getTime() - i * 60_000).toISOString()
      entries.push(entry(`r${i}`, cachedAt))
    }
    const kept = evictOldestEntries(entries)
    expect(kept).toHaveLength(OFFLINE_CACHE_LIMIT)
    expect(kept[0].reportId).toBe('r0') // newest
    expect(kept[kept.length - 1].reportId).toBe(`r${OFFLINE_CACHE_LIMIT - 1}`)
  })

  it('returns the input sorted when under the cap', () => {
    const a = entry('a', '2026-04-28T11:00:00Z')
    const b = entry('b', '2026-04-28T11:30:00Z')
    const c = entry('c', '2026-04-28T10:00:00Z')
    const kept = evictOldestEntries([a, b, c])
    expect(kept.map((e) => e.reportId)).toEqual(['b', 'a', 'c'])
  })

  it('respects a custom limit', () => {
    const entries = [
      entry('a', '2026-04-28T11:00:00Z'),
      entry('b', '2026-04-28T11:30:00Z'),
      entry('c', '2026-04-28T10:00:00Z'),
    ]
    const kept = evictOldestEntries(entries, {
      ...DEFAULT_OFFLINE_CACHE_CONFIG,
      limit: 2,
    })
    expect(kept.map((e) => e.reportId)).toEqual(['b', 'a'])
  })

  it('returns an empty array when given empty input', () => {
    expect(evictOldestEntries([])).toEqual([])
  })
})

describe('totalCacheBytes', () => {
  it('sums byteSize across entries, ignoring negatives', () => {
    const entries: OfflineCacheEntry[] = [
      entry('a', NOW.toISOString(), 1000),
      entry('b', NOW.toISOString(), 2500),
      entry('c', NOW.toISOString(), -50), // ignored
    ]
    expect(totalCacheBytes(entries)).toBe(3500)
  })

  it('returns 0 for empty input', () => {
    expect(totalCacheBytes([])).toBe(0)
  })
})
