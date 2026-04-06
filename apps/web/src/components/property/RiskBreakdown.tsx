import type { PropertyRiskProfile, RiskFactor, RiskLevel } from '@coverguard/shared'
import { riskLevelToLabel } from '@coverguard/shared'
import { cn, riskLevelClasses } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface RiskBreakdownProps {
  profile: PropertyRiskProfile
}

export function RiskBreakdown({ profile }: RiskBreakdownProps) {
  const sections = [
    {
      title: 'Flood Risk',
      factor: profile.flood,
      extras: [
        { label: 'Flood Zone', value: profile.flood.floodZone },
        { label: 'In SFHA', value: profile.flood.inSpecialFloodHazardArea ? 'Yes — flood insurance required' : 'No' },
        { label: 'Annual Flood Chance', value: profile.flood.annualChanceOfFlooding != null ? `${profile.flood.annualChanceOfFlooding}%` : null },
        { label: 'Base Flood Elevation', value: profile.flood.baseFloodElevation != null ? `${profile.flood.baseFloodElevation} ft` : null },
      ],
    },
    {
      title: 'Fire Risk',
      factor: profile.fire,
      extras: [
        { label: 'Hazard Zone', value: profile.fire.fireHazardSeverityZone },
        { label: 'Wildland-Urban Interface', value: profile.fire.wildlandUrbanInterface ? 'Yes' : 'No' },
        { label: 'Nearest Fire Station', value: profile.fire.nearestFireStation != null ? `${profile.fire.nearestFireStation} mi` : null },
        { label: 'Vegetation Density', value: profile.fire.vegetationDensity },
      ],
    },
    {
      title: 'Wind Risk',
      factor: profile.wind,
      extras: [
        { label: 'Design Wind Speed', value: profile.wind.designWindSpeed != null ? `${profile.wind.designWindSpeed} mph` : null },
        { label: 'Hurricane Risk', value: profile.wind.hurricaneRisk ? 'Yes' : 'No' },
        { label: 'Tornado Risk', value: profile.wind.tornadoRisk ? 'Yes' : 'No' },
        { label: 'Hail Risk', value: profile.wind.hailRisk ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'Earthquake Risk',
      factor: profile.earthquake,
      extras: [
        { label: 'Seismic Zone', value: profile.earthquake.seismicZone },
        { label: 'Nearest Fault', value: profile.earthquake.nearestFaultLine != null ? `${profile.earthquake.nearestFaultLine} mi` : null },
        { label: 'Soil Type', value: profile.earthquake.soilType },
        { label: 'Liquefaction Risk', value: profile.earthquake.liquefactionPotential },
      ],
    },
    {
      title: 'Crime Risk',
      factor: profile.crime,
      extras: [
        { label: 'Violent Crime Index', value: String(profile.crime.violentCrimeIndex) },
        { label: 'Property Crime Index', value: String(profile.crime.propertyCrimeIndex) },
        { label: 'vs. National Avg', value: profile.crime.nationalAverageDiff > 0 ? `+${profile.crime.nationalAverageDiff.toFixed(1)}%` : `${profile.crime.nationalAverageDiff.toFixed(1)}%` },
      ],
    },
  ]

  return (
    <div className="card divide-y divide-gray-100">
      <h2 className="px-6 py-4 text-lg font-semibold text-gray-900">Detailed Risk Breakdown</h2>
      {sections.map((s) => (
        <RiskSection key={s.title} title={s.title} factor={s.factor} extras={s.extras} />
      ))}
    </div>
  )
}

function RiskSection({
  title,
  factor,
  extras,
}: {
  title: string
  factor: RiskFactor
  extras: Array<{ label: string; value: string | null | undefined }>
}) {
  return (
    <details className="group px-6 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold', riskLevelClasses(factor.level as RiskLevel))}>
            {riskLevelToLabel(factor.level as RiskLevel)}
          </span>
          <span className="font-medium text-gray-900">{title}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>Score: {factor.score}/100</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="mt-4 space-y-3">
        <p className="text-sm text-gray-600">{factor.description}</p>

        {factor.details.length > 0 && (
          <ul className="space-y-1">
            {factor.details.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                {d}
              </li>
            ))}
          </ul>
        )}

        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
          {extras
            .filter((e) => e.value != null)
            .map((e) => (
              <div key={e.label}>
                <dt className="text-xs text-gray-400">{e.label}</dt>
                <dd className="text-sm font-medium text-gray-800">{e.value}</dd>
              </div>
            ))}
        </dl>

        <p className="text-xs text-gray-400">Source: {factor.dataSource}</p>
      </div>
    </details>
  )
}
