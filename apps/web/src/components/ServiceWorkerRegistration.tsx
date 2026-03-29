'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker on mount.
 * Required for TWA (Trusted Web Activity) on the Google Play Store.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Service worker registration failed — non-critical for app functionality
      })
  }, [])

  return null
}
