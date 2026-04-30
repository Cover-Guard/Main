'use client'

/**
 * Notification inbox preferences (PR 6).
 *
 * Two cards stacked inside the existing Notifications tab:
 *   1. "Inbox routing" — per-category × per-channel matrix, daily digest config,
 *      quiet hours.
 *   2. "Muted threads" — list of active mutes with an unmute button.
 *
 * Auto-saves on every toggle/select change. Optimistic update with toast on
 * failure so the UI never feels stuck. Read defaults come from the server,
 * which honours the same DEFAULT_USER_NOTIFICATION_PREFERENCES baked into
 * @coverguard/shared and the Postgres column DEFAULT.
 */

import { useEffect, useState } from 'react'
import { Loader2, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import {
  CATEGORY_LABEL,
  type NotificationCategory,
  type NotificationChannelMatrix,
  type NotificationMute,
  type UserNotificationPreferences,
} from '@coverguard/shared'
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  fetchActiveMutes,
  unmuteEntity,
} from '@/lib/chat'

const CATEGORY_ORDER: NotificationCategory[] = [
  'collaborative',
  'insight',
  'system',
  'lifecycle',
  'transactional',
]

const CHANNEL_ORDER: Array<{ key: 'inApp' | 'email' | 'push'; label: string }> = [
  { key: 'inApp', label: 'In-app' },
  { key: 'email', label: 'Email' },
  { key: 'push', label: 'Push' },
]

export function NotificationInboxPreferences() {
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null)
  const [mutes, setMutes] = useState<NotificationMute[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Initial load — fetch prefs and mutes in parallel.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, m] = await Promise.all([fetchNotificationPreferences(), fetchActiveMutes()])
        if (cancelled) return
        setPrefs(p)
        setMutes(m)
      } catch {
        if (cancelled) return
        toast('Could not load preferences', { description: 'Refresh to try again.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function patchPrefs(patch: Partial<UserNotificationPreferences>) {
    if (!prefs) return
    // Optimistic update so the UI flips instantly.
    const before = prefs
    const optimistic = { ...prefs, ...patch }
    setPrefs(optimistic)
    setSaving(true)
    try {
      const saved = await updateNotificationPreferences(patch)
      setPrefs(saved)
    } catch {
      // Roll back and show a toast — the user can retry.
      setPrefs(before)
      toast('Could not save', { description: 'Try again in a moment.' })
    } finally {
      setSaving(false)
    }
  }

  function setChannel(category: NotificationCategory, channel: 'inApp' | 'email' | 'push', value: boolean) {
    if (!prefs) return
    const channels: NotificationChannelMatrix = {
      ...prefs.channels,
      [category]: { ...prefs.channels[category], [channel]: value },
    }
    void patchPrefs({ channels })
  }

  async function handleUnmute(mute: NotificationMute) {
    // Optimistic remove.
    const before = mutes
    setMutes((prev) => prev.filter((m) => m.id !== mute.id))
    try {
      await unmuteEntity({ entityType: mute.entityType, entityId: mute.entityId })
    } catch {
      setMutes(before)
      toast('Could not unmute', { description: 'Try again in a moment.' })
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    )
  }
  if (!prefs) return null

  return (
    <div className="space-y-4">
      {/* Routing matrix */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Inbox routing</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose how each category is delivered. In-app shows in your bell; email and push are
              optional.
            </p>
          </div>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" aria-label="Saving" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="text-left font-medium pb-2">Category</th>
                {CHANNEL_ORDER.map((c) => (
                  <th key={c.key} className="text-center font-medium pb-2 px-2">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => (
                <tr key={cat} className="border-t border-gray-100">
                  <td className="py-2.5 text-gray-900">{CATEGORY_LABEL[cat]}</td>
                  {CHANNEL_ORDER.map((c) => (
                    <td key={c.key} className="py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${CATEGORY_LABEL[cat]} via ${c.label}`}
                        checked={prefs.channels[cat][c.key]}
                        onChange={(e) => setChannel(cat, c.key, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digest + quiet hours */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Digest & quiet hours</h2>
        <p className="text-xs text-gray-400 mb-4">
          A daily digest catches anything you missed. Quiet hours pause non-urgent notifications.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center justify-between text-sm gap-3">
            <span>Daily digest</span>
            <input
              type="checkbox"
              checked={prefs.digestEnabled}
              onChange={(e) => void patchPrefs({ digestEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between text-sm gap-3">
            <span>Digest hour (local)</span>
            <select
              value={prefs.digestHourLocal}
              onChange={(e) => void patchPrefs({ digestHourLocal: Number(e.target.value) })}
              className="rounded-md border border-gray-200 text-sm px-2 py-1"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between text-sm gap-3">
            <span>Quiet hours start</span>
            <select
              value={prefs.quietHoursStart ?? ''}
              onChange={(e) =>
                void patchPrefs({
                  quietHoursStart: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="rounded-md border border-gray-200 text-sm px-2 py-1"
            >
              <option value="">Off</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center justify-between text-sm gap-3">
            <span>Quiet hours end</span>
            <select
              value={prefs.quietHoursEnd ?? ''}
              onChange={(e) =>
                void patchPrefs({
                  quietHoursEnd: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="rounded-md border border-gray-200 text-sm px-2 py-1"
            >
              <option value="">Off</option>
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Muted threads */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Muted threads</h2>
        <p className="text-xs text-gray-400 mb-4">
          You won&apos;t get notifications for these. New ones still appear in their thread, just
          silently.
        </p>

        {mutes.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No muted threads.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {mutes.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <BellOff size={14} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700 truncate">
                    {m.entityType} · {m.entityId.slice(0, 8)}…
                  </span>
                  {m.expiresAt && (
                    <span className="text-[11px] text-gray-400">
                      until {new Date(m.expiresAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleUnmute(m)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium shrink-0"
                >
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
