'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getMyReports, generatePropertyReport, type PropertyReportRecord } from '@/lib/api'
import { formatAddress, formatCurrency } from '@coverguard/shared'
import {
  FileText,
  Search,
  MapPin,
  Calendar,
  DollarSign,
  ArrowRight,
  Shield,
  Clock,
  FileDown,
  Loader2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

async function downloadPdf(propertyId: string, reportId: string) {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`${API_URL}/api/properties/${propertyId}/report/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Download failed')

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `coverguard-report-${reportId}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ReportsContent() {
  const [reports, setReports] = useState<PropertyReportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [downloading, setDownloading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getMyReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = reports.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const p = r.property
    return (
      (p.address ?? '').toLowerCase().includes(q) ||
      (p.city ?? '').toLowerCase().includes(q) ||
      (p.state ?? '').toLowerCase().includes(q) ||
      (p.zip ?? '').toLowerCase().includes(q)
    )
  })

  async function handleDownload(report: PropertyReportRecord) {
    setDownloading((d) => ({ ...d, [report.id]: true }))
    setErrors((e) => ({ ...e, [report.id]: '' }))
    try {
      await downloadPdf(report.propertyId, report.id)
    } catch {
      setErrors((e) => ({ ...e, [report.id]: 'Download failed. Please try again.' }))
    } finally {
      setDownloading((d) => ({ ...d, [report.id]: false }))
    }
  }

  async function handleGenerate(propertyId: string) {
    setGenerating((g) => ({ ...g, [propertyId]: true }))
    setErrors((e) => ({ ...e, [propertyId]: '' }))
    try {
      const report = await generatePropertyReport(propertyId)
      setReports((prev) => [report, ...prev])
    } catch {
      setErrors((e) => ({ ...e, [propertyId]: 'Failed to generate report.' }))
    } finally {
      setGenerating((g) => ({ ...g, [propertyId]: false }))
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-6 w-6 text-gray-700" />
            <h1 className="text-2xl font-bold text-gray-900">Property Reports</h1>
          </div>
          <p className="text-sm text-gray-500">
            Download full PDF reports for your saved properties — risk, insurability, carriers, and cost estimates.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Search className="h-4 w-4" />
          New Check
        </Link>
      </div>

      {/* Search bar */}
      <div className="mb-5">
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-emerald-400 focus-within:border-emerald-400">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by address, city, or state…"
            className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-gray-400 mb-4">
          {filtered.length} of {reports.length} report{reports.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="h-14 w-14 text-gray-200 mb-4" />
          <p className="text-base font-semibold text-gray-500">No reports generated yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Open a property page and click &quot;Generate PDF Report&quot; to create your first report.
          </p>
          <Link
            href="/"
            className="mt-5 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <Search className="h-4 w-4" />
            Check a Property
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-400">No reports match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => {
            const p = report.property
            const isDownloading = downloading[report.id]
            const isGenerating = generating[report.propertyId]
            const errMsg = errors[report.id] || errors[report.propertyId]

            return (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{p.address}</h3>
                        <span className="shrink-0 text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {report.reportType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{formatAddress(p)}</p>

                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
                        {p.propertyType && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {p.propertyType.replace(/_/g, ' ')}
                          </span>
                        )}
                        {p.yearBuilt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            Built {p.yearBuilt}
                          </span>
                        )}
                        {p.estimatedValue && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                            Est. {formatCurrency(p.estimatedValue)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-gray-400" />
                          Generated {new Date(report.generatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {errMsg && (
                        <p className="text-xs text-red-600 mt-2">{errMsg}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleDownload(report)}
                        disabled={isDownloading}
                        className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Downloading…
                          </>
                        ) : (
                          <>
                            <FileDown className="h-3.5 w-3.5" />
                            Download PDF
                          </>
                        )}
                      </button>

                      <Link
                        href={`/properties/${p.id}`}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View property
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
