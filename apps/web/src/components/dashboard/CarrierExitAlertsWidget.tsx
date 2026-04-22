'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, XCircle, CheckCircle2, RefreshCw, BellOff } from 'lucide-react'
import type { CarrierExitAlert } from '@coverguard/shared'
import { getCarrierExitAlerts, acknowledgeCarrierExitAlert } from '@/lib/api'

const SEVERITY_CONFIG: Record<
  CarrierExitAlert['severity'],
  { container: string; iconClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  CRITICAL: {
    container: 'border-red-200 bg-red-50 text-red-900',
    iconClass: 'text-red-600',
    Icon: XCircle,
  },
  WARNING: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    iconClass: 'text-amber-600',
    Icon: AlertTriangle,
  },
  INFO: {
    container: 'border-blue-200 bg-blue-50 text-blue-900',
    iconClass: 'text-blue-600',
    Icon: CheckCircle2,
  },
}

/**
 * Agent-dashboard widget that surfaces carrier-exit / re-open alerts for the
 * logged-in agent's book of business. Supports acknowledge and refresh.
 *
 * Spec: docs/gtm/value-add-activities/01-carrier-exit-alert.md
 */
export function CarrierExitAlertsWidget() {
  const [alerts, setAlerts] = useState<CarrierExitAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getCarrierExitAlerts({ limit: 5 })
      setAlerts(data.filter((a) => !a.acknowledged))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  async function handleAcknowledge(id: string) {
    // Optimistic hide.
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    try {
      await acknowledgeCarrierExitAlert(id)
    } catch {
      // Rollback is acceptable here — next refresh will restore state.
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Checking carrier activity…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">Carrier alerts unavailable.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500">
        <BellOff className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        No new carrier-exit alerts for your book. We&rsquo;ll notify you if a carrier closes a ZIP you have exposure in.
      </div>
    )
  }

  return (
    <section aria-label="Carrier exit alerts" className="space-y-2">
      {alerts.map((alert) => {
        const config = SEVERITY_CONFIG[alert.severity]
        const Icon = config.Icon
        return (
          <div
            key={alert.id}
            role="alert"
            className={`flex items-start gap-3 rounded-xl border p-3 ${config.container}`}
          >
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconClass}`} aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{alert.headline}</p>
              <p className="mt-0.5 text-xs">{alert.callToAction}</p>
              {alert.affectedPolicyCount > 0 && (
                <p className="mt-1 text-[11px] uppercase tracking-wide opacity-75">
                  {alert.affectedPolicyCount} polic
                  {alert.affectedPolicyCount === 1 ? 'y' : 'ies'} affected
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleAcknowledge(alert.id)}
              className="rounded-md px-2 py-1 text-xs font-medium opacity-80 hover:opacity-100 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )
      })}
    </section>
  )
}
