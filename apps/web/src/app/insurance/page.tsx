import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'CoverGuard for Insurance Brokers — Risk Intelligence at Scale',
  description:
    'Pre-qualify leads, screen books of business, and integrate multi-peril risk data into your placement workflow. Built for independent insurance brokers and agencies.',
}

const benefits = [
  'Pre-qualify inbound leads with instant multi-peril risk profiles — including an insurability verdict',
  'See in seconds whether a submission is writeable before you spend time shopping it',
  'See real-time carrier availability by ZIP and risk tier',
  'Screen books of business for aggregate coverage-risk exposure across geographies',
  'Generate white-label insurability reports for client communications',
  'Access FEMA, USGS, NOAA, Cal Fire, and FBI data — with insurability context — in one platform',
]

export default function InsurancePage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-brand-50/50 via-white to-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">Insurance Brokers</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Place more policies with
              <span className="text-brand-600"> real-time risk intelligence</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              As carriers exit markets and rates climb, brokers need better property-level data before
              they shop a submission. CoverGuard gives you instant multi-peril risk profiles and live
              carrier availability so you know where to place the risk — before you pick up the phone.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                See Broker Pricing
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
              Transparent pricing · Free trial available · Results in 90 seconds
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
                From lead qualification to book-level screening — one platform
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Whether you&apos;re an independent broker pre-qualifying homeowner leads or an agency
                screening a book of commercial risks, CoverGuard gives you the multi-peril data you
                need to place business faster and smarter.
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
                  <p className="mt-2 text-gray-700">&quot;We were spending 20 minutes per submission pulling data from five different sources just to know who would even look at it.&quot;</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">After CoverGuard</p>
                  <p className="mt-2 text-gray-700">&quot;CoverGuard gives us a complete risk profile in 90 seconds. We pre-qualify leads instantly and only shop submissions to carriers who will write them.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Built for every part of your broker workflow
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Pre-Bind Risk Screen',
                body: 'Run a 90-second insurability assessment the moment a lead comes in — flood, fire, wind, seismic, and crime risk, plus a verdict on whether the property is likely coverable in the current market.',
              },
              {
                title: 'Carrier Matchmaking',
                body: 'See which carriers are actively binding in that ZIP code and risk tier — so every submission lands with a carrier who will write it.',
              },
              {
                title: 'Book Monitoring',
                body: 'Screen your existing book for aggregate coverage-risk exposure by peril and geography. Catch markets that are tightening before renewals catch you off guard.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl bg-white border border-gray-200 p-6 hover:border-brand-200 hover:shadow-md transition-all duration-300"
              >
                <h3 className="text-lg font-semibold text-gray-900">{card.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiator */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-6">
              <span className="text-sm font-medium text-brand-700">Property Insurability Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Risk scores tell you the peril. Insurability intelligence tells you if it&apos;s placeable.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              You already understand flood zones and fire severity. What you need to know faster is
              whether a property with a high-risk profile has any viable market — and if so, which
              carriers are still writing it. That&apos;s the gap CoverGuard closes.
            </p>
            <p className="mt-4 text-lg text-gray-600">
              Every CoverGuard risk assessment includes an <strong>insurability dimension</strong>:
              a property-level verdict on coverage availability based on current carrier activity,
              risk tier, and ZIP-level market conditions. You get the hazard data you need for
              underwriting — and the market intelligence you need to place it.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Better risk data. Faster placement. Fewer surprises.
          </h2>
          <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
            Join insurance brokers using CoverGuard to screen submissions and place business smarter.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
            >
              See Broker Pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-transparent px-6 py-3 text-base font-semibold text-white hover:bg-brand-900 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
