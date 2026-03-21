'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Property, PropertyRiskProfile, InsuranceCostEstimate, InsurabilityStatus } from '@coverguard/shared'
import { getProperty, getPropertyRisk, getPropertyInsurance, getPropertyInsurability } from '@/lib/api'
import { formatCurrency, formatAddress } from '@coverguard/shared'
import { riskLevelClasses, riskScoreColor } from '@/lib/utils'
import { Search, ArrowRight, Shield, DollarSign, AlertTriangle, Flame, Wind, Activity, Users } from 'lucide-react'

interface PropertyData {
  property: Property
  risk: PropertyRiskProfile | null
  insurance: InsuranceCostEstimate | null
  insurability: InsurabilityStatus | null
}

interface CompareViewProps {
  propertyIds: string[]
}

export function CompareView({ propertyIds }: CompareViewProps) {
  const [properties, setProperties] = useState<(PropertyData | null)[]>(
    Array(3).fill(null)
  )
  const [loading, setLoading] = useState<boolean[]>(Array(3).fill(false))

  useEffect(() => {
    propertyIds.forEach((id, idx) => {
      if (!id) return
      setLoading((prev) => { const n = [...prev]; n[idx] = true; return n })
      Promise.allSettled([
        getProperty(id),
        getPropertyRisk(id),
        getPropertyInsurance(id),
        getPropertyInsurability(id),
      ]).then(([prop, risk, ins, insur]) => {
        if (prop.status === 'rejected') return
        setProperties((prev) => {
          const next = [...prev]
          next[idx] = {
            property: prop.value,
            risk: risk.status === 'fulfilled' ? risk.value : null,
            insurance: ins.status === 'fulfilled' ? ins.value : null,
            insurability: insur.status === 'fulfilled' ? insur.value : null,
          }
          return next
        })
      }).finally(() => {
        setLoading((prev) => { const n = [...prev]; n[idx] = false; return n })
      })
    })
  }, [propertyIds.join(',')])

  const cols = [0, 1, 2]

  return (
    <div className="space-y-6">
      {/* Column headers */}
      <div className="grid grid-cols-3 gap-4">
        {cols.map((idx) => {
          const data = properties[idx]
          const isLoading = loading[idx]
          return (
            <div key={idx} className="card p-4">
              {isLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-100" />
                </div>
              ) : data ? (
                <div>
                  <Link
                    href={`/properties/${data.property.id}`}
                    className="font-semibold text-gray-900 hover:text-brand-700 hover:underline"
                  >
                    {data.property.address}
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-500">{formatAddress(data.property)}</p>
                  {data.property.estimatedValue && (
                    <p className="mt-1 text-sm font-semibold text-brand-700">
                      {formatCurrency(data.property.estimatedValue)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Search className="h-4 w-4" />
                  <span>No property selected</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Comparison rows */}
      <CompareSection
        title="Insurability"
        icon={<Shield className="h-4 w-4" />}
        rows={[
          {
            label: 'Overall Status',
            render: (d) => d?.insurability ? (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${riskLevelClasses(d.insurability.difficultyLevel)}`}>
                {d.insurability.difficultyLevel.replace('_', ' ')}
              </span>
            ) : null,
          },
          {
            label: 'Insurable',
            render: (d) => d?.insurability ? (
              <span className={`text-sm font-semibold ${d.insurability.isInsurable ? 'text-green-600' : 'text-red-600'}`}>
                {d.insurability.isInsurable ? 'Yes' : 'No'}
              </span>
            ) : null,
          },
        ]}
        properties={properties}
      />

      <CompareSection
        title="Overall Risk"
        icon={<AlertTriangle className="h-4 w-4" />}
        rows={[
          {
            label: 'Risk Level',
            render: (d) => d?.risk ? (
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${riskLevelClasses(d.risk.overallRiskLevel)}`}>
                {d.risk.overallRiskLevel.replace('_', ' ')}
              </span>
            ) : null,
          },
          {
            label: 'Risk Score',
            render: (d) => d?.risk ? (
              <span className={`text-lg font-bold ${riskScoreColor(d.risk.overallRiskScore)}`}>
                {d.risk.overallRiskScore}
                <span className="text-xs font-normal text-gray-400"> /100</span>
              </span>
            ) : null,
          },
        ]}
        properties={properties}
      />

      <CompareSection
        title="Hazard Scores"
        icon={<Flame className="h-4 w-4" />}
        rows={[
          { label: 'Flood',      render: (d) => <ScoreBadge score={d?.risk?.flood.score} /> },
          { label: 'Fire',       render: (d) => <ScoreBadge score={d?.risk?.fire.score} /> },
          { label: 'Wind',       render: (d) => <ScoreBadge score={d?.risk?.wind.score} /> },
          { label: 'Earthquake', render: (d) => <ScoreBadge score={d?.risk?.earthquake.score} /> },
          { label: 'Crime',      render: (d) => <ScoreBadge score={d?.risk?.crime.score} /> },
        ]}
        properties={properties}
      />

      <CompareSection
        title="Insurance Costs"
        icon={<DollarSign className="h-4 w-4" />}
        rows={[
          {
            label: 'Est. Annual Total',
            render: (d) => d?.insurance ? (
              <span className="text-base font-bold text-gray-900">
                {formatCurrency(d.insurance.estimatedAnnualTotal)}
              </span>
            ) : null,
          },
          {
            label: 'Est. Monthly',
            render: (d) => d?.insurance ? (
              <span className="text-sm font-semibold text-gray-700">
                {formatCurrency(d.insurance.estimatedMonthlyTotal)}/mo
              </span>
            ) : null,
          },
          {
            label: 'Confidence',
            render: (d) => d?.insurance ? (
              <span className="text-xs text-gray-500">{d.insurance.confidenceLevel}</span>
            ) : null,
          },
        ]}
        properties={properties}
      />

      {/* View full reports */}
      <div className="grid grid-cols-3 gap-4">
        {cols.map((idx) => {
          const data = properties[idx]
          return (
            <div key={idx}>
              {data && (
                <Link
                  href={`/properties/${data.property.id}`}
                  className="btn-primary flex w-full items-center justify-center gap-2 py-2.5"
                >
                  Full Report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScoreBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return null
  return (
    <span className={`text-sm font-semibold ${riskScoreColor(score)}`}>
      {score}
      <span className="text-xs font-normal text-gray-400"> /100</span>
    </span>
  )
}

interface CompareSectionProps {
  title: string
  icon: React.ReactNode
  rows: Array<{ label: string; render: (d: PropertyData | null) => React.ReactNode }>
  properties: (PropertyData | null)[]
}

function CompareSection({ title, icon, rows, properties }: CompareSectionProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-5 py-3 text-sm font-semibold text-gray-700">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-4 items-center px-5 py-3">
            <p className="text-sm text-gray-500">{row.label}</p>
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="px-2">
                {row.render(properties[idx] ?? null) ?? (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
