'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, Phone, Mail, Calendar, Eye, Send, RefreshCw, Tag, Plus, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getActivityLog, createActivityLogEntry, deleteActivityLogEntry, getClients } from '@/lib/api'
import type { PropertyActivityLogEntry, ActivityType, Client } from '@coverguard/shared'
import Link from 'next/link'

const ACTIVITY_ICONS: Record<ActivityType, typeof MessageSquare> = {
  NOTE: MessageSquare,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  VIEWING: Eye,
  QUOTE_SENT: Send,
  FOLLOW_UP: RefreshCw,
  STATUS_CHANGE: Tag,
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  NOTE: 'bg-gray-100 text-gray-600',
  CALL: 'bg-blue-100 text-blue-600',
  EMAIL: 'bg-purple-100 text-purple-600',
  MEETING: 'bg-green-100 text-green-600',
  VIEWING: 'bg-amber-100 text-amber-600',
  QUOTE_SENT: 'bg-teal-100 text-teal-600',
  FOLLOW_UP: 'bg-orange-100 text-orange-600',
  STATUS_CHANGE: 'bg-indigo-100 text-indigo-600',
}

const ACTIVITY_TYPES: ActivityType[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING', 'VIEWING', 'QUOTE_SENT', 'FOLLOW_UP', 'STATUS_CHANGE']

export function ActivityLogDashboard() {
  const [entries, setEntries] = useState<PropertyActivityLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterType, setFilterType] = useState<ActivityType | ''>('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [clients, setClients] = useState<Client[]>([])

  // Form state
  const [formType, setFormType] = useState<ActivityType>('NOTE')
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPropertyId, setFormPropertyId] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getActivityLog({
        activityType: filterType || undefined,
        page,
        limit: 15,
      })
      setEntries(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterType, page])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  useEffect(() => {
    getClients().then(setClients).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formTitle.trim() || !formPropertyId.trim()) return
    setSubmitting(true)
    try {
      const entry = await createActivityLogEntry({
        propertyId: formPropertyId,
        clientId: formClientId || undefined,
        activityType: formType,
        title: formTitle,
        description: formDesc || undefined,
      })
      setEntries((prev) => [entry, ...prev])
      setTotal((t) => t + 1)
      setShowForm(false)
      setFormTitle('')
      setFormDesc('')
      setFormPropertyId('')
      setFormClientId('')
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteActivityLogEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setTotal((t) => t - 1)
    } catch {
      // silent
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track all interactions and notes on properties</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Log Activity'}
        </button>
      </div>

      {/* New entry form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Activity Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as ActivityType)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
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
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Called homeowner about flood zone"
              required
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client (optional)</label>
              <select
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setFilterType(''); setPage(1) }}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            !filterType ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          )}
        >
          All ({total})
        </button>
        {ACTIVITY_TYPES.map((type) => {
          const Icon = ACTIVITY_ICONS[type]
          return (
            <button
              key={type}
              onClick={() => { setFilterType(filterType === type ? '' : type); setPage(1) }}
              className={cn(
                'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                filterType === type ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              <Icon className="h-3 w-3" />
              {type.replace(/_/g, ' ')}
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      <div className="relative">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <MessageSquare className="h-10 w-10 mb-2" />
            <p className="text-sm">No activity logged yet</p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Vertical timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 hidden md:block" />

            {entries.map((entry) => {
              const Icon = ACTIVITY_ICONS[entry.activityType] || MessageSquare
              const color = ACTIVITY_COLORS[entry.activityType] || 'bg-gray-100 text-gray-600'
              return (
                <div key={entry.id} className="relative flex gap-4 pb-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full z-10', color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 rounded-lg border border-gray-200 bg-white p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                        {entry.description && (
                          <p className="text-xs text-gray-500 mt-1">{entry.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', color)}>
                            {entry.activityType.replace(/_/g, ' ')}
                          </span>
                          {entry.property && (
                            <Link
                              href={`/properties/${entry.propertyId}`}
                              className="text-[10px] text-brand-600 hover:underline truncate max-w-[200px]"
                            >
                              {entry.property.address}, {entry.property.city}
                            </Link>
                          )}
                          {entry.client && (
                            <span className="text-[10px] text-gray-400">
                              Client: {entry.client.firstName} {entry.client.lastName}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
