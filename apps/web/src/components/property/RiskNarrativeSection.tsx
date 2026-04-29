'use client'

import type { RiskNarrative } from '@coverguard/shared'
import { confidenceLabel } from '@coverguard/shared'
import { Bot, FileText, ShieldCheck, Sparkles } from 'lucide-react'

/**
 * Plain-language narrative for one peril on the property report (P1 #9).
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #9 - Plain-Language
 * Risk Narrative").
 *
 * Stateless. The parent decides which {@link RiskNarrative} to show
 * (LLM / TEMPLATE / REVIEWED via `selectNarrativeSource`); this component
 * renders the body, a peril heading, and a small badge that tells the
 * reader where the copy came from.
 *
 * Source badge meaning:
 *  - REVIEWED  : an analyst signed off (highest trust)
 *  - LLM       : model-generated, eval-passed at deploy
 *  - TEMPLATE  : deterministic fallback (always safe to render)
 */
export interface RiskNarrativeSectionProps {
  narrative: RiskNarrative
  /** Show the source badge inline with the heading. Default true. */
  showSourceBadge?: boolean
}

const PERIL_HEADING: Record<RiskNarrative['peril'], string> = {
  flood:      'Flood',
  fire:       'Wildfire',
  wind:       'Wind & hail',
  earthquake: 'Earthquake',
  crime:      'Crime',
  heat:       'Extreme heat',
}

export function RiskNarrativeSection({
  narrative,
  showSourceBadge = true,
}: RiskNarrativeSectionProps) {
  const heading = PERIL_HEADING[narrative.peril]

  return (
    <section
      aria-labelledby={`narrative-${narrative.peril}-heading`}
      className="rounded-xl border border-gray-200 bg-white p-4"
    >
      <header className="mb-2 flex items-center justify-between gap-3">
        <h3
          id={`narrative-${narrative.peril}-heading`}
          className="text-sm font-semibold text-gray-900"
        >
          {heading}{' '}
          <span className="text-gray-500">· {Math.round(narrative.score)} / 100</span>
        </h3>
        {showSourceBadge && <SourceBadge narrative={narrative} />}
      </header>
      <p className="text-sm leading-relaxed text-gray-700">{narrative.body}</p>
    </section>
  )
}

function SourceBadge({ narrative }: { narrative: RiskNarrative }) {
  if (narrative.source === 'REVIEWED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200">
        <ShieldCheck className="h-3 w-3" aria-hidden />
        Reviewed
      </span>
    )
  }

  if (narrative.source === 'TEMPLATE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700 ring-1 ring-gray-200">
        <FileText className="h-3 w-3" aria-hidden />
        Standard
      </span>
    )
  }

  // LLM
  const conf = confidenceLabel(narrative.confidence)
  const variant =
    conf === 'high'
      ? 'bg-sky-50 text-sky-800 ring-sky-200'
      : conf === 'medium'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-orange-50 text-orange-800 ring-orange-200'
  const Icon = conf === 'high' ? Sparkles : Bot
  const label =
    conf === 'high'
      ? 'AI'
      : conf === 'medium'
        ? 'AI · medium confidence'
        : 'AI · low confidence'
  return (
    <span
      title={`Model confidence: ${(narrative.confidence * 100).toFixed(0)}%`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${variant}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
