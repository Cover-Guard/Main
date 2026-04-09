'use client'

import type {
  PropertyRiskProfile,
  InsuranceCostEstimate as IInsuranceCostEstimate,
} from '@coverguard/shared'
import { formatCurrency } from '@coverguard/shared'
import {
  Droplets,
  Flame,
  Mountain,
  Wind,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

interface RiskCostCardProps {
  category: string
  meta: { label: string; color: string; bgColor: string; borderColor: string }
  riskProfile: PropertyRiskProfile
  costEstimate: IInsuranceCostEstimate
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  flood: Droplets,
  fire: Flame,
  earthquake: Mountain,
  wind: Wind,
  crime: ShieldAlert,
}

function getRiskLevel(
  profile: PropertyRiskProfile,
  category: string,
): { score: number; label: string } | null {
  const risks = profile.risks ?? profile.categories
  if (!risks) return null
  const entry = Array.isArray(risks)
    ? risks.find(
        (r: { name?: string; category?: string }) =>
          (r.name ?? r.category ?? '').toLowerCase() === category,
      )
    : (risks as Record<string, unknown>)[category]
  if (!entry) return null
  const score =
    typeof entry === 'object' && entry !== null
      ? ((entry as Record<string, unknown>).score as number) ??
        ((entry as Record<string, unknown>).level as number) ?? 0
      : 0
  const label =
    typeof entry === 'object' && entry !== null
      ? ((entry as Record<string, string>).label ??
        (entry as Record<string, string>).severity ?? '')
      : ''
  return { score, label }
}

function getCostForCategory(
  estimate: IInsuranceCostEstimate,
  category: string,
): number | null {
  const breakdown = estimate.breakdown ?? estimate.costByRisk ?? estimate.categories
  if (!breakdown) return null
  if (Array.isArray(breakdown)) {
    const match = breakdown.find(
      (b: { name?: string; category?: string }) =>
        (b.name ?? b.category ?? '').toLowerCase() === category,
    )
    return match
      ? ((match as Record<string, unknown>).cost as number) ??
          ((match as Record<string, unknown>).premium as number) ?? null
      : null
  }
  const entry = (breakdown as Record<string, unknown>)[category]
  if (typeof entry === 'number') return entry
  if (typeof entry === 'object' && entry !== null)
    return ((entry as Record<string, unknown>).cost as number) ??
      ((entry as Record<string, unknown>).premium as number) ?? null
  return null
}

function riskScoreColor(score: number): string {
  if (score <= 3) return 'bg-green-500'
  if (score <= 6) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function RiskCostCard({ category, meta, riskProfile, costEstimate }: RiskCostCardProps) {
  const Icon = CATEGORY_ICONS[category] ?? ShieldAlert
  const risk = getRiskLevel(riskProfile, category)
  const cost = getCostForCategory(costEstimate, category)

  return (
    <div className={`rounded-xl border ${meta.borderColor} ${meta.bgColor} p-4 transition hover:shadow-md`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex items-center justify-center h-8 w-8 rounded-lg ${meta.bgColor}`}>
          <Icon className={`h-4 w-4 ${meta.color}`} />
        </div>
        <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
      </div>
      {risk && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-500">Risk Level</span>
            <span className="text-xs font-medium text-gray-700">
              {risk.label || `${risk.score}/10`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${riskScoreColor(risk.score)}`}
              style={{ width: `${Math.min(risk.score * 10, 100)}%` }}
            />
          </div>
        </div>
      )}
      <div className="pt-2 border-t border-gray-200/60">
        <span className="text-xs text-gray-500 block">Annual Premium</span>
        <span className="text-lg font-bold text-gray-900">
          {cost !== null ? formatCurrency(cost) : '\u2014'}
        </span>
        {cost !== null && <span className="text-xs text-gray-400 ml-1">/yr</span>}
      </div>
    </div>
  )
}
