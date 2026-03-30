'use client'

import { useState, useEffect } from 'react'
import { X, Share2, Copy, CheckCircle, Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSharedLink, getClients } from '@/lib/api'
import type { Client } from '@coverguard/shared'

interface SharePropertyModalProps {
  propertyId: string
  propertyAddress: string
  onClose: () => void
}

const EXPIRY_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
]

export function SharePropertyModal({ propertyId, propertyAddress, onClose }: SharePropertyModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  // Form state
  const [includeRisk, setIncludeRisk] = useState(true)
  const [includeInsurance, setIncludeInsurance] = useState(true)
  const [includeCarriers, setIncludeCarriers] = useState(true)
  const [expiresInDays, setExpiresInDays] = useState(30)
  const [maxViews, setMaxViews] = useState<string>('')
  const [clientId, setClientId] = useState<string>('')
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    getClients()
      .then(setClients)
      .catch(() => {
        // Non-critical — client picker just won't be populated
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await createSharedLink({
        propertyId,
        includeRisk,
        includeInsurance,
        includeCarriers,
        expiresInDays,
        ...(clientId ? { clientId } : {}),
        ...(maxViews ? { maxViews: parseInt(maxViews, 10) } : {}),
      })
      setShareUrl(result.shareUrl)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the input
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 id="share-modal-title" className="font-bold text-gray-900">Share Property</h2>
            <p className="text-xs text-gray-500">{propertyAddress}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'success' ? (
          <div className="px-6 py-8">
            <div className="text-center mb-6">
              <CheckCircle className="mx-auto mb-3 h-14 w-14 text-green-500" />
              <h3 className="text-lg font-bold text-gray-900">Link Created</h3>
              <p className="mt-1 text-sm text-gray-500">
                Share this link with your client to give them access to the property report.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 truncate bg-transparent text-sm text-gray-700 outline-none"
              />
              <button
                onClick={handleCopy}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-brand-600 text-white hover:bg-brand-700',
                )}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Link
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              This link expires in {expiresInDays} days
              {maxViews ? ` or after ${maxViews} views` : ''}.
              You can deactivate it anytime from your dashboard.
            </div>

            <button onClick={onClose} className="btn-primary mt-6 w-full py-2.5">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Data toggles */}
            <div>
              <label className="label mb-2">Include in shared view</label>
              <div className="space-y-2">
                {[
                  { label: 'Risk Assessment', checked: includeRisk, onChange: setIncludeRisk },
                  { label: 'Insurance Estimate', checked: includeInsurance, onChange: setIncludeInsurance },
                  { label: 'Active Carriers', checked: includeCarriers, onChange: setIncludeCarriers },
                ].map((toggle) => (
                  <label key={toggle.label} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={toggle.checked}
                      onChange={(e) => toggle.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <span className="text-sm text-gray-700">{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Expiration */}
            <div>
              <label className="label">Link expiration</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                className="input mt-1 w-full"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Max views */}
            <div>
              <label className="label">Maximum views (optional)</label>
              <input
                type="number"
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                placeholder="Unlimited"
                min={1}
                max={1000}
                className="input mt-1 w-full"
              />
            </div>

            {/* Client selector */}
            {clients.length > 0 && (
              <div>
                <label className="label">Send to client (optional)</label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="input mt-1 w-full"
                >
                  <option value="">No specific client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {loading ? 'Creating...' : 'Create Share Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
