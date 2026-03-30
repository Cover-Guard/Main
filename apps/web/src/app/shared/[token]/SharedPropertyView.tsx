'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  MapPin,
  Home,
  Shield,
  AlertTriangle,
  Droplets,
  Flame,
  Wind,
  Mountain,
  ShieldAlert,
  DollarSign,
  Building2,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { viewSharedProperty } from '@/lib/api'
import type {
  Property,
  PropertyRiskProfile,
  InsuranceCostEstimate,
  CarriersResult,
} from '@coverguard/shared'

interface SharedPropertyViewProps {
  token: string
}

const RISK_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  LOW: { bg: 'bg-green-50', text: 'text-green-700', bar: 'bg-green-500' },
  MODERATE: { bg: 'bg-yellow-50', text: 'text-yellow-700', bar: 'bg-yellow-500' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
  VERY_HIGH: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
  EXTREME: { bg: 'bg-red-100', text: 'text-red-800', bar: 'bg-red-700' },
}

function riskStyle(level: string) {
  return RISK_COLORS[level] ?? RISK_COLORS.MODERATE
}

export function SharedPropertyView({ token }: SharedPropertyViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [risk, setRisk] = useState<PropertyRiskProfile | null>(null)
  const [insurance, setInsurance] = useState<InsuranceCostEstimate | null>(null)
  const [carriers, setCarriers] = useState<CarriersResult | null>(null)
  const [sharedBy, setSharedBy] = useState<{ firstName: string; lastName: string; company: string | null } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await viewSharedProperty(token)
        setProperty(data.property)
        setRisk(data.risk ?? null)
        setInsurance(data.insurance ?? null)
        setCarriers(data.carriers ?? null)
        setSharedBy(data.sharedBy)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'This link is no longer available.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading shared property report...</p>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-orange-400" />
          <h1 className="text-xl font-bold text-gray-900">Link Unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">
            {error ?? 'This shared property link is no longer available.'}
          </p>
          <Link
            href="/register"
            className="btn-primary mt-6 inline-block px-6 py-2.5"
          >
            Create Your Free Account
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shared by banner */}
      {sharedBy && (
        <div className="bg-brand-600 text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              <span className="text-sm font-medium">
                Shared by {sharedBy.firstName} {sharedBy.lastName}
                {sharedBy.company ? ` at ${sharedBy.company}` : ''}
              </span>
            </div>
            <Link
              href="/register"
              className="rounded-lg bg-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/30 transition-colors"
            >
              Sign up for CoverGuard
            </Link>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Property header */}
        <div className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-brand-50 p-3">
              <Home className="h-6 w-6 text-brand-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{property.address}</h1>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                {property.city}, {property.state} {property.zip}
              </div>
              {property.estimatedValue && (
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Est. Value: ${property.estimatedValue.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Risk summary */}
        {risk && (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Risk Assessment</h2>
            </div>

            {/* Overall risk */}
            <div className={cn('mb-6 rounded-xl p-4', riskStyle(risk.overallRiskLevel).bg)}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Overall Risk</span>
                <span className={cn('rounded-full px-3 py-1 text-sm font-bold', riskStyle(risk.overallRiskLevel).text, riskStyle(risk.overallRiskLevel).bg)}>
                  {risk.overallRiskLevel.replace('_', ' ')} ({risk.overallRiskScore}/100)
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-200">
                <div
                  className={cn('h-full rounded-full transition-all', riskStyle(risk.overallRiskLevel).bar)}
                  style={{ width: `${risk.overallRiskScore}%` }}
                />
              </div>
            </div>

            {/* Category breakdown */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Flood', icon: Droplets, data: risk.flood },
                { label: 'Fire', icon: Flame, data: risk.fire },
                { label: 'Wind', icon: Wind, data: risk.wind },
                { label: 'Earthquake', icon: Mountain, data: risk.earthquake },
                { label: 'Crime', icon: ShieldAlert, data: risk.crime },
              ].map(({ label, icon: Icon, data }) => (
                <div key={label} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn('text-xs font-semibold', riskStyle(data.level).text)}>
                      {data.level.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-400">{data.score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100">
                    <div
                      className={cn('h-full rounded-full', riskStyle(data.level).bar)}
                      style={{ width: `${data.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insurance estimate */}
        {insurance && (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Insurance Estimate</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              <div className="rounded-xl bg-brand-50 p-4 text-center">
                <p className="text-sm text-brand-600">Estimated Annual Total</p>
                <p className="mt-1 text-2xl font-bold text-brand-900">
                  ${insurance.estimatedAnnualTotal.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-4 text-center">
                <p className="text-sm text-gray-600">Estimated Monthly</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  ${insurance.estimatedMonthlyTotal.toLocaleString()}
                </p>
              </div>
            </div>

            {insurance.coverages.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Coverage Breakdown</h3>
                {insurance.coverages.map((cov) => (
                  <div key={cov.type} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                    <span className="text-sm text-gray-700">
                      {cov.type.replace(/_/g, ' ')}
                      {cov.required && <span className="ml-1.5 text-[10px] font-medium text-red-500">REQUIRED</span>}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      ${cov.averageAnnualPremium.toLocaleString()}/yr
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-gray-400">
              Estimates are for informational purposes only and may vary based on coverage options, deductibles, and carrier underwriting.
            </p>
          </div>
        )}

        {/* Active carriers */}
        {carriers && carriers.carriers.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">Active Carriers</h2>
            </div>

            <div className="space-y-3">
              {carriers.carriers
                .filter((c) => c.writingStatus === 'ACTIVELY_WRITING')
                .map((carrier) => (
                  <div key={carrier.id} className="flex items-center justify-between rounded-xl border border-gray-100 p-4">
                    <div>
                      <p className="font-medium text-gray-900">{carrier.name}</p>
                      <p className="text-xs text-gray-500">
                        AM Best: {carrier.amBestRating} · {carrier.coverageTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}
                      </p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                      Actively Writing
                    </span>
                  </div>
                ))}
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Market condition: {carriers.marketCondition}
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-8 text-center text-white shadow-sm">
          <h2 className="text-xl font-bold">Get Your Full Property Report</h2>
          <p className="mt-2 text-sm text-brand-100">
            Create a free CoverGuard account to save properties, compare risks, and request binding quotes from active carriers.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-block rounded-xl bg-white px-8 py-3 text-sm font-semibold text-brand-700 shadow hover:bg-gray-50 transition-colors"
          >
            Create Free Account
          </Link>
        </div>
      </div>
    </div>
  )
}
