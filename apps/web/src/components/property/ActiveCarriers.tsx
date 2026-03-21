'use client'

import { useState } from 'react'
import type { CarriersResult, Carrier } from '@coverguard/shared'
import { CheckCircle, XCircle, AlertTriangle, Star, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { QuoteRequestModal } from './QuoteRequestModal'

const STATUS_CONFIG = {
  ACTIVELY_WRITING: { label: 'Actively Writing',  color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle,    dot: 'bg-green-500'  },
  LIMITED:          { label: 'Limited Writing',    color: 'text-yellow-700', bg: 'bg-yellow-100', icon: AlertTriangle,  dot: 'bg-yellow-500' },
  SURPLUS_LINES:    { label: 'Surplus Lines',      color: 'text-blue-700',   bg: 'bg-blue-100',   icon: AlertTriangle,  dot: 'bg-blue-500'   },
  NOT_WRITING:      { label: 'Not Writing',        color: 'text-gray-500',   bg: 'bg-gray-100',   icon: XCircle,        dot: 'bg-gray-400'   },
}

const MARKET_CONFIG = {
  SOFT:     { label: 'Soft Market — good availability',       color: 'text-green-700',  bg: 'bg-green-50'  },
  MODERATE: { label: 'Moderate Market',                       color: 'text-yellow-700', bg: 'bg-yellow-50' },
  HARD:     { label: 'Hard Market — limited availability',    color: 'text-orange-700', bg: 'bg-orange-50' },
  CRISIS:   { label: 'Market Crisis — very limited options',  color: 'text-red-700',    bg: 'bg-red-50'    },
}

interface ActiveCarriersProps {
  data: CarriersResult
  propertyId: string
  propertyAddress: string
}

export function ActiveCarriers({ data, propertyId, propertyAddress }: ActiveCarriersProps) {
  const [quoteCarrier, setQuoteCarrier] = useState<Carrier | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const marketConfig = MARKET_CONFIG[data.marketCondition]
  const activeCarriers = data.carriers.filter((c) => c.writingStatus === 'ACTIVELY_WRITING')
  const otherCarriers = data.carriers.filter((c) => c.writingStatus !== 'ACTIVELY_WRITING')

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Active Carriers</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${marketConfig.bg} ${marketConfig.color}`}>
            {marketConfig.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {activeCarriers.length} carrier{activeCarriers.length !== 1 ? 's' : ''} actively writing in this area
        </p>
      </div>

      <div className="divide-y divide-gray-50 p-3">
        {data.carriers.map((carrier) => (
          <CarrierRow
            key={carrier.id}
            carrier={carrier}
            expanded={expandedId === carrier.id}
            onToggle={() => setExpandedId(expandedId === carrier.id ? null : carrier.id)}
            onRequestQuote={() => setQuoteCarrier(carrier)}
          />
        ))}
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-400">
        Carrier data updated {new Date(data.lastUpdated).toLocaleDateString()}. Always verify availability directly with the carrier.
      </div>

      {/* Quote request modal */}
      {quoteCarrier && (
        <QuoteRequestModal
          carrier={quoteCarrier}
          propertyId={propertyId}
          propertyAddress={propertyAddress}
          onClose={() => setQuoteCarrier(null)}
        />
      )}
    </div>
  )
}

function CarrierRow({
  carrier,
  expanded,
  onToggle,
  onRequestQuote,
}: {
  carrier: Carrier
  expanded: boolean
  onToggle: () => void
  onRequestQuote: () => void
}) {
  const statusConfig = STATUS_CONFIG[carrier.writingStatus]
  const StatusIcon = statusConfig.icon
  const canRequestQuote = carrier.writingStatus === 'ACTIVELY_WRITING' || carrier.writingStatus === 'LIMITED'

  return (
    <div className={`rounded-lg p-3 transition-colors ${expanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-3">
        {/* Status dot */}
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusConfig.dot}`} />

        {/* Carrier info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{carrier.name}</p>
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {carrier.amBestRating}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusConfig.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </span>
            {carrier.avgPremiumModifier !== 1.0 && (
              <span className="text-xs text-gray-400">
                {carrier.avgPremiumModifier > 1 ? '+' : ''}
                {Math.round((carrier.avgPremiumModifier - 1) * 100)}% vs avg
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {canRequestQuote && (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestQuote() }}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Send className="h-3 w-3" />
              Request Quote
            </button>
          )}
          <button
            onClick={onToggle}
            className="btn-ghost p-1.5 text-gray-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-2 pl-5">
          <div className="flex flex-wrap gap-1">
            {carrier.coverageTypes.map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                {formatCoverageType(t)}
              </span>
            ))}
          </div>
          {carrier.specialties.length > 0 && (
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Specialties: </span>
              {carrier.specialties.join(', ')}
            </p>
          )}
          {carrier.notes && (
            <p className="text-xs text-gray-500">{carrier.notes}</p>
          )}
        </div>
      )}
    </div>
  )
}

function formatCoverageType(type: string): string {
  return ({
    HOMEOWNERS:    'Homeowners',
    FLOOD:         'Flood',
    EARTHQUAKE:    'Earthquake',
    WIND_HURRICANE: 'Wind/Hurricane',
    UMBRELLA:      'Umbrella',
    FIRE:          'Fire',
  } as Record<string, string>)[type] ?? type
}
