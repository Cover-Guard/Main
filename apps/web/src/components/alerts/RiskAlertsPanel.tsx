'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  AlertOctagon,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getRiskAlerts,
  getUnreadAlertCount,
  markAlertRead,
  markAllAlertsRead,
  getAlertPreferences,
  updateAlertPreferences,
} from '@/lib/api'
import type { RiskAlert, RiskAlertPreferences, RiskAlertSeverity } from '@coverguard/shared'

const SEVERITY_STYLES: Record<RiskAlertSeverity, { bg: string; text: string; border: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertOctagon },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle },
  MODERATE: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: Info },
  LOW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Info },
}

const SEVERITY_BADGE: Record<RiskAlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MODERATE: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-blue-100 text-blue-700',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function RiskAlertsPanel() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPrefs, setShowPrefs] = useState(false)
  const [prefs, setPrefs] = useState<RiskAlertPreferences | null>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const limit = 20

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, countData] = await Promise.all([
        getRiskAlerts(page, limit, unreadOnly),
        getUnreadAlertCount(),
      ])
      setAlerts(data.alerts)
      setTotal(data.total)
      setUnreadCount(countData.count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [page, unreadOnly])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function handleMarkRead(id: string) {
    try {
      await markAlertRead(id)
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // Silently fail — not critical
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllAlertsRead()
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))
      setUnreadCount(0)
    } catch {
      // Silently fail
    }
  }

  async function loadPreferences() {
    try {
      const p = await getAlertPreferences()
      setPrefs(p)
      setShowPrefs(true)
    } catch {
      // ignore
    }
  }

  async function savePreferences(update: Partial<RiskAlertPreferences>) {
    if (!prefs) return
    setSavingPrefs(true)
    try {
      const updated = await updateAlertPreferences(update)
      setPrefs(updated)
    } catch {
      // ignore
    } finally {
      setSavingPrefs(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="h-6 w-6 text-gray-700" />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Risk Alerts</h2>
            <p className="text-sm text-gray-500">
              {total} alert{total !== 1 ? 's' : ''} · {unreadCount} unread
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPreferences}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600"
          >
            <Settings className="h-4 w-4" />
            Preferences
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm text-brand-600"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Preferences panel */}
      {showPrefs && prefs && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Alert Preferences</h3>
            <button onClick={() => setShowPrefs(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.riskAlertEnabled}
                onChange={(e) => savePreferences({ riskAlertEnabled: e.target.checked })}
                disabled={savingPrefs}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm text-gray-700">Enable risk alerts for saved properties</span>
            </label>
            <div>
              <label className="text-sm font-medium text-gray-700">Minimum severity threshold</label>
              <select
                value={prefs.riskAlertThreshold}
                onChange={(e) => savePreferences({ riskAlertThreshold: e.target.value })}
                disabled={savingPrefs}
                className="input mt-1 w-full max-w-xs"
              >
                <option value="LOW">Low (all alerts)</option>
                <option value="MODERATE">Moderate and above</option>
                <option value="HIGH">High and above</option>
                <option value="CRITICAL">Critical only</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => { setUnreadOnly(false); setPage(1) }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            !unreadOnly ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          All
        </button>
        <button
          onClick={() => { setUnreadOnly(true); setPage(1) }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            unreadOnly ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          Unread
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && alerts.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <Bell className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="font-semibold text-gray-700">No alerts</h3>
          <p className="mt-1 text-sm text-gray-500">
            {unreadOnly
              ? 'You have no unread alerts. Switch to "All" to see past alerts.'
              : 'Risk alerts will appear here when risk levels change for your saved properties.'}
          </p>
        </div>
      )}

      {/* Alert list */}
      {!loading && !error && alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity as RiskAlertSeverity] ?? SEVERITY_STYLES.LOW
            const Icon = style.icon
            return (
              <div
                key={alert.id}
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm transition-all',
                  alert.isRead ? 'border-gray-100 opacity-75' : `${style.border}`,
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 rounded-lg p-2', style.bg)}>
                    <Icon className={cn('h-4 w-4', style.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', SEVERITY_BADGE[alert.severity as RiskAlertSeverity] ?? SEVERITY_BADGE.LOW)}>
                        {alert.severity}
                      </span>
                      {alert.riskCategory && (
                        <span className="text-[10px] font-medium text-gray-400 uppercase">{alert.riskCategory}</span>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(alert.createdAt)}</span>
                      {!alert.isRead && (
                        <span className="h-2 w-2 rounded-full bg-brand-500" />
                      )}
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">{alert.title}</h4>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                    {alert.property && (
                      <Link
                        href={`/properties/${alert.propertyId}`}
                        className="mt-2 inline-block text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        {alert.property.address}, {alert.property.city} {alert.property.state}
                      </Link>
                    )}
                  </div>
                  {!alert.isRead && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="btn-ghost p-1.5 text-gray-400 hover:text-green-600"
                      title="Mark as read"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
