import type { InsurabilityStatus } from '@coverguard/shared'
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

// ── Config ────────────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  LOW:       { label: 'Easily Insurable',          color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: CheckCircle,   iconColor: 'text-green-600',  segColor: 'bg-green-500'  },
  MODERATE:  { label: 'Insurable with Conditions', color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-600', segColor: 'bg-yellow-500' },
  HIGH:      { label: 'Difficult to Insure',       color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: AlertTriangle, iconColor: 'text-orange-600', segColor: 'bg-orange-500' },
  VERY_HIGH: { label: 'Very Hard to Insure',       color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: XCircle,       iconColor: 'text-red-600',    segColor: 'bg-red-500'    },
  EXTREME:   { label: 'Potentially Uninsurable',   color: 'text-red-900',    bg: 'bg-red-100',    border: 'border-red-300',    icon: XCircle,       iconColor: 'text-red-900',    segColor: 'bg-red-900'    },
} as const

const DIFFICULTY_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH', 'EXTREME'] as const

const SEGMENT_COLORS = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-red-900']

type DifficultyLevel = keyof typeof DIFFICULTY_CONFIG

interface InsurabilityPanelProps {
  status: InsurabilityStatus
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InsurabilityPanel({ status }: InsurabilityPanelProps) {
  const level  = status.difficultyLevel as DifficultyLevel
  const config = DIFFICULTY_CONFIG[level] ?? DIFFICULTY_CONFIG.MODERATE
  const Icon   = config.icon
  const levelIndex = DIFFICULTY_LEVELS.indexOf(level)

  return (
    <div className={`card overflow-hidden border ${config.border}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 ${config.bg}`}>
        <Icon className={`h-6 w-6 shrink-0 ${config.iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Insurability Assessment</p>
          <p className={`text-lg font-bold ${config.color}`}>{config.label}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${config.bg} ${config.color} ${config.border}`}
        >
          {status.isInsurable ? 'Insurable' : 'Non-Insurable'}
        </span>
      </div>

      {/* Visual difficulty meter */}
      <div className={`px-5 py-3 ${config.bg} border-t ${config.border}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Difficulty Level
          </span>
          <span className={`text-[10px] font-semibold ${config.color}`}>
            {level.replace('_', ' ')}
          </span>
        </div>

        {/* 5-segment progress bar */}
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {DIFFICULTY_LEVELS.map((l, i) => (
            <div
              key={l}
              className={`flex-1 transition-colors ${i <= levelIndex ? SEGMENT_COLORS[i] : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Tier labels */}
        <div className="mt-1 flex justify-between text-[9px] text-gray-400">
          <span>LOW</span>
          <span>MODERATE</span>
          <span>HIGH</span>
          <span>VERY HIGH</span>
          <span>EXTREME</span>
        </div>
      </div>

      {/* Issues + actions */}
      <div className="space-y-4 p-5">
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
