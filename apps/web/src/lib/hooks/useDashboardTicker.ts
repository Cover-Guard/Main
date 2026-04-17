'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardTicker } from '@coverguard/shared'
import { getDashboardTicker } from '@/lib/api'

interface UseDashboardTickerResult {
  data: DashboardTicker | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const FALLBACK_REFRESH_SECONDS = 60

/**
 * Polls the live dashboard ticker. Returns the latest snapshot plus a manual
 * `refresh()` to force a re-fetch. The polling interval honors the server's
 * `refreshIntervalSeconds` so we don't hammer the API.
 */
export function useDashboardTicker(): UseDashboardTickerResult {
  const [data, setData] = useState<DashboardTicker | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<number>(FALLBACK_REFRESH_SECONDS * 1000)

  const fetchTicker = useCallback(() => {
    return getDashboardTicker()
      .then((next) => {
        setData(next)
        setError(null)
        intervalRef.current = Math.max(15, next.refreshIntervalSeconds) * 1000
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load ticker'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      if (cancelled) return
      fetchTicker().finally(() => {
        if (cancelled) return
        timer = setTimeout(tick, intervalRef.current)
      })
    }

    tick()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [fetchTicker])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchTicker()
  }, [fetchTicker])

  return { data, loading, error, refresh }
}
