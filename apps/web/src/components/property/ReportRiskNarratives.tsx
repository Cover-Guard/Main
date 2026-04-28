'use client'

import type { PropertyRiskProfile } from '@coverguard/shared'
import { buildReportNarratives } from '@coverguard/shared'

import { RiskNarrativeSection } from './RiskNarrativeSection'

/**
 * Per-peril plain-language narrative strip on the property report
 * (P1 #9 follow-up D - the wiring).
 *
 * Stateless. Produces one {@link RiskNarrativeSection} per peril off
 * the {@link PropertyRiskProfile} we already have on the page. Today
 * sources are TEMPLATE - safe by default. When the API endpoint that
 * calls the LLM lands in a follow-up infra PR, the page will pass an
 * LLM-sourced array through `narratives` and this component will
 * render `LLM` / `REVIEWED` badges as appropriate.
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #9 - Plain-Language
 * Risk Narrative") - "Every peril section in the report shows a
 * narrative or template."
 */
export interface ReportRiskNarrativesProps {
  profile: PropertyRiskProfile
}

export function ReportRiskNarratives({ profile }: ReportRiskNarrativesProps) {
  const narratives = buildReportNarratives(profile)
  if (narratives.length === 0) return null

  return (
    <section
      aria-label="Plain-language risk narratives"
      className="space-y-3"
    >
      <header className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
          What this means
        </h3>
      </header>
      {narratives.map((n) => (
        <RiskNarrativeSection key={n.id} narrative={n} />
      ))}
    </section>
  )
}
