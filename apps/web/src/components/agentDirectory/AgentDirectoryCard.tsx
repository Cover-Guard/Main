'use client'

import {
  handoffPriceCents,
  producerTier,
  scoreProducer,
  type Producer,
  type ProducerTier,
} from '@coverguard/shared'
import { Award, Clock, Star, UserCheck } from 'lucide-react'

/**
 * Buyer-facing producer card rendered inside the agent-directory match
 * UX (P2 #18).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * The card surfaces the signal the buyer needs to feel comfortable
 * being routed to a producer:
 *
 *   - tier badge (TOP / GOOD / NEW) so a buyer sees track record at
 *     a glance;
 *   - rating + acceptance + median response time;
 *   - brokerage name (so the buyer recognizes the brand if they're
 *     already shopping local);
 *   - a "Request quote" button gated on `onRequestQuote` (the parent
 *     POSTs to the matcher; this component owns no I/O so the matcher
 *     can stay inside the 5s spec budget).
 *
 * RISK-tier producers are intentionally not rendered. The matcher
 * already filters them out via `eligibleProducers`; this component
 * adds a defensive check so a stale list never leaks one through.
 */
export interface AgentDirectoryCardProps {
  producer: Producer
  /** Fired when the buyer clicks "Request quote". */
  onRequestQuote: (producerId: string) => Promise<void>
  /** Whether the parent is currently submitting the quote request. */
  isSubmitting?: boolean
  /**
   * Whether this card is the matcher's top pick. Top picks render with
   * a "Recommended" callout.
   */
  isTopPick?: boolean
}

export function AgentDirectoryCard({
  producer,
  onRequestQuote,
  isSubmitting = false,
  isTopPick = false,
}: AgentDirectoryCardProps) {
  const tier = producerTier(producer)
  if (tier === 'RISK') return null

  const score = scoreProducer(producer)
  const priceCents = handoffPriceCents(producer)

  return (
    <article
      aria-labelledby={`agent-${producer.id}-name`}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3
            id={`agent-${producer.id}-name`}
            className="text-base font-semibold text-slate-900"
          >
            {producer.name}
          </h3>
          <p className="text-sm text-slate-600">{producer.brokerageName}</p>
        </div>
        <TierBadge tier={tier} isTopPick={isTopPick} />
      </header>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <Stat
          icon={<Star className="h-4 w-4 text-amber-500" aria-hidden />}
          label="Rating"
          value={
            producer.ratingCount > 0
              ? `${producer.rating1to5.toFixed(1)} (${producer.ratingCount})`
              : 'New'
          }
        />
        <Stat
          icon={<UserCheck className="h-4 w-4 text-emerald-600" aria-hidden />}
          label="Accept rate"
          value={`${Math.round(producer.leadAcceptanceRate * 100)}%`}
        />
        <Stat
          icon={<Clock className="h-4 w-4 text-slate-500" aria-hidden />}
          label="Avg response"
          value={`${producer.avgResponseHours.toFixed(1)}h`}
        />
      </dl>

      <p className="text-xs text-slate-500">
        Licensed in {producer.licenseStates.join(', ')} &middot; Quotes{' '}
        {producer.propertyTypes
          .map((t) => t.replace(/_/g, ' ').toLowerCase())
          .join(', ')}
      </p>

      <footer className="mt-1 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          Match score {(score * 100).toFixed(0)} / 100
        </span>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void onRequestQuote(producer.id)
          }}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? 'Requesting&hellip;' : 'Request quote'}
        </button>
      </footer>

      {/*
        We surface the producer's per-handoff price so brokerages can
        see exactly what they're agreeing to pay if the buyer accepts.
        Buyers don't see the price; the parent passes the producer's
        side of the modal here.
      */}
      <p className="sr-only" data-handoff-price-cents={priceCents}>
        Producer pays {(priceCents / 100).toFixed(2)} USD on accept.
      </p>
    </article>
  )
}

// ============================================================================
// Internal pieces
// ============================================================================

function TierBadge({ tier, isTopPick }: { tier: ProducerTier; isTopPick: boolean }) {
  if (isTopPick) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
        <Award className="h-3 w-3" aria-hidden />
        Recommended
      </span>
    )
  }
  switch (tier) {
    case 'TOP':
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          Top producer
        </span>
      )
    case 'GOOD':
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          Trusted
        </span>
      )
    case 'NEW':
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
          New
        </span>
      )
    case 'RISK':
      return null
  }
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}
