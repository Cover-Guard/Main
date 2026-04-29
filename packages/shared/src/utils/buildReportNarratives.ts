/**
 * Build the per-peril narrative array for one property report (P1 #9
 * follow-up D).
 *
 * Wires {@link PropertyRiskProfile} on a fetched report into the
 * {@link RiskNarrative}[] shape `<RiskNarrativeSection>` consumes.
 *
 * Today this function uses the deterministic TEMPLATE fallback - that
 * is the safe default when the LLM provider isn't yet wired up, and it
 * still gives the report a real plain-language paragraph per peril (the
 * spec acceptance criterion). When the API endpoint that calls the LLM
 * lands in a follow-up infra PR, the page-level data layer will
 * instead pass the LLM-sourced array through to the section directly.
 */

import type { PropertyRiskProfile } from '../types/risk'
import type { PerilType, RiskNarrative } from '../types/perilNarrative'
import { generateTemplateNarrative } from './perilNarrative'

const ALWAYS_PRESENT_PERILS: readonly Exclude<PerilType, 'heat'>[] = [
  'flood',
  'fire',
  'wind',
  'earthquake',
  'crime',
]

/**
 * Read the score for one peril off a {@link PropertyRiskProfile}.
 * Returns `null` if the field isn't populated (e.g. heat is optional).
 */
export function perilScoreFromProfile(
  profile: PropertyRiskProfile,
  peril: PerilType,
): number | null {
  switch (peril) {
    case 'flood':      return profile.flood.score
    case 'fire':       return profile.fire.score
    case 'wind':       return profile.wind.score
    case 'earthquake': return profile.earthquake.score
    case 'crime':      return profile.crime.score
    case 'heat':       return profile.heat?.score ?? null
  }
}

/**
 * Build the array of narratives the report renders, using TEMPLATE
 * fallback as the source. Caller supplies a clock via `now` (defaults
 * to `new Date()`) so the timestamps are testable.
 *
 * Stable order: flood -> fire -> wind -> earthquake -> crime -> heat
 * (heat is appended only if the profile has a heat score).
 */
export function buildReportNarratives(
  profile: PropertyRiskProfile,
  now: Date = new Date(),
): RiskNarrative[] {
  const generatedAt = now.toISOString()
  const out: RiskNarrative[] = []

  for (const peril of ALWAYS_PRESENT_PERILS) {
    const score = perilScoreFromProfile(profile, peril)
    if (score == null) continue
    out.push({
      id: `${profile.propertyId}::${peril}`,
      propertyId: profile.propertyId,
      peril,
      score,
      source: 'TEMPLATE',
      confidence: 1,
      body: generateTemplateNarrative(peril, score),
      generatedAt,
    })
  }

  const heatScore = perilScoreFromProfile(profile, 'heat')
  if (heatScore != null) {
    out.push({
      id: `${profile.propertyId}::heat`,
      propertyId: profile.propertyId,
      peril: 'heat',
      score: heatScore,
      source: 'TEMPLATE',
      confidence: 1,
      body: generateTemplateNarrative('heat', heatScore),
      generatedAt,
    })
  }

  return out
}
