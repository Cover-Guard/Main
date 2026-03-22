'use client'

import { useEffect, useState } from 'react'
import type { PropertyRiskProfile, RiskLevel } from '@coverguard/shared'
import { riskLevelToLabel } from '@coverguard/shared'
import { Droplets, Flame, Wind, Mountain, ShieldAlert } from 'lucide-react'

// ── Color palette per risk level ─────────────────────────────────────────────

const PALETTE: Record<
  string,
  { stroke: string; track: string; text: string; bg: string; border: string }
> = {
  LOW:       { stroke: '#22c55e', track: '#dcfce7', text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200'  },
  MODERATE:  { stroke: '#eab308', track: '#fef9c3', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  HIGH:      { stroke: '#f97316', track: '#ffedd5', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  VERY_HIGH: { stroke: '#ef4444', track: '#fee2e2', text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
  EXTREME:   { stroke: '#7f1d1d', track: '#fecaca', text: 'text-red-900',    bg: 'bg-red-100',   border: 'border-red-300'    },
}

// ── Animated SVG ring gauge ───────────────────────────────────────────────────

function RingGauge({ score, level, size = 74 }: { score: number; level: string; size?: number }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 180)
    return () => clearTimeout(t)
  }, [])

  const p   = PALETTE[level] ?? PALETTE.MODERATE
  const sw  = 7
  const r   = (size - sw * 2) / 2
  const cir = 2 * Math.PI * r
  const off = drawn ? cir * (1 - score / 100) : cir
  const cx  = size / 2
  const cy  = size / 2

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={p.track} strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={p.stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={cir}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold leading-none ${p.text}`}>{score}</span>
      </div>
    </div>
  )
}

// ── Individual risk tile ──────────────────────────────────────────────────────

function RiskTile({
  label,
  level,
  score,
  icon,
  animDelay = 0,
}: {
  label: string
  level: string
  score: number
  icon: React.ReactNode
  animDelay?: number
}) {
  const p = PALETTE[level] ?? PALETTE.MODERATE
  return (
    <div
      className={`animate-fade-in flex flex-col items-center gap-2.5 rounded-xl border p-3 transition-shadow hover:shadow-md ${p.bg} ${p.border}`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 ${p.text}`}>
        {icon}
      </div>
      <RingGauge score={score} level={level} size={72} />
      <div className="text-center">
        <p className={`text-xs font-semibold ${p.text}`}>{label}</p>
        <p className={`text-[10px] opacity-70 ${p.text}`}>{riskLevelToLabel(level as RiskLevel)}</p>
      </div>
    </div>
  )
}

// ── Overall badge with mini ring ──────────────────────────────────────────────

function OverallBadge({ level, score }: { level: string; score: number }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 120)
    return () => clearTimeout(t)
  }, [])

  const p    = PALETTE[level] ?? PALETTE.MODERATE
  const size = 52
  const sw   = 5
  const r    = (size - sw * 2) / 2
  const cir  = 2 * Math.PI * r
  const off  = drawn ? cir * (1 - score / 100) : cir
  const cx   = size / 2
  const cy   = size / 2

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${p.bg} ${p.border}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute inset-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={p.track} strokeWidth={sw} />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={p.stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={cir}
            strokeDashoffset={off}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${p.text}`}>{score}</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Overall Risk</p>
        <p className={`text-base font-bold ${p.text}`}>{riskLevelToLabel(level as RiskLevel)}</p>
        <p className="text-[10px] text-gray-400">{score} / 100</p>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface RiskSummaryProps {
  profile: PropertyRiskProfile
}

export function RiskSummary({ profile }: RiskSummaryProps) {
  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Risk Summary</h2>
        <OverallBadge level={profile.overallRiskLevel} score={profile.overallRiskScore} />
      </div>

      <div className="grid grid-cols-5 gap-3">
        <RiskTile label="Flood"      level={profile.flood.level}      score={profile.flood.score}      icon={<Droplets    className="h-4 w-4" />} animDelay={0}   />
        <RiskTile label="Fire"       level={profile.fire.level}       score={profile.fire.score}       icon={<Flame       className="h-4 w-4" />} animDelay={80}  />
        <RiskTile label="Wind"       level={profile.wind.level}       score={profile.wind.score}       icon={<Wind        className="h-4 w-4" />} animDelay={160} />
        <RiskTile label="Earthquake" level={profile.earthquake.level} score={profile.earthquake.score} icon={<Mountain    className="h-4 w-4" />} animDelay={240} />
        <RiskTile label="Crime"      level={profile.crime.level}      score={profile.crime.score}      icon={<ShieldAlert className="h-4 w-4" />} animDelay={320} />
      </div>
    </div>
  )
}
