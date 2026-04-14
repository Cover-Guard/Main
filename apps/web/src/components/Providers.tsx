'use client'

import { useEffect, type ReactNode } from 'react'
import { SubscriptionProvider } from '@/lib/hooks/useSubscription'

/**
 * Client-side providers that wrap the entire app.
 * Mounted inside the root <body> so all pages can access shared context.
 *
 * Also installs two release-resilience hooks so users don't have to
 * manually log out or clear their cache after a production deploy:
 *
 *  1. ChunkLoadError auto-recovery — if a user has a tab open across
 *     a deploy and then navigates to a lazy-loaded route whose chunk
 *     no longer exists on the server, we soft-reload once so the
 *     browser picks up the new chunk graph. This catches both sync
 *     `error` events and unhandled promise rejections from dynamic
 *     imports.
 *
 *  2. Version drift check on tab focus — when a tab regains
 *     visibility, compare the build id it was shipped with
 *     (NEXT_PUBLIC_APP_VERSION, baked at build time via next.config.ts)
 *     against the server's current `x-app-version` response header.
 *     If they differ, a new release has shipped; reload so the user
 *     is on the current build.
 *
 * Both reloads are capped at 2 per session to prevent loops.
 */

function ReleaseResilience() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const safeReload = () => {
      let count = 0
      try {
        count = Number(sessionStorage.getItem('cg_reload_count') || '0')
      } catch {
        // sessionStorage may be unavailable (private mode, sandboxed iframe)
      }
      if (count >= 2) return
      try {
        sessionStorage.setItem('cg_reload_count', String(count + 1))
      } catch {
        // ignore
      }
      window.location.reload()
    }

    const looksLikeChunkError = (input: string | undefined, name?: string): boolean => {
      if (name === 'ChunkLoadError') return true
      if (!input) return false
      return (
        /Loading chunk [^\s]+ failed/i.test(input) ||
        /ChunkLoadError/i.test(input) ||
        /Failed to fetch dynamically imported module/i.test(input) ||
        /Importing a module script failed/i.test(input)
      )
    }

    const handleError = (event: ErrorEvent) => {
      const err = event.error as Error | undefined
      if (looksLikeChunkError(event.message, err?.name)) {
        safeReload()
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined
      if (!reason) return
      if (looksLikeChunkError(reason.message, reason.name)) {
        safeReload()
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    // ─── Version drift check on tab focus ───────────────────────────
    // NEXT_PUBLIC_APP_VERSION is baked into the client bundle at build
    // time via next.config.ts. The server's current build id comes back
    // on every response as `x-app-version`. When they disagree, this
    // tab is running stale code.
    const shippedVersion = process.env.NEXT_PUBLIC_APP_VERSION

    const checkVersion = async () => {
      if (!shippedVersion) return
      if (document.visibilityState !== 'visible') return
      try {
        // HEAD `/` is cheap and always returns our global header stack.
        // `no-store` skips HTTP cache so we always hit the origin.
        const res = await fetch('/', { method: 'HEAD', cache: 'no-store' })
        const current = res.headers.get('x-app-version')
        if (current && current !== shippedVersion) {
          safeReload()
        }
      } catch {
        // Network error — ignore, we'll retry on next focus
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SubscriptionProvider>
      <ReleaseResilience />
      {children}
    </SubscriptionProvider>
  )
}
