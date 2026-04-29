'use client'

import {
  canTransitionHandoff,
  refundEligibility,
  type LeadHandoff,
} from '@coverguard/shared'
import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react'

/**
 * Producer-side dashboard for inbound `LeadHandoff` rows (P2 #18 follow-up).
 *
 * Lists the producer's PENDING / ACCEPTED / DECLINED / EXPIRED / REFUNDED
 * handoffs and exposes the lifecycle actions the state machine allows:
 *
 *   - Accept (PENDING -> ACCEPTED)
 *   - Decline (PENDING -> DECLINED)
 *   - Claim refund (ACCEPTED -> REFUNDED, gated by the 7-day window)
 *
 * The component owns no I/O. It reads the state machine via
 * `canTransitionHandoff` so a button only appears when the transition is
 * legal, and uses `refundEligibility` to gate the refund button against
 * the 7-day window. Each click delegates to the parent's handler, which
 * is what calls the API.
 */
export interface ProducerHandoffDashboardProps {
  handoffs: readonly LeadHandoff[]
  onAccept: (handoffId: string) => Promise<void>
  onDecline: (handoffId: string) => Promise<void>
  onRefund: (handoffId: string, reason: string) => Promise<void>
  /** Map of handoff id to its in-flight action, if any. */
  inFlight?: Readonly<Record<string, 'ACCEPT' | 'DECLINE' | 'REFUND' | undefined>>
  /** Wall-clock for refund-eligibility checks. Injectable for tests. */
  now?: Date
}

export function ProducerHandoffDashboard({
  handoffs,
  onAccept,
  onDecline,
  onRefund,
  inFlight = {},
  now = new Date(),
}: ProducerHandoffDashboardProps) {
  if (handoffs.length === 0) {
    return (
      <section
        aria-labelledby="producer-handoff-empty-heading"
        className="mx-auto max-w-3xl rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center"
      >
        <h2
          id="producer-handoff-empty-heading"
          className="text-base font-semibold text-slate-900"
        >
          No handoffs yet
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Buyers matched to your directory profile will show up here.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="producer-handoff-heading" className="space-y-3">
      <h2
        id="producer-handoff-heading"
        className="text-base font-semibold text-slate-900"
      >
        Lead handoffs
      </h2>
      <ul role="list" className="space-y-3">
        {handoffs.map((handoff) => (
          <HandoffRow
            key={handoff.id}
            handoff={handoff}
            now={now}
            isWorking={inFlight[handoff.id]}
            onAccept={onAccept}
            onDecline={onDecline}
            onRefund={onRefund}
          />
        ))}
      </ul>
    </section>
  )
}

// ============================================================================
// Internal pieces
// ============================================================================

function HandoffRow({
  handoff,
  now,
  isWorking,
  onAccept,
  onDecline,
  onRefund,
}: {
  handoff: LeadHandoff
  now: Date
  isWorking: 'ACCEPT' | 'DECLINE' | 'REFUND' | undefined
  onAccept: (handoffId: string) => Promise<void>
  onDecline: (handoffId: string) => Promise<void>
  onRefund: (handoffId: string, reason: string) => Promise<void>
}) {
  const canAccept = canTransitionHandoff(handoff.status, 'ACCEPTED')
  const canDecline = canTransitionHandoff(handoff.status, 'DECLINED')
  const refund = refundEligibility(handoff, now)
  const dollars = (handoff.priceCents / 100).toFixed(2)
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Lead {handoff.leadId}
          </p>
          <p className="text-xs text-slate-500">
            Offered {new Date(handoff.createdAt).toLocaleString()} &middot; ${dollars}
          </p>
        </div>
        <StatusPill status={handoff.status} />
      </header>

      <footer className="flex flex-wrap items-center gap-2">
        {canAccept ? (
          <button
            type="button"
            disabled={!!isWorking}
            onClick={() => {
              void onAccept(handoff.id)
            }}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            {isWorking === 'ACCEPT' ? 'Accepting&hellip;' : 'Accept'}
          </button>
        ) : null}
        {canDecline ? (
          <button
            type="button"
            disabled={!!isWorking}
            onClick={() => {
              void onDecline(handoff.id)
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <XCircle className="h-4 w-4" aria-hidden />
            {isWorking === 'DECLINE' ? 'Declining&hellip;' : 'Decline'}
          </button>
        ) : null}
        {refund.eligible ? (
          <button
            type="button"
            disabled={!!isWorking}
            onClick={() => {
              const reason =
                typeof window !== 'undefined'
                  ? window.prompt('Why are you refunding this lead?')
                  : null
              if (reason && reason.trim().length > 0) {
                void onRefund(handoff.id, reason.trim())
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {isWorking === 'REFUND' ? 'Refunding&hellip;' : 'Claim refund'}
          </button>
        ) : null}
        {handoff.status === 'PENDING' ? (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3" aria-hidden />
            Expires {new Date(handoff.expiresAt).toLocaleString()}
          </span>
        ) : null}
      </footer>
    </li>
  )
}

function StatusPill({ status }: { status: LeadHandoff['status'] }) {
  switch (status) {
    case 'PENDING':
      return (
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
          Pending
        </span>
      )
    case 'ACCEPTED':
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          Accepted
        </span>
      )
    case 'DECLINED':
      return (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          Declined
        </span>
      )
    case 'EXPIRED':
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
          Expired
        </span>
      )
    case 'REFUNDED':
      return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
          Refunded
        </span>
      )
  }
}
