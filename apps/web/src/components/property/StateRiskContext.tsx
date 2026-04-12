'use client'

import type {
  StateRiskContext,
  StateMarketCondition,
  BuildingCodeStrength,
  RateRegulationType,
  ResidualMarketProgram,
} from '@coverguard/shared'
import { cn } from '@/lib/utils'
import { ChevronDown, MapPin, AlertTriangle, Building2, ShieldCheck, BookOpen } from 'lucide-react'

interface StateRiskContextPanelProps {
  context: StateRiskContext
}

// ─── Styling helpers ──────────────────────────────────────────────────────────

const marketConditionStyles: Record<StateMarketCondition, { label: string; classes: string }> = {
  STABLE:   { label: 'Stable',  classes: 'bg-green-50  border-green-200  text-green-800'  },
  STRESSED: { label: 'Stressed', classes: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  HARD:     { label: 'Hard',    classes: 'bg-orange-50 border-orange-200 text-orange-800' },
  CRISIS:   { label: 'Crisis',  classes: 'bg-red-50    border-red-200    text-red-800'    },
}

const buildingCodeStyles: Record<BuildingCodeStrength, { label: string; classes: string }> = {
  STRONG:   { label: 'Strong',   classes: 'bg-green-50  border-green-200  text-green-800'  },
  MODERATE: { label: 'Moderate', classes: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  WEAK:     { label: 'Weak',     classes: 'bg-orange-50 border-orange-200 text-orange-800' },
  NONE:     { label: 'None',     classes: 'bg-red-50    border-red-200    text-red-800'    },
}

const rateRegLabels: Record<RateRegulationType, string> = {
  PRIOR_APPROVAL: 'Prior Approval',
  FILE_AND_USE:   'File & Use',
  USE_AND_FILE:   'Use & File',
  NO_FILE:        'No File',
}

const residualMarketTypeLabels: Record<ResidualMarketProgram['type'], string> = {
  FAIR_PLAN:     'FAIR Plan',
  WIND_POOL:     'Wind Pool',
  STATE_INSURER: 'State Insurer',
  BEACH_PLAN:    'Beach Plan',
}

const perilLabels: Record<string, string> = {
  flood: 'Flood', fire: 'Fire', wind: 'Wind / Hurricane', earthquake: 'Earthquake',
}

const perilColors: Record<string, string> = {
  flood:     'bg-blue-50   border-blue-200   text-blue-800',
  fire:      'bg-orange-50 border-orange-200 text-orange-800',
  wind:      'bg-teal-50   border-teal-200   text-teal-800',
  earthquake:'bg-amber-50  border-amber-200  text-amber-800',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, classes }: { label: string; classes: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', classes)}>
      {label}
    </span>
  )
}

function ExposureTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
      {label}
    </span>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
          {item}
        </li>
      ))}
    </ul>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StateRiskContextPanel({ context }: StateRiskContextPanelProps) {
  const marketStyle = marketConditionStyles[context.market.condition]

  // Collect peril modifiers that exist
  const perilModifiers = (['flood', 'fire', 'wind', 'earthquake'] as const).flatMap((peril) => {
    const mod = context[peril]
    return mod ? [{ peril, mod }] : []
  })

  return (
    <div className="card divide-y divide-gray-100">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <MapPin className="h-4 w-4 text-gray-500" />
          {context.stateName} Risk Profile
        </h2>
        <Badge label={`Market: ${marketStyle.label}`} classes={marketStyle.classes} />
      </div>

      {/* ── Known catastrophic exposures ── */}
      {context.knownCatastrophicExposures.length > 0 && (
        <div className="px-6 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Known Catastrophic Exposures
          </p>
          <div className="flex flex-wrap gap-2">
            {context.knownCatastrophicExposures.map((exp) => (
              <ExposureTag key={exp} label={exp} />
            ))}
          </div>
        </div>
      )}

      {/* ── Peril modifiers ── */}
      {perilModifiers.length > 0 && (
        <details className="group px-6 py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-gray-900">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              State Peril Adjustments
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-500">
              {context.stateName}&apos;s historical loss performance and known risk factors have
              adjusted the following peril scores beyond national baseline data.
            </p>
            {perilModifiers.map(({ peril, mod }) => (
              <div
                key={peril}
                className={cn('rounded-lg border p-3', perilColors[peril])}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{perilLabels[peril]}</span>
                  <div className="flex gap-1.5">
                    {mod.floor != null && (
                      <span className="rounded border px-1.5 py-0.5 text-xs font-medium">
                        Floor: {mod.floor}
                      </span>
                    )}
                    {mod.multiplier != null && mod.multiplier !== 1.0 && (
                      <span className="rounded border px-1.5 py-0.5 text-xs font-medium">
                        ×{mod.multiplier.toFixed(2)}
                      </span>
                    )}
                    {mod.applied && (
                      <span className="rounded border border-current bg-white/50 px-1.5 py-0.5 text-xs font-semibold">
                        Applied
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs">{mod.reason}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Insurance market ── */}
      <details className="group px-6 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <ShieldCheck className="h-4 w-4 text-gray-500" />
            Insurance Market Conditions
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge label={marketStyle.label} classes={marketStyle.classes} />
            {context.market.carriersExiting && (
              <Badge label="Carriers Exiting" classes="bg-red-50 border-red-200 text-red-800" />
            )}
            {context.market.residualMarketGrowth && (
              <Badge label="Residual Market Growing" classes="bg-orange-50 border-orange-200 text-orange-800" />
            )}
          </div>
          {context.market.notes.length > 0 && <BulletList items={context.market.notes} />}
        </div>
      </details>

      {/* ── Regulatory & Compliance ── */}
      <details className="group px-6 py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="flex items-center gap-2 font-medium text-gray-900">
            <BookOpen className="h-4 w-4 text-gray-500" />
            Regulatory &amp; Compliance
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-4 space-y-5">
          {/* Rate regulation + building code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Rate Regulation
              </p>
              <p className="text-sm font-medium text-gray-900">
                {rateRegLabels[context.regulatory.rateRegulation]}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{context.regulatory.rateRegulationNotes}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Building Code
              </p>
              <Badge
                label={buildingCodeStyles[context.regulatory.buildingCodeStrength].label}
                classes={buildingCodeStyles[context.regulatory.buildingCodeStrength].classes}
              />
              <p className="mt-1 text-xs text-gray-500">{context.regulatory.buildingCodeNotes}</p>
            </div>
          </div>

          {/* Residual market programs */}
          {context.regulatory.residualMarketPrograms.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Residual Market Programs
              </p>
              <div className="space-y-2">
                {context.regulatory.residualMarketPrograms.map((prog) => (
                  <div key={prog.name} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{prog.name}</span>
                      <span className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-600">
                        {residualMarketTypeLabels[prog.type]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">{prog.notes}</p>
                    <div className="flex flex-wrap gap-1">
                      {prog.coverageTypes.map((ct) => (
                        <span key={ct} className="rounded bg-white border border-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                          {ct}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required disclosures */}
          {context.regulatory.requiredDisclosures.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Required Disclosures
              </p>
              <BulletList items={context.regulatory.requiredDisclosures} />
            </div>
          )}

          {/* Mandated coverages */}
          {context.regulatory.mandatedCoverages.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Mandated Coverages / Requirements
              </p>
              <BulletList items={context.regulatory.mandatedCoverages} />
            </div>
          )}

          {/* Compliance notes */}
          {context.regulatory.complianceNotes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                Compliance Notes
              </p>
              <BulletList items={context.regulatory.complianceNotes} />
            </div>
          )}
        </div>
      </details>

      {/* ── State notes ── */}
      {context.notes.length > 0 && (
        <div className="px-6 py-4">
          <BulletList items={context.notes} />
        </div>
      )}
    </div>
  )
}
