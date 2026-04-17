'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Plus,
  AlertTriangle,
  Loader2,
  Clock,
  X,
  Trash2,
} from 'lucide-react'
import {
  DEAL_FALLOUT_REASONS,
  DEAL_FALLOUT_REASON_LABELS,
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  type DealFalloutReason,
  type DealStage,
  type DealStats,
  type DealWithRelations,
} from '@coverguard/shared'
import {
  createDeal,
  deleteDeal,
  getDealStats,
  listDeals,
  updateDeal,
  type CreateDealPayload,
} from '@/lib/api'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${Math.round(v).toLocaleString()}`
}

function fmtPercent(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(0)}%`
}

const STAGE_COLOR: Record<DealStage, { bg: string; text: string; ring: string }> = {
  PROSPECT:       { bg: 'bg-slate-100',   text: 'text-slate-700',  ring: 'ring-slate-200' },
  IN_PROGRESS:    { bg: 'bg-blue-100',    text: 'text-blue-700',   ring: 'ring-blue-200' },
  UNDER_CONTRACT: { bg: 'bg-amber-100',   text: 'text-amber-700',  ring: 'ring-amber-200' },
  CLOSED_WON:     { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  FELL_OUT:       { bg: 'bg-rose-100',    text: 'text-rose-700',   ring: 'ring-rose-200' },
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export function DealsKpiPanel() {
  const [stats, setStats] = useState<DealStats | null>(null)
  const [deals, setDeals] = useState<DealWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutating, setMutating] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [falloutPrompt, setFalloutPrompt] = useState<DealWithRelations | null>(null)

  const refresh = useCallback(() => {
    return Promise.all([getDealStats(), listDeals()])
      .then(([s, d]) => {
        setStats(s)
        setDeals(d)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load deals'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleStageChange = useCallback(
    async (deal: DealWithRelations, nextStage: DealStage) => {
      if (nextStage === deal.stage) return
      // Defer the FELL_OUT transition until we have a reason — open the prompt modal.
      if (nextStage === 'FELL_OUT') {
        setFalloutPrompt({ ...deal, stage: 'FELL_OUT' })
        return
      }
      setMutating(true)
      try {
        await updateDeal(deal.id, { stage: nextStage })
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update deal')
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this deal? This cannot be undone.')) return
      setMutating(true)
      try {
        await deleteDeal(id)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete deal')
      } finally {
        setMutating(false)
      }
    },
    [refresh],
  )

  const stageMax = useMemo(
    () => (stats ? Math.max(1, ...stats.byStage.map((s) => s.count)) : 1),
    [stats],
  )

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="h-32 rounded-lg bg-gray-100 animate-pulse" />
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="text-center py-6">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-red-400" />
        <p className="text-xs font-medium text-red-600">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); refresh() }}
          className="mt-2 px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-4">
      {/* Top stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatCard
          icon={TrendingUp}
          label="Close Rate"
          value={fmtPercent(stats.closeRate)}
          tone="indigo"
          sub={
            stats.closeRate == null
              ? 'No settled deals yet'
              : `${stats.closedWonCount} won / ${stats.fellOutCount} lost`
          }
        />
        <StatCard
          icon={CheckCircle2}
          label="Closed Won"
          value={String(stats.closedWonCount)}
          tone="emerald"
          sub={fmtCurrency(stats.closedWonValue)}
        />
        <StatCard
          icon={XCircle}
          label="Fell Out"
          value={String(stats.fellOutCount)}
          tone="rose"
          sub={`${fmtCurrency(stats.fellOutValue)} lost`}
        />
        <StatCard
          icon={Clock}
          label="Avg Close Time"
          value={stats.avgCloseTimeDays != null ? `${stats.avgCloseTimeDays}d` : '—'}
          tone="slate"
          sub={`${stats.activeCount} active in pipeline`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline by stage */}
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Briefcase size={12} />
              Pipeline by Stage
            </h3>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 px-2 py-1 bg-gray-900 hover:bg-gray-800 text-white rounded text-[11px] font-medium transition-colors"
            >
              <Plus size={11} /> Add Deal
            </button>
          </div>
          <div className="space-y-1.5">
            {stats.byStage.map((s) => {
              const widthPct = (s.count / stageMax) * 100
              const colors = STAGE_COLOR[s.stage]
              return (
                <div key={s.stage} className="flex items-center gap-2">
                  <span className={`w-32 text-xs font-medium ${colors.text}`}>
                    {DEAL_STAGE_LABELS[s.stage]}
                  </span>
                  <div className="flex-1 h-5 rounded bg-gray-50 overflow-hidden">
                    <div
                      className={`h-full ${colors.bg} transition-all`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-semibold text-gray-700 tabular-nums">
                    {s.count}
                  </span>
                  <span className="w-20 text-right text-[10px] text-gray-400 tabular-nums">
                    {fmtCurrency(s.totalValue)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Fallout breakdown */}
        <div className="border border-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={12} className="text-rose-400" />
            Fallout by Cause
          </h3>
          {stats.falloutBreakdown.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              No fall-outs yet — every settled deal has closed.
            </p>
          ) : (
            <div className="space-y-1.5">
              {stats.falloutBreakdown.map((b) => (
                <div key={b.reason} className="flex items-center gap-2">
                  <span className="w-44 text-xs text-gray-700 truncate" title={DEAL_FALLOUT_REASON_LABELS[b.reason]}>
                    {DEAL_FALLOUT_REASON_LABELS[b.reason]}
                  </span>
                  <div className="flex-1 h-4 rounded bg-gray-50 overflow-hidden">
                    <div
                      className="h-full bg-rose-300 transition-all"
                      style={{ width: `${b.percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold text-rose-600 tabular-nums">
                    {b.count}
                  </span>
                  <span className="w-12 text-right text-[10px] text-gray-400 tabular-nums">
                    {b.percentage.toFixed(0)}%
                  </span>
                  <span className="w-16 text-right text-[10px] text-gray-400 tabular-nums">
                    {fmtCurrency(b.lostValue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Deals list */}
      <div className="border border-gray-200 rounded-lg">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Recent Deals ({deals.length})
          </h3>
          {mutating && <Loader2 size={12} className="animate-spin text-gray-400" />}
        </div>
        {deals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Briefcase className="mx-auto mb-2 h-7 w-7 opacity-30" />
            <p className="text-xs font-medium">No deals tracked yet</p>
            <p className="text-xs mt-1">Add a deal to start tracking close rate and fall-out causes.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {deals.map((deal) => (
              <DealRow
                key={deal.id}
                deal={deal}
                disabled={mutating}
                onStageChange={(next) => handleStageChange(deal, next)}
                onDelete={() => handleDelete(deal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Banner-style error for non-fatal mutation failures */}
      {error && stats && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {showAdd && (
        <AddDealModal
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false)
            await refresh()
          }}
        />
      )}
      {falloutPrompt && (
        <FalloutReasonModal
          deal={falloutPrompt}
          onCancel={() => setFalloutPrompt(null)}
          onConfirm={async (reason, notes) => {
            setMutating(true)
            try {
              await updateDeal(falloutPrompt.id, {
                stage: 'FELL_OUT',
                falloutReason: reason,
                falloutNotes: notes || null,
              })
              setFalloutPrompt(null)
              await refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to record fall-out')
            } finally {
              setMutating(false)
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: string
  tone: 'indigo' | 'emerald' | 'rose' | 'slate'
  sub?: string
}

const TONE_CLASSES: Record<StatCardProps['tone'], { bg: string; text: string }> = {
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-600' },
}

function StatCard({ icon: Icon, label, value, tone, sub }: StatCardProps) {
  const classes = TONE_CLASSES[tone]
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`p-1 rounded ${classes.bg}`}>
          <Icon size={12} className={classes.text} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

interface DealRowProps {
  deal: DealWithRelations
  disabled: boolean
  onStageChange: (s: DealStage) => void
  onDelete: () => void
}

function DealRow({ deal, disabled, onStageChange, onDelete }: DealRowProps) {
  const stageColors = STAGE_COLOR[deal.stage]
  return (
    <div className="px-3 py-2 flex items-center gap-3 hover:bg-gray-50">
      <div className={`w-1 self-stretch rounded ${stageColors.bg}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate">{deal.title}</p>
        <p className="text-[10px] text-gray-500 truncate">
          {deal.property ? `${deal.property.address}, ${deal.property.city}, ${deal.property.state}` : 'No linked property'}
          {deal.client && ` • ${deal.client.firstName} ${deal.client.lastName}`}
          {deal.carrierName && ` • ${deal.carrierName}`}
        </p>
        {deal.stage === 'FELL_OUT' && deal.falloutReason && (
          <p className="text-[10px] text-rose-600 mt-0.5">
            ↳ {DEAL_FALLOUT_REASON_LABELS[deal.falloutReason]}
            {deal.falloutNotes && <span className="text-gray-400"> — {deal.falloutNotes}</span>}
          </p>
        )}
      </div>
      <span className="text-xs text-gray-700 tabular-nums w-16 text-right shrink-0">
        {fmtCurrency(deal.dealValue)}
      </span>
      <select
        value={deal.stage}
        disabled={disabled}
        onChange={(e) => onStageChange(e.target.value as DealStage)}
        className={`text-[11px] font-medium rounded px-2 py-1 border-0 ${stageColors.bg} ${stageColors.text} ring-1 ${stageColors.ring} disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2`}
      >
        {DEAL_STAGES.map((s) => (
          <option key={s} value={s}>
            {DEAL_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        onClick={onDelete}
        disabled={disabled}
        className="p-1 text-gray-300 hover:text-rose-500 transition-colors disabled:opacity-30"
        title="Delete deal"
        aria-label="Delete deal"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Modals ─────────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

interface AddDealModalProps {
  onClose: () => void
  onCreated: () => void | Promise<void>
}

function AddDealModal({ onClose, onCreated }: AddDealModalProps) {
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<DealStage>('PROSPECT')
  const [dealValue, setDealValue] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setSubmitError('Title is required')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: CreateDealPayload = {
        title: title.trim(),
        stage,
        dealValue: dealValue ? parseInt(dealValue, 10) : null,
        carrierName: carrierName.trim() || null,
        notes: notes.trim() || null,
      }
      await createDeal(payload)
      await onCreated()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create deal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Add Deal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 220 Coastal Hwy — Harbor Retail"
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none"
            autoFocus
            maxLength={200}
          />
        </Field>
        <Field label="Stage">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as DealStage)}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none"
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Deal value (USD)">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
            placeholder="0"
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none"
          />
        </Field>
        <Field label="Carrier (optional)">
          <input
            type="text"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none"
            maxLength={120}
          />
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none resize-none"
            maxLength={2000}
          />
        </Field>
        {submitError && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
            {submitError}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={11} className="animate-spin" />}
            Add Deal
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

interface FalloutReasonModalProps {
  deal: DealWithRelations
  onCancel: () => void
  onConfirm: (reason: DealFalloutReason, notes: string) => void | Promise<void>
}

function FalloutReasonModal({ deal, onCancel, onConfirm }: FalloutReasonModalProps) {
  const [reason, setReason] = useState<DealFalloutReason | ''>('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return
    onConfirm(reason, notes.trim())
  }

  return (
    <ModalShell title={`Why did "${deal.title}" fall out?`} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-gray-500">
          Recording the cause keeps the dashboard fall-out breakdown meaningful.
        </p>
        <Field label="Cause">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as DealFalloutReason)}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none"
            autoFocus
            required
          >
            <option value="" disabled>Select a cause…</option>
            {DEAL_FALLOUT_REASONS.map((r) => (
              <option key={r} value={r}>{DEAL_FALLOUT_REASON_LABELS[r]}</option>
            ))}
          </select>
        </Field>
        <Field label="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Additional context…"
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:border-gray-400 focus:outline-none resize-none"
            maxLength={2000}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            Mark as Fell Out
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
