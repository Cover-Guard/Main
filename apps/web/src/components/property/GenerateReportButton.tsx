'use client'

import { useState } from 'react'
import { FileDown, Loader2, CheckCircle } from 'lucide-react'
import { generatePropertyReport } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

interface GenerateReportButtonProps {
  propertyId: string
}

export function GenerateReportButton({ propertyId }: GenerateReportButtonProps) {
  const [state, setState] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [reportId, setReportId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setState('generating')
    setError('')
    try {
      const report = await generatePropertyReport(propertyId)
      setReportId(report.id)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
      setState('error')
    }
  }

  async function handleDownload() {
    // Fetch the PDF with auth token, then trigger browser download
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    const res = await fetch(`${API_URL}/api/properties/${propertyId}/report/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!res.ok) {
      setError('Download failed. Please try again.')
      return
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coverguard-report-${propertyId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (state === 'done' || reportId) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">Report ready</span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          Download PDF
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleGenerate}
        disabled={state === 'generating'}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === 'generating' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            Generate PDF Report
          </>
        )}
      </button>
      {state === 'error' && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
