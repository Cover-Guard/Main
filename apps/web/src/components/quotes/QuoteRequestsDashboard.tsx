'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, Clock, CheckCircle, XCircle, Send, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getQuoteRequests, updateQuoteRequestStatus } from '@/lib/api'
import type { QuoteRequest, QuoteRequestStatus } from '@coverguard/shared'
import Link from 'next/link'

const STATUS_CONFIG: Record<QuoteRequestStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  SENT: { label: 'Sent', color: 'bg-blue-100 text-blue-800', icon: Send },
  RESPONDED: { label: 'Responded', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  DECLINED: { label: 'Declined', color: 'bg-red-100 text-red-800', icon: XCircle },
}

const STATUSES: QuoteRequestStatus[] = ['PENDING', 'SENT', 'RESPONDED', 'DECLINED']

export function QuoteRequestsDashboard() {
  const [requests, setRequests] = useState<QuoteRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filterStatus, setFilterStatus] = useState<QuoteRequestStatus | ''>('')
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getQuoteRequests({
        status: filterStatus || undefined,
        page,
        limit: 10,
      })
      setRequests(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterStatus, page])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  async function handleStatusChange(id: string, newStatus: QuoteRequestStatus) {
    try {
      const updated = await updateQuoteRequestStatus(id, newStatus)
      setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch {
      // silent
    }
  }

  const statusCounts = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Quote Requests</h1>
        <p className="text-sm text-gray-500 mt-1">Track and manage your binding quote requests across all properties</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUSES.map((status) => {
          const config = STATUS_CONFIG[status]
          const Icon = config.icon
          return (
            <button
              key={status}
              onClick={() => { setFilterStatus(filterStatus === status ? '' : status); setPage(1) }}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                filterStatus === status ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-gray-200 bg-white hover:border-gray-300',
              )}
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', config.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{statusCounts[status] || 0}</p>
                <p className="text-xs text-gray-500">{config.label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Request list */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {filterStatus ? STATUS_CONFIG[filterStatus].label : 'All'} Requests
            <span className="ml-2 text-gray-400 font-normal">({total})</span>
          </h2>
          {filterStatus && (
            <button onClick={() => { setFilterStatus(''); setPage(1) }} className="text-xs text-brand-600 hover:underline">
              Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <FileText className="h-10 w-10 mb-2" />
            <p className="text-sm">No quote requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((req) => {
              const config = STATUS_CONFIG[req.status]
              const Icon = config.icon
              return (
                <div key={req.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {req.carrierName || req.carrierId}
                      </p>
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', config.color)}>
                        {config.label}
                      </span>
                    </div>
                    {req.property && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {req.property.address}, {req.property.city}, {req.property.state}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-gray-300">|</span>
                      <span className="text-[10px] text-gray-400">
                        {req.coverageTypes.join(', ')}
                      </span>
                    </div>
                    {req.statusNote && (
                      <p className="text-xs text-gray-500 italic mt-1">{req.statusNote}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={req.status}
                      onChange={(e) => handleStatusChange(req.id, e.target.value as QuoteRequestStatus)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    {req.property && (
                      <Link href={`/properties/${req.propertyId}`} className="text-gray-400 hover:text-brand-600">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">
              Page {page} of {totalPages}
            </span>
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
    </div>
  )
}
