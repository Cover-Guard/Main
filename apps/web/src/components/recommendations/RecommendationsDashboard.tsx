'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Star, Plus, X, ChevronRight, Trash2, AlertTriangle, ArrowUp, ArrowDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getRecommendations,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  getClients,
} from '@/lib/api'
import type {
  ClientPropertyRecommendation,
  RecommendationPriority,
  RecommendationStatus,
  Client,
} from '@coverguard/shared'
import Link from 'next/link'

const PRIORITY_CONFIG: Record<RecommendationPriority, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-600' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-700' },
}

const STATUS_CONFIG: Record<RecommendationStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  VIEWED: { label: 'Viewed', color: 'bg-blue-100 text-blue-700' },
  INTERESTED: { label: 'Interested', color: 'bg-green-100 text-green-700' },
  NOT_INTERESTED: { label: 'Not Interested', color: 'bg-gray-100 text-gray-600' },
  QUOTE_REQUESTED: { label: 'Quote Requested', color: 'bg-teal-100 text-teal-700' },
}

const STATUS_OPTIONS: RecommendationStatus[] = ['PENDING', 'VIEWED', 'INTERESTED', 'NOT_INTERESTED', 'QUOTE_REQUESTED']
const PRIORITY_OPTIONS: RecommendationPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function RecommendationsDashboard() {
  const [recs, setRecs] = useState<ClientPropertyRecommendation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterClient, setFilterClient] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formPropertyId, setFormPropertyId] = useState('')
  const [formPriority, setFormPriority] = useState<RecommendationPriority>('MEDIUM')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchRecs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getRecommendations({
        clientId: filterClient || undefined,
        page,
        limit: 15,
      })
      setRecs(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterClient, page])

  useEffect(() => { fetchRecs() }, [fetchRecs])
  useEffect(() => { getClients().then(setClients).catch(() => {}) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formClientId || !formPropertyId) return
    setSubmitting(true)
    try {
      const rec = await createRecommendation({
        clientId: formClientId,
        propertyId: formPropertyId,
        priority: formPriority,
        notes: formNotes || undefined,
      })
      setRecs((prev) => [rec, ...prev])
      setTotal((t) => t + 1)
      setShowForm(false)
      setFormPropertyId('')
      setFormNotes('')
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(id: string, status: RecommendationStatus) {
    try {
      const updated = await updateRecommendation(id, { status })
      setRecs((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch {
      // silent
    }
  }

  async function handlePriorityChange(id: string, priority: RecommendationPriority) {
    try {
      const updated = await updateRecommendation(id, { priority })
      setRecs((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch {
      // silent
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRecommendation(id)
      setRecs((prev) => prev.filter((r) => r.id !== id))
      setTotal((t) => t - 1)
    } catch {
      // silent
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Property Recommendations</h1>
          <p className="text-sm text-gray-500 mt-1">Recommend properties to your clients and track their interest</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Recommend'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
              <select
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Property ID</label>
              <input
                type="text"
                value={formPropertyId}
                onChange={(e) => setFormPropertyId(e.target.value)}
                placeholder="Property ID"
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as RecommendationPriority)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Why this property?"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving...' : 'Create Recommendation'}
          </button>
        </form>
      )}

      {/* Client filter */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-gray-500">Filter by client:</label>
        <select
          value={filterClient}
          onChange={(e) => { setFilterClient(e.target.value); setPage(1) }}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{total} recommendations</span>
      </div>

      {/* Recommendations list */}
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          </div>
        ) : recs.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <Star className="h-10 w-10 mb-2" />
            <p className="text-sm">No recommendations yet</p>
          </div>
        ) : (
          recs.map((rec) => {
            const priorityConfig = PRIORITY_CONFIG[rec.priority]
            const statusConfig = STATUS_CONFIG[rec.status]
            return (
              <div key={rec.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', priorityConfig.color)}>
                  {rec.priority === 'URGENT' ? <AlertTriangle className="h-4 w-4" /> :
                   rec.priority === 'HIGH' ? <ArrowUp className="h-4 w-4" /> :
                   rec.priority === 'LOW' ? <ArrowDown className="h-4 w-4" /> :
                   <Star className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {rec.property && (
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {rec.property.address}, {rec.property.city}, {rec.property.state}
                      </p>
                    )}
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', priorityConfig.color)}>
                      {priorityConfig.label}
                    </span>
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {rec.client && (
                      <span className="text-xs text-gray-500">
                        For: {rec.client.firstName} {rec.client.lastName}
                      </span>
                    )}
                    {rec.notes && (
                      <>
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs text-gray-500 truncate">{rec.notes}</span>
                      </>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                      {new Date(rec.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={rec.status}
                    onChange={(e) => handleStatusChange(rec.id, e.target.value as RecommendationStatus)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                  <select
                    value={rec.priority}
                    onChange={(e) => handlePriorityChange(rec.id, e.target.value as RecommendationPriority)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                    ))}
                  </select>
                  <button onClick={() => handleDelete(rec.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {rec.property && (
                    <Link href={`/properties/${rec.propertyId}`} className="text-gray-400 hover:text-brand-600">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40">Previous</button>
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
