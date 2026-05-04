import type { PropertyRiskProfile, RiskLevel } from '@coverguard/shared'
import { riskLevelToLabel } from '@coverguard/shared'
import { cn, riskLevelClasses } from '@/lib/utils'
import { Droplets, Flame, Wind, Mountain, ShieldAlert } from 'lucide-react'

interface RiskSummaryProps {
  profile: PropertyRiskProfile
}

// Convert a 0-100 risk score to a 1-10 scale aligned with consumer-facing
// climate-risk scoring conventions (e.g. First Street Risk Factor).
function toTenPointScore(score: number): number {
  if (!Number.isFinite(score)) return 1
  const clamped = Math.max(0, Math.min(100, score))
  return Math.max(1, Math.min(10, Math.round(clamped / 10)))
}

export function RiskSummary({ profile }: RiskSummaryProps) {
  const tenPoint = toTenPointScore(profile.overallRiskScore)
  return (
    <div className="card p-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Risk Summary</h2>
        <RiskBadge level={profile.overallRiskLevel} score={profile.overallRiskScore} tenPoint={tenPoint} />
      </div>
      <p className="mb-6 text-xs text-gray-500">
        Aggregated from 12+ public sources — FEMA, USGS, NOAA, Cal Fire, USFS, FBI, ASCE 7, and the Esri Living Atlas.
        Sourced and auditable.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <RiskTile
          label="Flood"
          level={profile.flood.level}
          score={profile.flood.score}
          icon={<Droplets className="h-5 w-5" />}
        />
        <RiskTile
          label="Fire"
          level={profile.fire.level}
          score={profile.fire.score}
          icon={<Flame className="h-5 w-5" />}
        />
        <RiskTile
          label="Wind"
          level={profile.wind.level}
          score={profile.wind.score}
          icon={<Wind className="h-5 w-5" />}
        />
        <RiskTile
          label="Earthquake"
          level={profile.earthquake.level}
          score={profile.earthquake.score}
          icon={<Mountain className="h-5 w-5" />}
        />
        <RiskTile
          label="Crime"
          level={profile.crime.level}
          score={profile.crime.score}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
      </div>
    </div>
  )
}

function RiskBadge({ level, score, tenPoint }: { level: RiskLevel; score: number; tenPoint: number }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold',
        riskLevelClasses(level),
      )}
      title="Composite score: full 0-100 detail (left) and a 1-10 consumer-friendly score (right)."
    >
      <span className="text-base font-bold">{score}</span>
      <span className="opacity-70">/ 100</span>
      <span aria-hidden="true" className="opacity-30">·</span>
      <span className="text-base font-bold">{tenPoint}</span>
      <span className="opacity-70">/ 10</span>
      <span className="ml-1">{riskLevelToLabel(level)} Risk</span>
    </div>
  )
}

function RiskTile({
  label,
  level,
  score,
  icon,
}: {
  label: string
  level: RiskLevel
  score: number
  icon: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg border p-3 text-center', riskLevelClasses(level))}>
      <div className="mb-1 flex justify-center">{icon}</div>
      <p className="text-xl font-bold">{score}</p>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs opacity-75">{riskLevelToLabel(level)}</p>
    </div>
  )
}
