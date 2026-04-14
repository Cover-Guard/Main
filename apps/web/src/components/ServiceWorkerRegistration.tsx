'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker on mount.
 *
 * Required for TWA (Trusted Web Activity) on the Google Play Store.
 *
 * Also subscribes to `SW_UPDATED` messages broadcast from the service
 * worker's `activate` handler (see lib/sw-template.ts). When a new
 * production release is deployed, the fresh SW installs, activates,
 * takes control, and tells any open tabs to soft-reload. This lets us
 * pick up new JS/CSS bundles after a deploy without users needing to
 * manually clear their cache or log out.
 *
 * We cap automatic reloads at 2 per browser session to avoid a reload
 * loop if something pathological is happening (e.g., two SWs fighting).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Service Worker registration failed:', err)
        }
      })

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined
      if (data?.type !== 'SW_UPDATED') return

      // Cap reloads to avoid loops if a new SW keeps re-broadcasting
      let count = 0
      try {
        count = Number(sessionStorage.getItem('cg_reload_count') || '0')
      } catch {
        // sessionStorage may be unavailable (private mode, iframe, etc.)
      }
      if (count >= 2) return
      try {
        sessionStorage.setItem('cg_reload_count', String(count + 1))
      } catch {
        // ignore
      }
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  return null
}
