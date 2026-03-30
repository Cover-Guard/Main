'use client'

import { useEffect, useState } from 'react'
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

export function PropertyReportModal({ property, open, onClose }: PropertyReportModalProps) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    // Reset state when opening for a new property
    setReport(null)
    setError(null)
    setLoading(true)

    getPropertyReport(property.id)
      .then((data) => setReport(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [open, property.id])

  const fullAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
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
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Loading property report...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-red-300 mb-3" />
              <p className="font-semibold text-red-600">Failed to load report</p>
              <p className="text-sm text-gray-400 mt-1">{error}</p>
              <button
                onClick={() => {
                  setError(null)
                  setLoading(true)
                  getPropertyReport(property.id)
                    .then((data) => setReport(data))
                    .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
                    .finally(() => setLoading(false))
                }}
                className="mt-4 px-4 py-2 text-sm font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {report && (
            <div className="space-y-6">
              {/* Property Images */}
              {report.publicData?.images && report.publicData.images.length > 0 && (
                <PropertyImages images={report.publicData.images} address={fullAddress} />
              )}

              {/* Insurability */}
              {report.insurability && (
                <InsurabilityPanel status={report.insurability} />
              )}

              {/* Risk */}
              {report.risk && (
                <>
                  <RiskSummary profile={report.risk} />
                  <RiskBreakdown profile={report.risk} />
                </>
              )}

              {/* Carriers & Insurance */}
              {report.carriers && (
                <ActiveCarriers
                  data={report.carriers}
                  propertyId={property.id}
                  propertyAddress={fullAddress}
                />
              )}
              {report.insurance && (
                <InsuranceCostEstimate estimate={report.insurance} />
              )}

              {/* Public Info (tax, amenities, etc.) */}
              {report.publicData && (
                <PropertyPublicInfo data={report.publicData} />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
