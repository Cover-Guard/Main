import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'CoverGuard for Real Estate Agents — Check Insurability Before the Offer',
  description:
    'Stop losing deals to insurance surprises. CoverGuard gives real estate agents a 90-second insurability check for any US property — before your client makes an offer.',
}

const benefits = [
  'Run a full risk check before showing any listing',
  'See which carriers are still writing in that ZIP code',
  'Catch flood, fire, seismic, wind & crime risks upfront',
  'Request a binding quote in the same platform',
  'Share a professional risk report with your clients',
  'Works on any US property — residential & commercial',
]

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-brand-50/50 via-white to-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">For Real Estate Agents</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              The insurance check your clients deserve —
              <span className="text-brand-600"> before they make an offer</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              With State Farm, Allstate, and Farmers exiting major markets, insurance is now the #1 reason
              deals fall through at closing. CoverGuard surfaces those risks before your client is under contract.
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
                Win more deals by knowing more, sooner
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Insurance surprises kill deals. CoverGuard puts the insurability intelligence
                in your hands before you write the offer — so you can close with confidence.
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
                  <p className="mt-2 text-gray-700">"We're three days from closing and the buyer just found out State Farm won't write the property. Deal is dead."</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">After CoverGuard</p>
                  <p className="mt-2 text-gray-700">"I ran the insurability check before we made the offer. Two carriers were writing — we went in knowing exactly what coverage would cost."</p>
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
            Start protecting your deals today
          </h2>
          <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
            Join 500+ agents already running pre-offer insurability checks across 38 states.
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
