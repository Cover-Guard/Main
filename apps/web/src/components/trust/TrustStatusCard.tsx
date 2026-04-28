'use client'

import type { TrustPortalSnapshot } from '@coverguard/shared'
import {
  soc2ProgressPercent,
  soc2StatusLabel,
  soc2StatusTone,
  summarizeTrustSnapshot,
} from '@coverguard/shared'
import { ShieldCheck } from 'lucide-react'

/**
 * Hero card for the public trust portal (P1 #11).
 *
 * Stateless. Takes a {@link TrustPortalSnapshot} (assembled by the page
 * fetcher / CMS) and renders the SOC 2 badge + progress bar + the one-
 * line summary. Sits at the top of trust.coverguard.io.
 *
 * Spec: docs/enhancements/P1-enhancements.md ("P1 #11 - Public Trust
 * Portal + SOC 2 Type II") - "trust.coverguard.io style page with:
 * current SOC 2 status, subprocessors list, data-handling policy..."
 */
export interface TrustStatusCardProps {
  snapshot: TrustPortalSnapshot
}

const TONE_VARIANT: Record<'neutral' | 'progress' | 'success', string> = {
  neutral:  'bg-gray-50 text-gray-800 ring-gray-200',
  progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  success:  'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

const PROGRESS_FILL: Record<'neutral' | 'progress' | 'success', string> = {
  neutral:  'bg-gray-400',
  progress: 'bg-amber-500',
  success:  'bg-emerald-500',
}

export function TrustStatusCard({ snapshot }: TrustStatusCardProps) {
  const tone = soc2StatusTone(snapshot.soc2Status)
  const percent = soc2ProgressPercent(snapshot.soc2Status)
  const summary = summarizeTrustSnapshot(snapshot)

  return (
    <section
      aria-labelledby="trust-status-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2
            id="trust-status-heading"
            className="text-base font-semibold text-gray-900"
          >
            Trust &amp; security
          </h2>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${TONE_VARIANT[tone]}`}
        >
          {soc2StatusLabel(snapshot.soc2Status)}
        </span>
      </header>
      <p className="mt-2 text-xs text-gray-500">{summary}</p>
      <div className="mt-4">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`SOC 2 readiness: ${percent}%`}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        >
          <div
            className={`h-full transition-all ${PROGRESS_FILL[tone]}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-gray-400">
          SOC 2 readiness · {percent}%
        </p>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Last updated{' '}
        {new Date(snapshot.generatedAt).toLocaleDateString(undefined, {
          year:  'numeric',
          month: 'short',
          day:   'numeric',
        })}
      </p>
    </section>
  )
}
