'use client'

import type { QuoteStatusEvent, QuoteStatusSource } from '@coverguard/shared'
import { quoteStatusCopy } from '@coverguard/shared'
import { QuoteStatusBadge } from './QuoteStatusBadge'

/**
 * Vertical timeline of status events for a single quote-request (P0 #4).
 *
 * Spec: docs/enhancements/p0/04-quote-request-status-feedback.md.
 *
 * Renders a chronological list of `QuoteStatusEvent` rows with badge,
 * timestamp, source pill, and any decline reason / message. Designed to
 * sit inside the property report's "Carriers & Coverage" tab below the
 * carrier card, or in the agent's quote dashboard.
 *
 * The events themselves come from the API — this component is presentation
 * only. Until the API exposes them, callers can synthesize a single
 * REQUESTED event from the existing `QuoteRequest.submittedAt` and pass
 * it in as a one-element array; the timeline degrades gracefully.
 */
export function QuoteStatusTimeline({
  events,
}: {
  events: readonly QuoteStatusEvent[]
}) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No status updates yet. The carrier will be notified to acknowledge
        receipt shortly.
      </p>
    )
  }

  // Most-recent first.
  const sorted = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? 1 : -1,
  )

  return (
    <ol className="relative space-y-4 pl-5" aria-label="Quote status timeline">
      <span
        aria-hidden
        className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200"
      />
      {sorted.map((event, idx) => {
        const copy = quoteStatusCopy(event.status)
        const isLatest = idx === 0
        return (
          <li key={event.id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-3.5 top-1 h-2 w-2 rounded-full ring-2 ring-white ${
                isLatest ? DOT_VARIANT[copy.variant] : 'bg-gray-300'
              }`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <QuoteStatusBadge status={event.status} size="sm" />
              <span
                className="text-[11px] tabular-nums text-gray-500"
                suppressHydrationWarning
              >
                {formatRelative(event.occurredAt)}
              </span>
              <span className="text-[11px] text-gray-400">
                via {SOURCE_LABEL[event.source]}
              </span>
            </div>
            {event.message && (
              <p className="mt-1 text-xs text-gray-600">{event.message}</p>
            )}
            {event.declineReason && (
              <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                <span className="font-semibold">Decline reason:</span>{' '}
                {event.declineReason}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

const DOT_VARIANT: Record<
  ReturnType<typeof quoteStatusCopy>['variant'],
  string
> = {
  neutral:  'bg-gray-400',
  pending:  'bg-blue-500',
  progress: 'bg-amber-500',
  success:  'bg-emerald-500',
  warning:  'bg-orange-500',
  danger:   'bg-red-500',
}

const SOURCE_LABEL: Record<QuoteStatusSource, string> = {
  CARRIER_WEBHOOK:  'carrier webhook',
  CARRIER_API_POLL: 'carrier API',
  EMAIL_PARSE:      'inbound email',
  AGENT_MANUAL:     'agent update',
  SYSTEM:           'CoverGuard',
}

function formatRelative(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
