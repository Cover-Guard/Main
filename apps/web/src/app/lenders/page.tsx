import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'CoverGuard for Lenders — Verify Insurability Before Loan Commitment',
  description:
    'Eliminate last-minute closing delays caused by uninsurable properties. CoverGuard gives mortgage lenders instant insurability verification for any US property.',
}

const benefits = [
  'Verify insurability before issuing loan commitment',
  'Identify flood zone, SFHA status, and BFE instantly',
  'See which carriers are writing in the property ZIP code',
  'Get insurance cost estimates for underwriting decisions',
  'Flag high-risk properties that could delay or kill closings',
  'Integrate via API for automated screening in your LOS',
]

export default function LendersPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-brand-50/50 via-white to-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">For Mortgage Lenders</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Verify insurability
              <span className="text-brand-600"> before loan commitment</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              Insurance is now the #1 reason closings get delayed. Carriers are pulling out of entire
              states, leaving borrowers scrambling for coverage at the last minute. CoverGuard flags
              these risks before you commit capital.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                Check a Property Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Book a Demo
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Free to start · No credit card required · Results in 90 seconds
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Close faster by catching insurance problems early
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                When a borrower can&apos;t get adequate insurance, your closing stalls — or dies.
                CoverGuard lets loan officers verify property insurability in 90 seconds, well before
                commitment, so you can underwrite with confidence.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-50 rounded-3xl p-8 border border-brand-100">
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">Before CoverGuard</p>
                  <p className="mt-2 text-gray-700">&quot;We were a week from closing when the borrower found out no carrier would write the property. Had to push the close date twice.&quot;</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">After CoverGuard</p>
                  <p className="mt-2 text-gray-700">&quot;We now run a CoverGuard check at application. If there&apos;s a carrier gap, we flag it before the borrower even picks a rate.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Stop losing closings to insurance surprises
          </h2>
          <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
            Join lenders using CoverGuard to verify insurability at application — not at closing.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
            >
              Check a Property Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
