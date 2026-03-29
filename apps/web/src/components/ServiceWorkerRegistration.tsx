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
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Service Worker registration failed:', err)
        }
      })
  }, [])

  return null
}
