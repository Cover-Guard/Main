import type { PropertyRiskProfile, RiskLevel } from '@coverguard/shared'
import { riskLevelToLabel } from '@coverguard/shared'
import { cn, riskLevelClasses } from '@/lib/utils'
import { Droplets, Flame, Wind, Mountain, ShieldAlert } from 'lucide-react'

interface RiskSummaryProps {
  profile: PropertyRiskProfile
}

export function RiskSummary({ profile }: RiskSummaryProps) {
  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Risk Summary</h2>
        <RiskBadge level={profile.overallRiskLevel} score={profile.overallRiskScore} />
      </div>

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

function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold', riskLevelClasses(level))}>
      <span className="text-base font-bold">{score}</span>
      <span>{riskLevelToLabel(level)} Risk</span>
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
