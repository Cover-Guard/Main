'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type {
  Property,
  PropertyRiskProfile,
  InsuranceCostEstimate as IInsuranceCostEstimate,
  InsurabilityStatus,
  CarriersResult,
  PropertyPublicData,
} from '@coverguard/shared'
import { formatAddress, formatCurrency } from '@coverguard/shared'
import { getPropertyReport } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { RiskSummary } from './RiskSummary'
import { RiskBreakdown } from './RiskBreakdown'
import { InsuranceCostEstimate } from './InsuranceCostEstimate'
import { ActiveCarriers } from './ActiveCarriers'
import { PropertyImages } from './PropertyImages'
import { RiskCostCard } from './RiskCostCard'
import { ReportActions } from './ReportActions'
import { CompareDrawer } from './CompareDrawer'
import { Loader2, AlertTriangle, Shield, TrendingUp } from 'lucide-react'

interface PropertyRiskReportModalProps {
  property: Property
  open: boolean
  onClose: () => void
  compareProperty?: Property | null
}

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

type ReportAction =
  | { type: 'FETCH' }
  | { type: 'SUCCESS'; data: ReportData }
  | { type: 'ERROR'; error: string }

function reportReducer(_state: ReportState, action: ReportAction): ReportState {
  switch (action.type) {
    case 'FETCH':
      return { status: 'loading' }
    case 'SUCCESS':
      return { status: 'success', data: action.data }
    case 'ERROR':
      return { status: 'error', error: action.error }
  }
}

const RISK_CATEGORIES = ['flood', 'fire', 'earthquake', 'wind', 'crime'] as const
type RiskCategory = (typeof RISK_CATEGORIES)[number]

const RISK_META: Record<RiskCategory, { label: string; color: string; bgColor: string; borderColor: string }> = {
  flood: { label: 'Flood', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  fire: { label: 'Fire', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  earthquake: { label: 'Earthquake', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  wind: { label: 'Wind', color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
  crime: { label: 'Crime', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
}

export function PropertyRiskReportModal({
  property,
  open,
  onClose,
  compareProperty = null,
}: PropertyRiskReportModalProps) {
  const [state, dispatch] = useReducer(reportReducer, { status: 'idle' })
  const [compareState, compareDispatch] = useReducer(reportReducer, { status: 'idle' })
  const [showCompare, setShowCompare] = useState(false)
  const [activeTab, setActiveTab] = useState<'risks' | 'carriers'>('risks')
  const contentRef = useRef<HTMLDivElement>(null)

  const fetchReport = useCallback(() => {
    dispatch({ type: 'FETCH' })
    getPropertyReport(property)
      .then((data: ReportData) => dispatch({ type: 'SUCCESS', data }))
      .catch((err: unknown) =>
        dispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Failed to load report',
        }))
  }, [property])

  const fetchCompare = useCallback(() => {
    if (!compareProperty) return
    compareDispatch({ type: 'FETCH' })
    getPropertyReport(compareProperty)
      .then((data: ReportData) => compareDispatch({ type: 'SUCCESS', data }))
      .catch((err: unknown) =>
        compareDispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Failed to load comparison report',
        }))
  }, [compareProperty])

  useEffect(() => {
    if (open) fetchReport()
  }, [open, fetchReport])

  useEffect(() => {
    if (showCompare && compareProperty) fetchCompare()
  }, [showCompare, compareProperty, fetchCompare])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col"
        aria-label="Property risk report"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="px-6 py-4 flex items-start justify-between gap-4">
            <DialogHeader className="flex-1 min-w-0">
              <DialogDescription className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Property Risk Report
              </DialogDescription>
              <DialogTitle className="text-xl font-bold text-gray-900 truncate">
                {property.address}
              </DialogTitle>
              <p className="text-sm text-gray-600">
                {formatAddress(property)}
                {property.estimatedValue && (
                  <span className="ml-2 text-base font-semibold text-brand-700">
                    Est. {formatCurrency(property.estimatedValue)}
                  </span>
                )}
              </p>
            </DialogHeader>
            {state.status === 'success' && (
              <ReportActions
                property={property}
                fullAddress={fullAddress}
                onPrint={handlePrint}
                onCompare={() => setShowCompare((v) => !v)}
                showCompare={showCompare}
              />
            )}
          </div>
          {state.status === 'success' && (
            <div className="px-6 flex gap-1" role="tablist" aria-label="Report sections">
              <button
                role="tab"
                aria-selected={activeTab === 'risks'}
                onClick={() => setActiveTab('risks')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'risks' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                Risk Analysis
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'carriers'}
                onClick={() => setActiveTab('carriers')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === 'carriers' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                Carriers & Coverage
              </button>
            </div>
          )}
        </div>
        <div ref={contentRef} className="flex-1 overflow-y-auto" id="report-print-area">
          <div className={`flex ${showCompare ? 'divide-x divide-gray-200' : ''}`}>
            <div className={`${showCompare ? 'w-1/2' : 'w-full'} px-6 py-6`}>
              {state.status === 'loading' && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
                  <p className="text-sm text-gray-500">Loading property report…</p>
                </div>
              )}
              {state.status === 'error' && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertTriangle className="h-10 w-10 text-red-300 mb-3" />
                  <p className="font-semibold text-red-600">Failed to load report</p>
                  <p className="text-sm text-gray-400 mt-1">{state.error}</p>
                  <button
                    onClick={fetchReport}
                    className="mt-4 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition"
                  >
                    Retry
                  </button>
                </div>
              )}
              {state.status === 'success' && (
                <>
                  {state.data.publicData?.images && state.data.publicData.images.length > 0 && (
                    <div className="mb-6 rounded-xl overflow-hidden h-48">
                      <PropertyImages images={state.data.publicData.images} address={fullAddress} />
                    </div>
                  )}
                  {activeTab === 'risks' && (
                    <div className="space-y-6">
                      {state.data.risk && <RiskSummary profile={state.data.risk} />}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-gray-500" />
                          Cost to Insure by Risk
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {RISK_CATEGORIES.map((cat) => (
                            <RiskCostCard
                              key={cat}
                              category={cat}
                              meta={RISK_META[cat]}
                              riskProfile={state.data.risk}
                              costEstimate={state.data.insurance}
                            />
                          ))}
                        </div>
                      </div>
                      {state.data.risk && <RiskBreakdown profile={state.data.risk} />}
                    </div>
                  )}
                  {activeTab === 'carriers' && (
                    <div className="space-y-6">
                      {state.data.carriers && <ActiveCarriers data={state.data.carriers} propertyId={property.id} propertyAddress={fullAddress} />}
                      {state.data.insurance && <InsuranceCostEstimate estimate={state.data.insurance} />}
                    </div>
                  )}
                </>
              )}
            </div>
            {showCompare && (
              <CompareDrawer
                compareProperty={compareProperty}
                compareState={compareState}
                onRetry={fetchCompare}
                activeTab={activeTab}
                riskMeta={RISK_META}
                riskCategories={RISK_CATEGORIES}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
