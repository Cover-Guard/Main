'use client'

import { Sparkles } from 'lucide-react'

/**
 * Top-of-report panel rendered only in Buyer view (P0 #2).
 *
 * Spec: docs/enhancements/p0/02-buyer-friendly-report.md.
 *
 * The agent view dives straight into peril scores and carrier appetite; a
 * non-agent reader needs a one-paragraph orientation first. This component
 * is intentionally narrow: it explains what the report is and what to do
 * with it, and links back to the agent who shared it (when present).
 */
export function BuyerViewIntro({ agentName }: { agentName?: string | null }) {
  return (
    <section
      aria-label="What this report covers"
      className="mb-6 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
          <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">
            What this report tells you
          </p>
          <p>
            We pulled flood, fire, wind, earthquake, and crime data from federal
            and state sources, then checked which insurance carriers are
            actively quoting properties like this one in this market.
          </p>
          <p>
            Use the sections below to understand what insurance is likely to
            cost, which perils most affect that price, and whether coverage is
            generally easy or hard to find here.
            {agentName && (
              <>
                {' '}If anything is unclear, reach out to <span className="font-medium text-gray-900">{agentName}</span>—they shared this report with you and can walk you through next steps.
              </>
            )}
          </p>
          <p className="text-xs text-gray-500">
            Estimates only. Actual quotes depend on carrier underwriting and
            individual policy details.
          </p>
        </div>
      </div>
    </section>
  )
}
