import type { InsurabilityStatus } from '@coverguard/shared'
import { riskLevelToLabel } from '@coverguard/shared'
import { CheckCircle, XCircle, AlertTriangle, Info, Droplets, Flame, Wind, Mountain, ShieldAlert } from 'lucide-react'

const DIFFICULTY_CONFIG = {
  LOW:       { label: 'Easily Insurable',         color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', icon: CheckCircle,     iconColor: 'text-green-600' },
  MODERATE:  { label: 'Insurable with Conditions', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertTriangle,   iconColor: 'text-yellow-600' },
  HIGH:      { label: 'Difficult to Insure',       color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: AlertTriangle,   iconColor: 'text-orange-600' },
  VERY_HIGH: { label: 'Very Hard to Insure',       color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: XCircle,         iconColor: 'text-red-600' },
  EXTREME:   { label: 'Potentially Uninsurable',   color: 'text-red-900',    bg: 'bg-red-100',   border: 'border-red-300',    icon: XCircle,         iconColor: 'text-red-900' },
}

const SCORE_BAR_COLOR: Record<string, string> = {
  LOW:       'bg-green-400',
  MODERATE:  'bg-yellow-400',
  HIGH:      'bg-orange-400',
  VERY_HIGH: 'bg-red-400',
  EXTREME:   'bg-red-700',
}

const CATEGORY_ICONS = {
  flood:      Droplets,
  fire:       Flame,
  wind:       Wind,
  earthquake: Mountain,
  crime:      ShieldAlert,
}

const CATEGORY_LABELS = {
  flood:      'Flood',
  fire:       'Fire',
  wind:       'Wind',
  earthquake: 'Earthquake',
  crime:      'Crime',
}

interface InsurabilityPanelProps {
  status: InsurabilityStatus
}

export function InsurabilityPanel({ status }: InsurabilityPanelProps) {
  const config = DIFFICULTY_CONFIG[status.difficultyLevel]
  const Icon = config.icon

  return (
    <div className={`card overflow-hidden border ${config.border}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 ${config.bg}`}>
        <Icon className={`h-6 w-6 shrink-0 ${config.iconColor}`} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Insurability Assessment</p>
          <p className={`text-lg font-bold ${config.color}`}>{config.label}</p>
          <p className="text-[11px] text-gray-500">Sourced from 12+ public data sources &middot; auditable, not a black box.</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Score</p>
            <p className={`text-2xl font-bold ${config.color}`}>{status.overallInsurabilityScore}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${config.bg} ${config.color} border ${config.border}`}>
            {status.isInsurable ? 'Insurable' : 'Non-Insurable'}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Per-category scores */}
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Insurability by Peril</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map((cat) => {
              const catScore = status.categoryScores[cat]
              const CatIcon = CATEGORY_ICONS[cat]
              const barColor = SCORE_BAR_COLOR[catScore.level]
              return (
                <div key={cat} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-center">
                  <CatIcon className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                  <p className="text-base font-bold text-gray-900">{catScore.score}</p>
                  <p className="text-[10px] font-medium text-gray-600">{CATEGORY_LABELS[cat]}</p>
                  <p className="text-[10px] text-gray-400">{riskLevelToLabel(catScore.level)}</p>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-1 rounded-full ${barColor}`}
                      style={{ width: `${catScore.score}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">{catScore.activeCarrierCount} carrier{catScore.activeCarrierCount !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Potential issues */}
        {status.potentialIssues.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Potential Issues
            </h4>
            <ul className="space-y-1.5">
              {status.potentialIssues.map((issue) => (
                <li key={issue} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended actions */}
        {status.recommendedActions.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <Info className="h-4 w-4 text-blue-500" />
              Recommended Actions
            </h4>
            <ul className="space-y-1.5">
              {status.recommendedActions.map((action) => (
                <li key={action} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
