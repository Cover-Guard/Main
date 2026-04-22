import type { BindPath, CarriersResult, InsurabilityStatus } from '../types/insurance'
import type { RiskLevel } from '../types/risk'

type PerilKey = 'flood' | 'fire' | 'wind' | 'earthquake' | 'crime'

const PERIL_LABELS: Record<PerilKey, string> = {
  flood: 'Flood',
  fire: 'Fire',
  wind: 'Wind',
  earthquake: 'Earthquake',
  crime: 'Crime',
}

/** Risk levels that count as "high" for the bind-path rule. */
const HIGH_LEVELS: ReadonlySet<RiskLevel> = new Set<RiskLevel>(['HIGH', 'VERY_HIGH', 'EXTREME'])

/**
 * Compute a bind-path indicator from live carrier availability and multi-peril
 * insurability.
 *
 * Classification (v1):
 * - GREEN:  ≥ 5 actively-writing carriers AND no peril is high/very-high/extreme
 * - RED:    ≤ 1 actively-writing carrier OR ≥ 2 perils are high/very-high/extreme
 * - YELLOW: everything in between
 *
 * The rule intentionally biases toward Yellow so that a report never feels
 * over-promised — an agent can always explain up.
 *
 * Spec: docs/gtm/value-add-activities/04-bind-path-indicator.md §5
 */
export function computeBindPath(
  carriers: CarriersResult,
  insurability: InsurabilityStatus,
): BindPath {
  const openCarrierCount = carriers.carriers.filter(
    (c) => c.writingStatus === 'ACTIVELY_WRITING',
  ).length

  const highRiskPerils: string[] = (Object.keys(PERIL_LABELS) as PerilKey[])
    .filter((peril) => HIGH_LEVELS.has(insurability.categoryScores[peril].level))
    .map((peril) => PERIL_LABELS[peril])

  const highRiskCount = highRiskPerils.length

  const level: BindPath['level'] =
    openCarrierCount <= 1 || highRiskCount >= 2
      ? 'RED'
      : openCarrierCount >= 5 && highRiskCount === 0
        ? 'GREEN'
        : 'YELLOW'

  const reason = buildReason(level, openCarrierCount, highRiskPerils)

  return {
    level,
    openCarrierCount,
    highRiskPerils,
    reason,
  }
}

function buildReason(
  level: BindPath['level'],
  openCarrierCount: number,
  highRiskPerils: string[],
): string {
  const carriersClause =
    openCarrierCount === 0
      ? 'no carriers currently open'
      : `${openCarrierCount} carrier${openCarrierCount === 1 ? '' : 's'} open`

  if (highRiskPerils.length === 0) {
    if (level === 'GREEN') {
      return `${carriersClause}, no elevated perils — straightforward bind expected.`
    }
    return `${carriersClause} — expect limited options.`
  }

  const perilsClause =
    highRiskPerils.length === 1
      ? `${highRiskPerils[0]} is elevated`
      : `${highRiskPerils.slice(0, -1).join(', ')} and ${highRiskPerils[highRiskPerils.length - 1]} are elevated`

  if (level === 'RED') {
    return `${carriersClause}, ${perilsClause} — plan on E&S or specialty markets.`
  }
  return `${carriersClause}, ${perilsClause} — expect 1–2 re-quotes.`
}
