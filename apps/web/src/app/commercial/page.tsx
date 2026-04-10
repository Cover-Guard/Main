import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'CoverGuard for CRE Brokers — Commercial Property Risk Intelligence',
  description:
    'Evaluate commercial property risk, environmental exposure, and carrier availability before investor due diligence. Built for CRE agents and brokers.',
}

const benefits = [
  'Assess multi-peril risk for any commercial property',
  'Check carrier availability for commercial lines by ZIP and property type',
  'Evaluate environmental and flood exposure before due diligence',
  'Share professional risk reports with investors and stakeholders',
  'Manage deal pipelines with built-in client management',
  'Works on any US commercial property — office, retail, industrial, multifamily',
]

export default function CommercialPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-brand-50/50 via-white to-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">For CRE Agents & Brokers</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              De-risk commercial deals
              <span className="text-brand-600"> before due diligence</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              Insurance gaps tank commercial deals just like residential ones — but the stakes are higher.
              CoverGuard gives CRE brokers a 90-second risk screen for any US commercial property, so you
              can flag issues before investors get cold feet.
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
                Insurance intelligence built for commercial deals
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Commercial properties face unique risk profiles — environmental exposure, higher replacement
                costs, and a shrinking carrier market. CoverGuard helps you identify these risks before
                they derail a transaction.
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
                  <p className="mt-2 text-gray-700">&quot;The buyer&apos;s lender flagged an uninsurable flood zone three weeks into due diligence. Six months of work — gone.&quot;</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">After CoverGuard</p>
                  <p className="mt-2 text-gray-700">&quot;We screened the property before listing. Knew the flood risk and carrier options upfront — the deal closed on schedule.&quot;</p>
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
            Stop losing commercial deals to insurance risk
          </h2>
          <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
            Join CRE brokers across the country using CoverGuard to screen commercial property risk before due diligence.
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
