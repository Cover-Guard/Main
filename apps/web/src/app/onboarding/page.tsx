'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, CheckCircle, FileText, Lock, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    if (!accepted) return
    setLoading(true)
    setError(null)

    try {
      // Update Supabase user metadata with termsAcceptedAt
      const supabase = createClient()
      const { error: metaError } = await supabase.auth.updateUser({
        data: { termsAcceptedAt: new Date().toISOString() },
      })
      if (metaError) throw metaError

      // Update profile in API
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch('/api/auth/me/terms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        })
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 text-brand-700">
          <Shield className="h-9 w-9" />
          <span className="text-3xl font-bold">CoverGuard</span>
        </div>

        <div className="card overflow-hidden">
          {/* Header */}
          <div className="bg-brand-800 px-8 py-6 text-white">
            <h1 className="text-xl font-bold">Before you begin — a few important disclosures</h1>
            <p className="mt-1 text-sm text-brand-200">
              CoverGuard provides property risk intelligence and insurance cost estimates to help you make informed decisions.
              Please review these terms before continuing.
            </p>
          </div>

          {/* Disclosures */}
          <div className="space-y-5 p-8">
            <DisclosureItem
              icon={<AlertTriangle className="h-5 w-5 text-yellow-600" />}
              bg="bg-yellow-50"
              title="Not a Binding Insurance Quote"
              body="All premium estimates provided by CoverGuard are informational only and do not constitute a binding insurance offer, commitment, or contract. Actual premiums are determined by licensed insurers based on full underwriting review. You should not rely solely on CoverGuard estimates when making purchasing decisions."
            />
            <DisclosureItem
              icon={<FileText className="h-5 w-5 text-blue-600" />}
              bg="bg-blue-50"
              title="Data Accuracy &amp; Limitations"
              body="Risk scores are derived from publicly available datasets (FEMA, USGS, Cal Fire, FBI UCR) and third-party data providers. While we make reasonable efforts to ensure accuracy, data may be incomplete, outdated, or inaccurate for some locations. CoverGuard does not guarantee the accuracy, completeness, or timeliness of any risk assessment. All data should be independently verified before making decisions."
            />
            <DisclosureItem
              icon={<Lock className="h-5 w-5 text-green-600" />}
              bg="bg-green-50"
              title="Not Financial or Legal Advice"
              body="Nothing on CoverGuard constitutes financial, legal, or insurance advice. You should consult a licensed insurance professional and conduct your own due diligence before making any real estate or insurance decision. CoverGuard is not a licensed insurance agent, broker, or carrier."
            />
            <DisclosureItem
              icon={<CheckCircle className="h-5 w-5 text-brand-600" />}
              bg="bg-brand-50"
              title="Carrier Availability"
              body="Carrier writing status reflects market intelligence sourced from public filings and industry data. Active writing status does not guarantee a carrier will offer coverage for a specific property. Always verify availability directly with the carrier or your broker."
            />

            {/* Full terms link */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              By continuing, you agree to CoverGuard&apos;s{' '}
              <a href="/terms" target="_blank" className="text-brand-600 underline hover:text-brand-700">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" className="text-brand-600 underline hover:text-brand-700">Privacy Policy</a>
              . Your data is encrypted in transit and at rest, and is never sold to third parties. We maintain
              comprehensive security controls to protect the confidentiality, integrity, and availability of your information.
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* Accept checkbox */}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-5 w-5 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm font-medium text-gray-800">
                I have read and understand these disclosures, and I agree to the Terms of Service and Privacy Policy.
              </span>
            </label>

            <button
              onClick={handleAccept}
              disabled={!accepted || loading}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? 'Saving…' : 'Accept & Continue to CoverGuard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DisclosureItem({
  icon,
  bg,
  title,
  body,
}: {
  icon: React.ReactNode
  bg: string
  title: string
  body: string
}) {
  return (
    <div className={`flex gap-4 rounded-lg p-4 ${bg}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: title }} />
        <p className="mt-1 text-sm text-gray-600">{body}</p>
      </div>
    </div>
  )
}
