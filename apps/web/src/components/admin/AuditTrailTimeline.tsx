'use client'

import {
  auditActorLabel,
  auditEventLabel,
  groupAuditEntriesByDay,
  summarizeAuditTrail,
  verifyAuditChain,
  type AuditTrailEntry,
} from '@coverguard/shared'
import {
  CheckCircle2,
  Download,
  FileText,
  Link2,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react'

/**
 * Audit-trail viewer for the lender / regulator audience (P2 #14).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Renders a chronological timeline of audit entries grouped by day,
 * with a chain-integrity badge at the top and a per-entry actor +
 * event line. The chain check happens client-side via
 * {@link verifyAuditChain}; the parent supplies the hash function the
 * server already used for the digests.
 *
 * Stateless: parent fetches the entries + supplies the verifier and an
 * `onExport` callback.
 */
export interface AuditTrailTimelineProps {
  /** Audit entries, ordered oldest-first (verifier walks them forwards). */
  entries: readonly AuditTrailEntry[]
  /**
   * Hash function the server used to sign each entry. The viewer calls
   * it client-side over `auditEntryDigestInput` to detect tampering.
   */
  hashFn: (input: string) => string
  /** Fired when the user clicks "Export trail". */
  onExport?: () => void
}

export function AuditTrailTimeline({
  entries,
  hashFn,
  onExport,
}: AuditTrailTimelineProps) {
  const sorted = [...entries].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt),
  )
  const breakIndex = verifyAuditChain([...sorted], hashFn)
  const summary = summarizeAuditTrail(sorted)
  const grouped = groupAuditEntriesByDay(sorted)
  const chainIntact = breakIndex === -1

  return (
    <section
      aria-labelledby="audit-trail-heading"
      className="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
        <div className="flex-1">
          <h3 id="audit-trail-heading" className="text-base font-semibold text-slate-900">
            Audit trail
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {summary.totalEntries} {summary.totalEntries === 1 ? 'entry' : 'entries'}
            {summary.earliest && summary.latest ? (
              <>
                {' '}
                from{' '}
                <time dateTime={summary.earliest}>
                  {new Date(summary.earliest).toLocaleDateString()}
                </time>{' '}
                to{' '}
                <time dateTime={summary.latest}>
                  {new Date(summary.latest).toLocaleDateString()}
                </time>
              </>
            ) : null}
          </p>
          <ChainBadge intact={chainIntact} brokenIndex={breakIndex} />
        </div>
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export trail
          </button>
        ) : null}
      </header>

      {grouped.length === 0 ? (
        <p className="p-6 text-sm text-slate-500">No audit entries yet.</p>
      ) : (
        <ol className="divide-y divide-slate-200">
          {grouped.map(({ date, entries: dayEntries }) => (
            <li key={date} className="px-6 py-4">
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </h4>
              <ul className="mt-3 space-y-3">
                {dayEntries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

interface ChainBadgeProps {
  intact: boolean
  brokenIndex: number
}

function ChainBadge({ intact, brokenIndex }: ChainBadgeProps) {
  if (intact) {
    return (
      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Chain intact â tamper-evident
      </span>
    )
  }
  return (
    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
      <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
      Chain broken at entry {brokenIndex + 1} â investigate
    </span>
  )
}

interface EntryRowProps {
  entry: AuditTrailEntry
}

function EntryRow({ entry }: EntryRowProps) {
  return (
    <li className="flex items-start gap-3">
      <ActorIcon entry={entry} />
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">
          {auditEventLabel(entry.eventType)}
        </p>
        <p className="text-xs text-slate-500">
          <time dateTime={entry.occurredAt}>
            {new Date(entry.occurredAt).toLocaleTimeString()}
          </time>
          {' Â· '}
          {auditActorLabel(entry.actor)}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
          <Link2 className="h-3 w-3" aria-hidden />
          <code className="font-mono">{entry.resourceUrn}</code>
        </p>
      </div>
      <span
        title="Signature digest (truncated)"
        className="font-mono text-[10px] text-slate-400"
      >
        {entry.signature.digest.slice(0, 12)}â¦
      </span>
    </li>
  )
}

function ActorIcon({ entry }: { entry: AuditTrailEntry }) {
  switch (entry.actor.kind) {
    case 'USER':
      return (
        <span
          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700"
          aria-hidden
        >
          <User className="h-3.5 w-3.5" />
        </span>
      )
    case 'INTEGRATION':
      return (
        <span
          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700"
          aria-hidden
        >
          <FileText className="h-3.5 w-3.5" />
        </span>
      )
    case 'SYSTEM':
      return (
        <span
          className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-700"
          aria-hidden
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      )
  }
}
