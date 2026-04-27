'use client'

import { useState } from 'react'
import type { CarriersResult, Carrier } from '@coverguard/shared'
import { formatCoverageType } from '@coverguard/shared'
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Send, Clock, Info } from 'lucide-react'
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

// ─── Carrier-appetite freshness UI helpers ────────────────────────────────────

const SOURCE_LABEL: Record<NonNullable<Carrier['appetiteSource']>, string> = {
  CARRIER_API:   'Direct carrier API',
  AGGREGATOR:    'Aggregator feed',
  PUBLIC_FILING: 'State DOI public filing',
  INFERRED:      'Inferred from market conditions',
}

const SOURCE_SHORT: Record<NonNullable<Carrier['appetiteSource']>, string> = {
  CARRIER_API:   'Carrier API',
  AGGREGATOR:    'Aggregator',
  PUBLIC_FILING: 'Public filing',
  INFERRED:      'Inferred',
}

const CONFIDENCE_CONFIG: Record<NonNullable<Carrier['appetiteConfidence']>, { label: string; dot: string; ring: string }> = {
  HIGH:   { label: 'High confidence',   dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  MEDIUM: { label: 'Medium confidence', dot: 'bg-amber-500',   ring: 'ring-amber-200'   },
  LOW:    { label: 'Low confidence',    dot: 'bg-gray-400',    ring: 'ring-gray-200'    },
}

/** Compact relative-time formatter ("2h ago", "3d ago"). */
function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60_000))
  if (minutes < 1)        return 'just now'
  if (minutes < 60)       return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24)         return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30)          return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12)        return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/**
 * Per-row freshness indicator. Renders:
 *   • a confidence dot (color = HIGH/MEDIUM/LOW)
 *   • the relative time since the appetite signal was last refreshed
 *   • a hover tooltip with the source and confidence label
 */
function FreshnessIndicator({ carrier }: { carrier: Carrier }) {
  const conf = CONFIDENCE_CONFIG[carrier.appetiteConfidence]
  const sourceShort = SOURCE_SHORT[carrier.appetiteSource]
  const sourceLong  = SOURCE_LABEL[carrier.appetiteSource]
  const relative    = formatRelativeTime(carrier.appetiteUpdatedAt)

  const tooltip =
    `${conf.label}\nSource: ${sourceLong}\nUpdated: ${relative}`

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ${conf.ring}`}
      title={tooltip}
      aria-label={tooltip}
      suppressHydrationWarning
    >
      <span className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} aria-hidden />
      <Clock className="h-2.5 w-2.5" aria-hidden />
      <span>{relative}</span>
      <span className="hidden text-gray-400 sm:inline">·</span>
      <span className="hidden sm:inline">{sourceShort}</span>
    </span>
  )
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

      <div className="flex items-start gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-500" suppressHydrationWarning>
        <Info className="mt-0.5 h-3 w-3 shrink-0 text-gray-400" aria-hidden />
        <span>
          Each carrier shows its own freshness and source. Hover any
          {' '}
          <span className="inline-flex items-baseline gap-1 align-baseline">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-medium text-gray-600">freshness pill</span>
          </span>
          {' '}
          for source and confidence. Always verify availability directly with the carrier before binding.
        </span>
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
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
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
            <FreshnessIndicator carrier={carrier} />
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
