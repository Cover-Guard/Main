'use client'

import { useCallback, useRef, useState } from 'react'
import type { Property } from '@coverguard/shared'
import { downloadPropertyReportPdf } from '@/lib/api'
import {
  Share2, Link2, Mail, Printer, GitCompareArrows, Check, Download, Loader2,
} from 'lucide-react'

interface ReportActionsProps {
  property: Property
  fullAddress: string
  onPrint: () => void
  onCompare: () => void
  showCompare: boolean
}

export function ReportActions({
  property, fullAddress, onPrint, onCompare, showCompare,
}: ReportActionsProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  const handleDownload = useCallback(async () => {
    if (downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      const { blob, filename } = await downloadPropertyReportPdf(property.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed')
      setTimeout(() => setDownloadError(null), 4000)
    } finally {
      setDownloading(false)
    }
  }, [property.id, downloading])

  const reportUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/property/${property.id}/report`
      : ''

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard API may be blocked */ }
  }, [reportUrl])

  const handleEmail = useCallback(() => {
    const subject = encodeURIComponent(`Property Risk Report \u2014 ${fullAddress}`)
    const body = encodeURIComponent(
      `Here is the property risk report for ${fullAddress}:\n\n${reportUrl}`,
    )
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self')
    setShareOpen(false)
  }, [fullAddress, reportUrl])

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.relatedTarget)) {
        setShareOpen(false)
      }
    },
    [],
  )

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {/* Share */}
      <div ref={shareRef} className="relative" onBlur={handleBlur}>
        <button
          onClick={() => setShareOpen((v) => !v)}
          aria-expanded={shareOpen}
          aria-haspopup="menu"
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
          title="Share report"
        >
          <Share2 className="h-4 w-4" />
        </button>
        {shareOpen && (
          <div role="menu" className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20 animate-in fade-in slide-in-from-top-1">
            <button role="menuitem" onClick={handleCopyLink} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button role="menuitem" onClick={handleEmail} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition">
              <Mail className="h-4 w-4" />
              Email report
            </button>
          </div>
        )}
      </div>
      {/* Download PDF (server-rendered) */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        title={downloadError ?? 'Download PDF report'}
        aria-label="Download PDF report"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      </button>
      {/* Print (browser print dialog) */}
      <button
        onClick={onPrint}
        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
        title="Print report"
        aria-label="Print report"
      >
        <Printer className="h-4 w-4" />
      </button>
      {/* Compare */}
      <button
        onClick={onCompare}
        aria-pressed={showCompare}
        className={`p-2 rounded-lg transition ${showCompare ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
        title="Compare with another property"
      >
        <GitCompareArrows className="h-4 w-4" />
      </button>
    </div>
  )
}
