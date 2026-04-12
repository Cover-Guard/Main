'use client'

import type { PropertyRiskProfile, StateRiskContext as IStateRiskContext } from '@coverguard/shared'
import {
  Building2,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

interface StateRiskContextProps {
  profile: PropertyRiskProfile
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARRIER_TREND_META = {
  STABLE: { label: 'Stable', icon: Minus, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  DECLINING: { label: 'Declining', icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  EXITING: { label: 'Carriers Exiting', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
} as const

const RESIDUAL_META = {
  NONE: { label: 'None', color: 'text-green-700', dot: 'bg-green-500' },
  LOW: { label: 'Low', color: 'text-green-700', dot: 'bg-green-400' },
  MODERATE: { label: 'Moderate', color: 'text-amber-700', dot: 'bg-amber-500' },
  HIGH: { label: 'High', color: 'text-red-700', dot: 'bg-red-500' },
} as const

const CODE_LEVEL_META = {
  CURRENT: { label: 'Current (IBC/IRC)', color: 'text-green-700', icon: ShieldCheck },
  PARTIAL: { label: 'Partial adoption', color: 'text-amber-700', icon: ShieldAlert },
  OUTDATED: { label: 'Outdated', color: 'text-orange-700', icon: ShieldAlert },
  NONE: { label: 'None / minimal', color: 'text-red-700', icon: AlertTriangle },
} as const

const RATE_REGULATION_LABELS: Record<string, string> = {
  PRIOR_APPROVAL: 'Prior Approval — insurers need regulatory sign-off before raising rates',
  FILE_AND_USE: 'File & Use — rates take effect on filing; subject to later review',
  USE_AND_FILE: 'Use & File — rates used immediately; filed within set period',
  NO_FILE: 'No File — minimal regulatory oversight of rate changes',
}

function modifierBadge(modifier: number) {
  if (modifier === 0) return null
  const positive = modifier > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
        positive ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : ''}{modifier} pts
    </span>
  )
}

function PerilModifierRow({
  label,
  modifier,
  color,
}: {
  label: string
  modifier: number
  color: string
}) {
  if (modifier === 0) return null
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${color}`}>{label}</span>
      {modifierBadge(modifier)}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function StateRiskContext({ profile }: StateRiskContextProps) {
  const ctx: IStateRiskContext | undefined = profile.stateContext
  const [expanded, setExpanded] = useState(false)

  if (!ctx) return null

  const trendMeta = CARRIER_TREND_META[ctx.carrierCountTrend]
  const TrendIcon = trendMeta.icon
  const residualMeta = RESIDUAL_META[ctx.residualMarketUsage]
  const codeMeta = CODE_LEVEL_META[ctx.compliance.buildingCodeLevel]
  const CodeIcon = codeMeta.icon

  const hasModifiers = Object.values(ctx.scoreModifiers).some((v, i) => i < 4 && v !== 0)
  const hasResidualPrograms = ctx.compliance.residualMarketPrograms.length > 0
  const hasMandatory =
    ctx.compliance.mandatoryFloodZones ||
    ctx.compliance.mandatoryWindstorm ||
    ctx.compliance.earthquakeDisclosureRequired ||
    ctx.compliance.naturalHazardDisclosure ||
    ctx.compliance.sinkholeDisclosure

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-900">
            State Risk Context — {ctx.stateName}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${trendMeta.bg} ${trendMeta.color}`}
          >
            <TrendIcon className="h-3 w-3" />
            {trendMeta.label}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">

          {/* Known state risks */}
          {ctx.knownRisks.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Known State Risks
              </p>
              <ul className="space-y-1.5">
                {ctx.knownRisks.map((risk, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Score modifiers */}
          {hasModifiers && (
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                How State Profile Adjusted Scores
              </p>
              <div className="divide-y divide-gray-50">
                <PerilModifierRow label="Flood" modifier={ctx.scoreModifiers.flood} color="text-blue-700" />
                <PerilModifierRow label="Fire" modifier={ctx.scoreModifiers.fire} color="text-orange-700" />
                <PerilModifierRow label="Wind" modifier={ctx.scoreModifiers.wind} color="text-teal-700" />
                <PerilModifierRow label="Earthquake" modifier={ctx.scoreModifiers.earthquake} color="text-amber-700" />
              </div>
              {profile.complianceScore != null && (
                <div className="mt-2 flex items-center justify-between py-1 border-t border-gray-100">
                  <span className="text-sm text-gray-600 font-medium">Regulatory/Compliance Score</span>
                  <span className="text-sm font-semibold text-gray-900">{profile.complianceScore}/100</span>
                </div>
              )}
            </div>
          )}

          {/* Regulatory & compliance */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Regulatory &amp; Compliance
            </p>
            <div className="space-y-3">

              {/* Building code */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <CodeIcon className={`h-4 w-4 shrink-0 ${codeMeta.color}`} />
                  <span className="text-sm text-gray-700">Building Code</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${codeMeta.color}`}>{codeMeta.label}</span>
                  <span className="text-xs text-gray-400 ml-1.5">
                    enforcement {ctx.compliance.buildingCodeEnforcement}/5
                  </span>
                </div>
              </div>

              {/* Rate regulation */}
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">Rate regulation: </span>
                {RATE_REGULATION_LABELS[ctx.compliance.rateRegulation] ?? ctx.compliance.rateRegulation}
              </div>

              {/* Residual market */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Residual market reliance</span>
                <span className={`flex items-center gap-1.5 text-sm font-medium ${residualMeta.color}`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${residualMeta.dot}`} />
                  {residualMeta.label}
                </span>
              </div>

              {/* Residual programs */}
              {hasResidualPrograms && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Available residual market programs:</p>
                  <ul className="space-y-1">
                    {ctx.compliance.residualMarketPrograms.map((p, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{p.name}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            RESIDUAL_META[p.usageLevel].color
                          } bg-gray-50`}
                        >
                          {RESIDUAL_META[p.usageLevel].label} usage
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Mandatory coverages & disclosures */}
              {hasMandatory && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Mandatory / disclosure requirements:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ctx.compliance.mandatoryFloodZones && (
                      <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                        Flood insurance (SFHA)
                      </span>
                    )}
                    {ctx.compliance.mandatoryWindstorm && (
                      <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">
                        Windstorm coverage
                      </span>
                    )}
                    {ctx.compliance.earthquakeDisclosureRequired && (
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        Earthquake disclosure
                      </span>
                    )}
                    {ctx.compliance.naturalHazardDisclosure && (
                      <span className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full">
                        Natural hazard disclosure
                      </span>
                    )}
                    {ctx.compliance.sinkholeDisclosure && (
                      <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                        Sinkhole disclosure
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
