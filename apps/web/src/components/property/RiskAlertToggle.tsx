'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, BellOff, ChevronDown } from 'lucide-react'
import { getRiskAlertForProperty, createRiskAlert, updateRiskAlert, deleteRiskAlert } from '@/lib/api'
import type { RiskAlert, AlertFrequency, RiskType } from '@coverguard/shared'

const RISK_TYPES: RiskType[] = ['FLOOD', 'FIRE', 'WIND', 'EARTHQUAKE', 'CRIME']
const FREQUENCY_LABELS: Record<AlertFrequency, string> = {
  IMMEDIATE: 'Immediate',
  DAILY: 'Daily digest',
  WEEKLY: 'Weekly digest',
}

interface Props {
  propertyId: string
}

export function RiskAlertToggle({ propertyId }: Props) {
  const [alert, setAlert] = useState<RiskAlert | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadAlert = useCallback(async () => {
    try {
      const data = await getRiskAlertForProperty(propertyId)
      setAlert(data)
    } catch {
      // Ignore — user may not be authenticated
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  useEffect(() => { loadAlert() }, [loadAlert])

  async function handleToggle() {
    setSaving(true)
    try {
      if (alert) {
        if (alert.enabled) {
          const updated = await updateRiskAlert(alert.id, { enabled: false })
          setAlert(updated)
        } else {
          const updated = await updateRiskAlert(alert.id, { enabled: true })
          setAlert(updated)
        }
      } else {
        const created = await createRiskAlert({ propertyId })
        setAlert(created)
      }
    } catch {
      // Silently handle — user may not have subscription
    } finally {
      setSaving(false)
    }
  }

  async function handleFrequencyChange(frequency: AlertFrequency) {
    if (!alert) return
    setSaving(true)
    try {
      const updated = await updateRiskAlert(alert.id, { frequency })
      setAlert(updated)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRiskType(type: RiskType) {
    if (!alert) return
    const current = alert.riskTypes as RiskType[]
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    if (updated.length === 0) return // Must have at least one
    setSaving(true)
    try {
      const result = await updateRiskAlert(alert.id, { riskTypes: updated })
      setAlert(result)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!alert) return
    setSaving(true)
    try {
      await deleteRiskAlert(alert.id)
      setAlert(null)
      setExpanded(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
      </div>
    )
  }

  const isActive = alert?.enabled ?? false

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive ? (
            <Bell className="h-4 w-4 text-blue-500" />
          ) : (
            <BellOff className="h-4 w-4 text-gray-400" />
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">Risk Alerts</p>
            <p className="text-[10px] text-gray-400">
              {isActive
                ? `${FREQUENCY_LABELS[alert!.frequency]} notifications enabled`
                : 'Get notified when risk scores change'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alert && isActive && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isActive ? 'bg-blue-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Expanded settings */}
      {expanded && alert && isActive && (
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-3">
          {/* Frequency */}
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Frequency</p>
            <div className="flex gap-1.5">
              {(Object.keys(FREQUENCY_LABELS) as AlertFrequency[]).map((freq) => (
                <button
                  key={freq}
                  onClick={() => handleFrequencyChange(freq)}
                  disabled={saving}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    alert.frequency === freq
                      ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {FREQUENCY_LABELS[freq]}
                </button>
              ))}
            </div>
          </div>

          {/* Risk types */}
          <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1.5">Risk Types</p>
            <div className="flex flex-wrap gap-1.5">
              {RISK_TYPES.map((type) => {
                const active = (alert.riskTypes as RiskType[]).includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => handleToggleRiskType(type)}
                    disabled={saving}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      active
                        ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Remove */}
          <button
            onClick={handleRemove}
            disabled={saving}
            className="text-xs text-red-500 hover:text-red-600 hover:underline"
          >
            Remove alert
          </button>
        </div>
      )}
    </div>
  )
}
