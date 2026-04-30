'use client'

/**
 * Notification bell — Inbox v2 (PR 4) + mute (PR 5).
 *
 * Surfaces:
 *   • Bell button: badge tracks `actionableCount` (PR 3 behaviour).
 *   • Dropdown:   two tabs — "Action needed" and "All" — each with category
 *                 section headers, a small severity dot, and a "why am I
 *                 seeing this" affordance.
 *
 * Tab default: when the dropdown opens we show "Action needed" if there's
 * anything actionable, otherwise "All". This matches user intent — if the
 * badge is lit, you're here to deal with it; if it's not, you're browsing.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, BellRing, Info, BellOff } from 'lucide-react'
import {
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_LABEL,
  CATEGORY_REASON,
  SEVERITY_LABEL,
  severityDotClass,
  type AppNotification,
  type NotificationCategory,
} from '@coverguard/shared'
import { useNotifications, isActionable } from '@/lib/hooks/useNotifications'
import { requestPushPermission } from '@/lib/push'
import { muteEntity } from '@/lib/chat'
import { toast } from 'sonner'

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

type Tab = 'actionable' | 'all'

/**
 * Group notifications by category, preserving each group's original order
 * (which is reverse-chronological from the API). Returns groups in the order
 * defined by CATEGORY_DISPLAY_ORDER, omitting empty groups.
 */
function groupByCategory(
  items: AppNotification[],
): Array<{ category: NotificationCategory; items: AppNotification[] }> {
  const buckets = new Map<NotificationCategory, AppNotification[]>()
  for (const n of items) {
    const arr = buckets.get(n.category) ?? []
    arr.push(n)
    buckets.set(n.category, arr)
  }
  return CATEGORY_DISPLAY_ORDER
    .map((c) => ({ category: c, items: buckets.get(c) ?? [] }))
    .filter((g) => g.items.length > 0)
}

export function NotificationBell() {
  const { items, unreadCount, actionableCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('actionable')
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>(
    'default',
  )
  const ref = useRef<HTMLDivElement | null>(null)

  // Reflect current browser permission so we can show the correct CTA.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPushStatus('unsupported')
      return
    }
    setPushStatus(Notification.permission as 'default' | 'granted' | 'denied')
  }, [open])

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Filter + cap items per tab. Actionable shows everything urgent first;
  // All shows the most recent across categories.
  const visible = useMemo(() => {
    const filtered = tab === 'actionable' ? items.filter(isActionable) : items
    return filtered.slice(0, 30)
  }, [items, tab])

  const grouped = useMemo(() => groupByCategory(visible), [visible])

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label={`Notifications${actionableCount > 0 ? ` (${actionableCount} requiring action)` : ''}`}
        onClick={() => {
          // When opening, default to whichever tab has content. Done in the
          // click handler (not an effect) — the trigger is a user action, not
          // external state. See react-hooks/set-state-in-effect.
          if (!open) setTab(actionableCount > 0 ? 'actionable' : 'all')
          setOpen((o) => !o)
        }}
        className="relative flex items-center justify-center p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        {actionableCount > 0 ? <BellRing size={14} /> : <Bell size={14} />}
        {actionableCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-[10px] font-semibold text-white flex items-center justify-center"
            aria-hidden
          >
            {actionableCount > 9 ? '9+' : actionableCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header: tabs + mark-all-read */}
          <div className="flex items-center justify-between px-3 pt-2 pb-0 border-b border-gray-100">
            <div role="tablist" aria-label="Notification filter" className="flex gap-1">
              <TabButton
                active={tab === 'actionable'}
                onClick={() => setTab('actionable')}
                label="Action needed"
                count={actionableCount}
              />
              <TabButton
                active={tab === 'all'}
                onClick={() => setTab('all')}
                label="All"
                count={unreadCount}
              />
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 mb-1"
              >
                <Check size={11} /> Mark all read
              </button>
            )}
          </div>

          {/* Body: category sections or empty state */}
          <div className="max-h-96 overflow-y-auto">
            {grouped.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              grouped.map(({ category, items: groupItems }) => (
                <section key={category} aria-label={CATEGORY_LABEL[category]}>
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {CATEGORY_LABEL[category]}
                    </h4>
                  </div>
                  {groupItems.map((n) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onClick={async () => {
                        if (!n.readAt) await markRead([n.id])
                        if (n.linkUrl) window.location.href = n.linkUrl
                        setOpen(false)
                      }}
                      onMute={async () => {
                        if (!n.entityType || !n.entityId) return
                        try {
                          await muteEntity({
                            entityType: n.entityType,
                            entityId: n.entityId,
                          })
                          toast('Muted', {
                            description:
                              "You won't get new notifications for this thread.",
                          })
                        } catch {
                          toast('Could not mute', {
                            description: 'Try again in a moment.',
                          })
                        }
                      }}
                    />
                  ))}
                </section>
              ))
            )}
          </div>

          {/* Push permission CTA — unchanged from PR 3 */}
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

interface TabButtonProps {
  active: boolean
  onClick: () => void
  label: string
  count: number
}

function TabButton({ active, onClick, label, count }: TabButtonProps) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`text-[12px] font-medium px-2 py-1 rounded-t-md border-b-2 -mb-px transition-colors ${
        active
          ? 'text-indigo-700 border-indigo-600'
          : 'text-gray-500 border-transparent hover:text-gray-700'
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`ml-1 text-[10px] ${active ? 'text-indigo-600' : 'text-gray-400'}`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

function EmptyState({ tab }: { tab: Tab }) {
  const message =
    tab === 'actionable'
      ? "Nothing needs your attention right now."
      : "You're all caught up."
  return (
    <p className="px-3 py-8 text-xs text-gray-500 text-center">{message}</p>
  )
}

interface NotificationRowProps {
  n: AppNotification
  onClick: () => void
  onMute: () => void
}

function NotificationRow({ n, onClick, onMute }: NotificationRowProps) {
  const unread = !n.readAt
  const dot = severityDotClass(n.severity)
  const reason = CATEGORY_REASON[n.category]
  // Only items tied to a domain entity can be muted. The DM trigger always
  // populates these for collaborative items; insights / lifecycle may not.
  const canMute = !!n.entityType && !!n.entityId

  return (
    <div
      className={`relative flex gap-2 px-3 py-2 border-b border-gray-50 hover:bg-gray-50 ${
        unread ? 'bg-indigo-50/40' : ''
      }`}
    >
      <div
        className={`mt-1 h-2 w-2 rounded-full shrink-0 ${dot}`}
        aria-label={SEVERITY_LABEL[n.severity]}
      />
      <button
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-xs font-medium text-gray-900 truncate">{n.title}</p>
        {n.body && <p className="text-[11px] text-gray-600 line-clamp-2">{n.body}</p>}
        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)} ago</p>
      </button>
      {canMute && (
        <button
          type="button"
          title="Mute this thread"
          aria-label="Mute this thread"
          className="self-start mt-0.5 p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            onMute()
          }}
        >
          <BellOff size={12} />
        </button>
      )}
      {/* Why-am-I-seeing-this. Native title tooltip — works without a JS
          tooltip library and is screen-reader-friendly. */}
      <button
        type="button"
        title={reason}
        aria-label={`Why am I seeing this? ${reason}`}
        className="self-start mt-0.5 p-0.5 text-gray-400 hover:text-gray-600 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Info size={12} />
      </button>
    </div>
  )
}
