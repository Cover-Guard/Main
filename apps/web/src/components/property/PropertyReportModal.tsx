'use client'

import { useCallback, useEffect, useReducer } from 'react'
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
import { InsurabilityPanel } from './InsurabilityPanel'
import { ActiveCarriers } from './ActiveCarriers'
import { PropertyImages } from './PropertyImages'
import { PropertyPublicInfo } from './PropertyPublicInfo'
import { Loader2, AlertTriangle } from 'lucide-react'

interface PropertyReportModalProps {
  property: Property
  open: boolean
  onClose: () => void
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

export function PropertyReportModal({ property, open, onClose }: PropertyReportModalProps) {
  const [state, dispatch] = useReducer(reportReducer, { status: 'idle' })

  const fetchReport = useCallback(() => {
    dispatch({ type: 'FETCH' })
    getPropertyReport(property.id)
      .then((data) => dispatch({ type: 'SUCCESS', data }))
      .catch((err) => dispatch({ type: 'ERROR', error: err instanceof Error ? err.message : 'Failed to load report' }))
  }, [property.id])

  useEffect(() => {
    if (!open) return
    fetchReport()
  }, [open, fetchReport])

  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <DialogHeader>
            <DialogDescription className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Property Report
            </DialogDescription>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {property.address}
            </DialogTitle>
            <p className="text-sm text-gray-600">{formatAddress(property)}</p>
            {property.estimatedValue && (
              <p className="text-base font-semibold text-brand-700 mt-1">
                Est. {formatCurrency(property.estimatedValue)}
              </p>
            )}
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {state.status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Loading property report...</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-red-300 mb-3" />
              <p className="font-semibold text-red-600">Failed to load report</p>
              <p className="text-sm text-gray-400 mt-1">{state.error}</p>
              <button
                onClick={fetchReport}
                className="mt-4 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {state.status === 'success' && (
            <div className="space-y-6">
              {/* Property Images */}
              {state.data.publicData?.images && state.data.publicData.images.length > 0 && (
                <PropertyImages images={state.data.publicData.images} address={fullAddress} />
              )}

              {/* Insurability */}
              {state.data.insurability && (
                <InsurabilityPanel status={state.data.insurability} />
              )}

              {/* Risk */}
              {state.data.risk && (
                <>
                  <RiskSummary profile={state.data.risk} />
                  <RiskBreakdown profile={state.data.risk} />
                </>
              )}

              {/* Carriers & Insurance */}
              {state.data.carriers && (
                <ActiveCarriers
                  data={state.data.carriers}
                  propertyId={property.id}
                  propertyAddress={fullAddress}
                />
              )}
              {state.data.insurance && (
                <InsuranceCostEstimate estimate={state.data.insurance} />
              )}

              {/* Public Info (tax, amenities, etc.) */}
              {state.data.publicData && (
                <PropertyPublicInfo data={state.data.publicData} />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
