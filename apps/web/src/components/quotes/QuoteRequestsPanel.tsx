'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FileText, Clock, CheckCircle, XCircle, Send, ArrowRight } from 'lucide-react'
import { getMyQuoteRequests } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { QuoteRequestDetail, QuoteRequestStatus } from '@coverguard/shared'

const STATUS_CONFIG: Record<QuoteRequestStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700',  icon: Clock },
  SENT:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700',    icon: Send },
  RESPONDED: { label: 'Responded', color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  DECLINED:  { label: 'Declined',  color: 'bg-red-100 text-red-700',      icon: XCircle },
}

const TABS: Array<{ key: string; label: string }> = [
  { key: 'ALL',       label: 'All' },
  { key: 'PENDING',   label: 'Pending' },
  { key: 'SENT',      label: 'Sent' },
  { key: 'RESPONDED', label: 'Responded' },
  { key: 'DECLINED',  label: 'Declined' },
]

export function QuoteRequestsPanel() {
  const [requests, setRequests] = useState<QuoteRequestDetail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const limit = 20

  const fetchRequests = useCallback(async (p: number, status?: string) => {
    setLoading(true)
    try {
      const data = await getMyQuoteRequests(p, limit, status === 'ALL' ? undefined : status)
      setRequests(data.requests)
      setTotal(data.total)
    } catch {
      setRequests([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch counts for each tab on mount
  useEffect(() => {
    async function loadCounts() {
      try {
        const [all, pending, sent, responded, declined] = await Promise.all([
          getMyQuoteRequests(1, 1),
          getMyQuoteRequests(1, 1, 'PENDING'),
          getMyQuoteRequests(1, 1, 'SENT'),
          getMyQuoteRequests(1, 1, 'RESPONDED'),
          getMyQuoteRequests(1, 1, 'DECLINED'),
        ])
        setCounts({
          ALL: all.total,
          PENDING: pending.total,
          SENT: sent.total,
          RESPONDED: responded.total,
          DECLINED: declined.total,
        })
      } catch {
        // Counts unavailable — leave empty
      }
    }
    loadCounts()
  }, [])

  useEffect(() => {
    fetchRequests(page, activeTab)
  }, [page, activeTab, fetchRequests])

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-brand-600" />
          Quote Requests
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage your binding quote requests across all properties.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
              activeTab === key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            )}
          >
            {label}
            {counts[key] !== undefined && (
              <span className="ml-1.5 text-[10px] opacity-80">({counts[key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/3 rounded bg-gray-100" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-6 w-16 rounded-full bg-gray-100" />
                    <div className="h-6 w-16 rounded-full bg-gray-100" />
                  </div>
                </div>
                <div className="h-6 w-20 rounded-full bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && requests.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-900">No quote requests yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Request a binding quote from a property&apos;s carrier page.
          </p>
          <Link
            href="/search"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Search properties
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Request cards */}
      {!loading && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((req) => {
            const config = STATUS_CONFIG[req.status]
            const StatusIcon = config.icon
            const address = req.property
              ? `${req.property.address}, ${req.property.city}, ${req.property.state} ${req.property.zip}`
              : 'Unknown property'

            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Property address */}
                    <Link
                      href={`/properties/${req.propertyId}`}
                      className="text-sm font-semibold text-gray-900 hover:text-brand-600 transition-colors"
                    >
                      {address}
                    </Link>

                    {/* Carrier */}
                    <p className="mt-1 text-xs text-gray-500">
                      Carrier: {req.carrierId}
                    </p>

                    {/* Coverage type badges */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {req.coverageTypes.map((type) => (
                        <span
                          key={type}
                          className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
                        >
                          {type}
                        </span>
                      ))}
                    </div>

                    {/* Notes (truncated) */}
                    {req.notes && (
                      <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                        {req.notes}
                      </p>
                    )}

                    {/* Submission date */}
                    <p className="mt-2 text-[11px] text-gray-400">
                      Submitted {new Date(req.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shrink-0', config.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}--{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
