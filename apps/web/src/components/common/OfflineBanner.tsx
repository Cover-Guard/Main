'use client'

import type { OfflineStatus } from '@coverguard/shared'
import { formatLastUpdated } from '@coverguard/shared'
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react'

/**
 * Mobile-first banner that surfaces network/cache state on the property
 * report (P1 #7).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #7 - Mobile-First
 * Responsive Overhaul + Offline Mode").
 *
 * Stateless and storage-agnostic - the parent decides the status (via
 * `offlineStatusFromAge`) and hands it in. Returns `null` for the
 * `online` case so we don't take up vertical space when there's nothing
 * to say.
 */
export interface OfflineBannerProps {
  /** Current network/cache state. Compute with `offlineStatusFromAge`. */
  status: OfflineStatus
  /**
   * ISO timestamp of when the visible report was last fetched. Used to
   * render a "Last updated <time>" hint per the spec acceptance criteria.
   */
  lastUpdatedAtIso?: string | null
  /**
   * Called when the user taps "Refresh" on a stale banner. Optional - if
   * omitted, the refresh affordance is hidden (e.g. for a static buyer
   * view).
   */
  onRefresh?: () => void
  /**
   * Override the clock for testing / SSR. Defaults to `new Date()`.
   * Marked optional so the common case stays a one-prop call.
   */
  now?: Date
}

interface BannerCopy {
  icon: typeof WifiOff
  label: string
  detail: (lastUpdated: string | null) => string
  tone: 'warning' | 'info'
}

const COPY: Record<Exclude<OfflineStatus, 'online'>, BannerCopy> = {
  offline: {
    icon: WifiOff,
    label: 'Offline',
    detail: (lu) =>
      lu
        ? `Showing the most recent cached report. Last updated ${lu}.`
        : 'Showing the most recent cached report.',
    tone: 'warning',
  },
  stale: {
    icon: CloudOff,
    label: 'May be out of date',
    detail: (lu) =>
      lu
        ? `This report was last refreshed ${lu}. Pull a fresh one before sharing.`
        : 'This report has not been refreshed recently. Pull a fresh one before sharing.',
    tone: 'info',
  },
}

export function OfflineBanner({
  status,
  lastUpdatedAtIso,
  onRefresh,
  now,
}: OfflineBannerProps) {
  if (status === 'online') return null

  const copy = COPY[status]
  const lastUpdated =
    lastUpdatedAtIso ? formatLastUpdated(lastUpdatedAtIso, now ?? new Date()) : null
  const Icon = copy.icon

  const toneClasses =
    copy.tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-sky-200 bg-sky-50 text-sky-900'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClasses}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{copy.label}</p>
          <p className="text-xs opacity-90">{copy.detail(lastUpdated)}</p>
        </div>
      </div>
      {onRefresh && status === 'stale' ? (
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 ring-1 ring-gray-200 hover:bg-gray-50 sm:self-auto"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Refresh
        </button>
      ) : null}
    </div>
  )
}
