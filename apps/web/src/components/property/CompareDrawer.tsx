'use client'

import type {
  Property,
  PropertyRiskProfile,
  InsuranceCostEstimate as IInsuranceCostEstimate,
  CarriersResult,
  PropertyPublicData,
  InsurabilityStatus,
} from '@coverguard/shared'
import { formatAddress } from '@coverguard/shared'
import { RiskSummary } from './RiskSummary'
import { RiskBreakdown } from './RiskBreakdown'
import { ActiveCarriers } from './ActiveCarriers'
import { InsuranceCostEstimate } from './InsuranceCostEstimate'
import { PropertyImages } from './PropertyImages'
import { RiskCostCard } from './RiskCostCard'
import { Loader2, AlertTriangle, TrendingUp, Search } from 'lucide-react'

interface ReportData {
  property: Property
  risk: PropertyRiskProfile
  insurance: IInsuranceCostEstimate
  insurability: InsurabilityStatus
  carriers: CarriersResult
  publicData: PropertyPublicData | null
}

type ReportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: ReportData }

interface CompareDrawerProps {
  compareProperty: Property | null | undefined
  compareState: ReportState
  onRetry: () => void
  activeTab: 'risks' | 'carriers'
  riskMeta: Record<string, { label: string; color: string; bgColor: string; borderColor: string }>
  riskCategories: readonly string[]
}

export function CompareDrawer({
  compareProperty, compareState, onRetry, activeTab, riskMeta, riskCategories,
}: CompareDrawerProps) {
  if (!compareProperty) {
    return (
      <div className="w-1/2 px-6 py-6">
        <div className="flex flex-col items-center justify-center h-full text-center py-20">
          <Search className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">Select a property to compare</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[240px]">
            Search for another property to see a side-by-side risk comparison.
          </p>
        </div>
      </div>
    )
  }

  const fullAddress = `${compareProperty.address}, ${compareProperty.city}, ${compareProperty.state} ${compareProperty.zip}`

  return (
    <div className="w-1/2 px-6 py-6">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Comparing with</p>
        <p className="text-base font-bold text-gray-900 truncate">{compareProperty.address}</p>
        <p className="text-sm text-gray-500">{formatAddress(compareProperty)}</p>
      </div>

      {compareState.status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">Loading comparison\u2026</p>
        </div>
      )}

      {compareState.status === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-red-300 mb-3" />
          <p className="font-semibold text-red-600">Failed to load</p>
          <p className="text-sm text-gray-400 mt-1">{compareState.error}</p>
          <button onClick={onRetry} className="mt-4 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition">
            Retry
          </button>
        </div>
      )}

      {compareState.status === 'success' && (
        <>
          {compareState.data.publicData?.images && compareState.data.publicData.images.length > 0 && (
            <div className="mb-6 rounded-xl overflow-hidden h-48">
              <PropertyImages images={compareState.data.publicData.images} address={fullAddress} />
            </div>
          )}

          {activeTab === 'risks' && (
            <div className="space-y-6">
              {compareState.data.risk && <RiskSummary profile={compareState.data.risk} />}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-gray-500" />
                  Cost to Insure by Risk
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {riskCategories.map((cat) => (
                    <RiskCostCard
                      key={cat}
                      category={cat}
                      meta={riskMeta[cat] ?? { label: cat, color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' }}
                      riskProfile={compareState.data.risk}
                      costEstimate={compareState.data.insurance}
                    />
                  ))}
                </div>
              </div>
              {compareState.data.risk && <RiskBreakdown profile={compareState.data.risk} />}
            </div>
          )}

          {activeTab === 'carriers' && (
            <div className="space-y-6">
              {compareState.data.carriers && (
                <ActiveCarriers data={compareState.data.carriers} propertyId={compareProperty.id} propertyAddress={fullAddress} />
              )}
              {compareState.data.insurance && (
                <InsuranceCostEstimate estimate={compareState.data.insurance} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
