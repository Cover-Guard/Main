'use client'

import { useState } from 'react'
import type { Carrier, CoverageType } from '@coverguard/shared'
import { X, Send, CheckCircle } from 'lucide-react'
import { requestBindingQuote } from '@/lib/api'

interface QuoteRequestModalProps {
  carrier: Carrier
  propertyId: string
  propertyAddress: string
  onClose: () => void
}

export function QuoteRequestModal({ carrier, propertyId, propertyAddress, onClose }: QuoteRequestModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [coverageTypes, setCoverageTypes] = useState<CoverageType[]>(
    carrier.coverageTypes.length > 0 ? [carrier.coverageTypes[0]!] : []
  )
  const [notes, setNotes] = useState('')

  function toggleCoverage(type: CoverageType) {
    setCoverageTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (coverageTypes.length === 0) {
      setError('Select at least one coverage type')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await requestBindingQuote(propertyId, carrier.id, coverageTypes, notes)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="font-bold text-gray-900">Request Binding Quote</h2>
            <p className="text-xs text-gray-500">{carrier.name} · {propertyAddress}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'success' ? (
          <div className="px-6 py-12 text-center">
            <CheckCircle className="mx-auto mb-3 h-14 w-14 text-green-500" />
            <h3 className="text-lg font-bold text-gray-900">Quote Request Submitted</h3>
            <p className="mt-2 text-sm text-gray-500">
              Your binding quote request has been sent to <strong>{carrier.name}</strong>.
              A licensed agent will contact you within 1–2 business days.
            </p>
            <button onClick={onClose} className="btn-primary mt-6 px-8 py-2.5">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Carrier info */}
            <div className="rounded-lg bg-brand-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-brand-900">{carrier.name}</p>
                  <p className="text-xs text-brand-600">AM Best: {carrier.amBestRating}</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  Actively Writing
                </span>
              </div>
            </div>

            {/* Coverage types */}
            <div>
              <label className="label mb-2">Coverage Types Requested</label>
              <div className="flex flex-wrap gap-2">
                {carrier.coverageTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleCoverage(type)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      coverageTypes.includes(type)
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400'
                    }`}
                  >
                    {formatCoverageType(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Additional Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any specific coverage requirements, questions, or context for the underwriter..."
                className="input mt-1 resize-none"
              />
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400">
              By submitting, you authorize CoverGuard to share your property information and contact details with{' '}
              {carrier.name} for the purpose of obtaining an insurance quote. This is not a binding contract.
            </p>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || coverageTypes.length === 0}
                className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Submitting…' : 'Request Binding Quote'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function formatCoverageType(type: string): string {
  return ({
    HOMEOWNERS:    'Homeowners',
    FLOOD:         'Flood',
    EARTHQUAKE:    'Earthquake',
    WIND_HURRICANE: 'Wind/Hurricane',
    UMBRELLA:      'Umbrella',
    FIRE:          'Fire',
  } as Record<string, string>)[type] ?? type
}
