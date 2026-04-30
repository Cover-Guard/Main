'use client'

/**
 * Global notifications provider.
 *
 * Responsibilities:
 *  1. Hydrates the current user's recent notifications on mount.
 *  2. Subscribes to Supabase Realtime for new rows on `notifications` filtered
 *     to the current user, so the bell badge + toast fire instantly.
 *  3. Exposes a tiny API (markRead / markAllRead / refresh) to consumers.
 *  4. Opportunistically registers the browser for web-push on first load —
 *     idempotent, and silently no-ops if the user hasn't granted permission.
 *
 * PR 3 changes:
 *  - Adds `actionableCount`. The bell's badge tracks this rather than total
 *    unread, so informational items (e.g. agent replies, lifecycle nudges)
 *    no longer cry wolf. Total unread is still available as `unreadCount`
 *    for the All tab in PR 4.
 *  - Toast hygiene: a realtime insert only triggers a toast when its severity
 *    is in ACTIONABLE_SEVERITIES. Info-level items go silently to the inbox.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { ACTIONABLE_SEVERITIES, type AppNotification } from '@coverguard/shared'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  subscribeNotifications,
} from '@/lib/chat'
import { createClient } from '@/lib/supabase/client'
import { ensurePushSubscription } from '@/lib/push'

const ACTIONABLE_SET = new Set<string>(ACTIONABLE_SEVERITIES)

/** True iff this notification should drive the actionable badge + a toast. */
export function isActionable(n: Pick<AppNotification, 'severity'>): boolean {
  return ACTIONABLE_SET.has(n.severity)
}

interface NotificationsContextValue {
  items: AppNotification[]
  /** Total unread (any severity). Surfaced for the All tab in PR 4. */
  unreadCount: number
  /** Unread + severity in ACTIONABLE_SEVERITIES. Drives the bell badge. */
  actionableCount: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await fetchNotifications()
      setItems(list)
    } catch {
      // Non-fatal; the bell will simply show whatever it already has.
    } finally {
      setLoading(false)
    }
  }, [])

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    await markNotificationsRead(ids)
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    )
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })))
  }, [])

  // Initial load + realtime subscription, keyed to the authenticated user.
  useEffect(() => {
    let unsub: (() => void) | undefined
    ;(async () => {
      const { data } = await createClient().auth.getUser()
      const userId = data.user?.id ?? null
      userIdRef.current = userId
      if (!userId) {
        setLoading(false)
        return
      }

      await refresh()

      unsub = subscribeNotifications(userId, (n) => {
        setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]))
        // Toast only for actionable+. Info-severity items appear silently in
        // the inbox; the bell badge will not light up for them either.
        if (!isActionable(n)) return
        try {
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.linkUrl
              ? {
                  label: 'Open',
                  onClick: () => {
                    if (n.linkUrl) window.location.href = n.linkUrl
                  },
                }
              : undefined,
          })
        } catch {
          // Sonner Toaster may not be mounted yet on the very first render —
          // the in-app badge will still reflect the new notification.
        }
      })

      // Best-effort push registration. This is async and doesn't block anything.
      void ensurePushSubscription().catch(() => {
        // Permission denied or unsupported — silently ignore.
      })
    })()
    return () => {
      unsub?.()
    }
  }, [refresh])

  const value = useMemo<NotificationsContextValue>(() => {
    let unread = 0
    let actionable = 0
    for (const n of items) {
      if (n.readAt) continue
      unread++
      if (isActionable(n)) actionable++
    }
    return {
      items,
      unreadCount: unread,
      actionableCount: actionable,
      loading,
      refresh,
      markRead,
      markAllRead,
    }
  }, [items, loading, refresh, markRead, markAllRead])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    // Providing a no-op fallback means individual components won't crash if they
    // happen to render outside the provider (e.g. in Storybook or tests).
    return {
      items: [],
      unreadCount: 0,
      actionableCount: 0,
      loading: false,
      refresh: async () => {},
      markRead: async () => {},
      markAllRead: async () => {},
    }
  }
  return ctx
}
