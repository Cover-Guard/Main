'use client'

import { useState, useEffect } from 'react'
import { Share2, Link2, Copy, Check, X, Mail } from 'lucide-react'
import { createSharedReport, getClients } from '@/lib/api'
import type { Client } from '@coverguard/shared'

interface Props {
  propertyId: string
  propertyAddress: string
  onClose: () => void
}

export function ShareReportModal({ propertyId, propertyAddress, onClose }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [includeRisk, setIncludeRisk] = useState(true)
  const [includeInsurance, setIncludeInsurance] = useState(true)
  const [includeCarriers, setIncludeCarriers] = useState(true)
  const [expiresInDays, setExpiresInDays] = useState<number>(30)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getClients().then(setClients).catch(() => {})
  }, [])

  // Auto-fill recipient from selected client
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId)
      if (client) {
        setRecipientEmail(client.email)
        setRecipientName(`${client.firstName} ${client.lastName}`)
      }
    }
  }, [selectedClientId, clients])

  async function handleShare() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createSharedReport({
        propertyId,
        clientId: selectedClientId || null,
        recipientEmail: recipientEmail || undefined,
        recipientName: recipientName || undefined,
        message: message || undefined,
        includeRisk,
        includeInsurance,
        includeCarriers,
        expiresInDays,
      })
      setShareUrl(result.shareUrl ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-900">Share Property Report</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Property */}
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-500">Property</p>
            <p className="text-sm font-medium text-gray-900 truncate">{propertyAddress}</p>
          </div>

          {shareUrl ? (
            /* Success state */
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-800">Share link created</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white rounded border border-green-200 px-3 py-1.5 text-xs text-gray-600 truncate font-mono">
                    {shareUrl}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Link expires in {expiresInDays} days. Share it via email, message, or any channel.
              </p>
            </div>
          ) : (
            /* Form */
            <>
              {/* Client selector */}
              {clients.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Send to Client</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select a client (optional)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} — {c.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Recipient Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Personal Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi! Here's the property report I mentioned..."
                  className="w-full min-h-[60px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  maxLength={1000}
                />
              </div>

              {/* Include sections */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Include Sections</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Risk Profile', value: includeRisk, set: setIncludeRisk },
                    { label: 'Insurance Estimate', value: includeInsurance, set: setIncludeInsurance },
                    { label: 'Active Carriers', value: includeCarriers, set: setIncludeCarriers },
                  ].map(({ label, value, set }) => (
                    <button
                      key={label}
                      onClick={() => set(!value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        value
                          ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Link Expires In</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleShare}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                <Link2 className="h-4 w-4" />
                {submitting ? 'Creating Link...' : 'Generate Share Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
