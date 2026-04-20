'use client'

/**
 * Notification bell — a small widget that renders the unread count and opens a
 * dropdown with recent notifications. Lives in the Dashboard header (and could
 * be dropped into the sidebar or any other shell later).
 */

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, BellRing } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/useNotifications'
import { requestPushPermission } from '@/lib/push'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  return `${d}d`
}

export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(
    'default',
  )
  const ref = useRef<HTMLDivElement | null>(null)

  // Reflect current browser permission so we can show the correct CTA.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setPushStatus('unsupported')
      return
    }
    setPushStatus(Notification.permission as 'default' | 'granted' | 'denied')
  }, [open])

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const recent = items.slice(0, 10)

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {unreadCount > 0 ? <BellRing size={14} /> : <Bell size={14} />}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center"
            aria-hidden
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
              >
                <Check size={11} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-500 text-center">
                You&apos;re all caught up.
              </p>
            )}
            {recent.map((n) => {
              const unread = !n.readAt
              return (
                <button
                  key={n.id}
                  onClick={async () => {
                    if (unread) await markRead([n.id])
                    if (n.linkUrl) window.location.href = n.linkUrl
                    setOpen(false)
                  }}
                  className={`w-full text-left flex gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50 ${
                    unread ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <div
                    className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      unread ? 'bg-indigo-600' : 'bg-transparent'
                    }`}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{n.title}</p>
                    {n.body && <p className="text-[11px] text-gray-600 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)} ago</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Push permission CTA — shown when the browser supports it but we
              haven't asked yet. Once granted or denied, this strip goes away. */}
          {pushStatus === 'default' && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-[11px] text-gray-600 mb-1">
                Get a browser alert even when CoverGuard is closed.
              </p>
              <button
                onClick={async () => {
                  const ok = await requestPushPermission()
                  setPushStatus(ok ? 'granted' : 'denied')
                }}
                className="w-full text-[11px] px-2 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
              >
                Enable push notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
