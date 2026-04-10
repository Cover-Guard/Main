import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Calendar } from 'lucide-react'
import { MarketingNav, MarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'CoverGuard for Home Buyers — Check Property Risk Before You Buy',
  description:
    'Before you make an offer, know what it will cost to insure the property. CoverGuard gives home buyers a 90-second multi-peril risk report and carrier availability check. Start free — 3 reports on us.',
}

const benefits = [
  'See flood, fire, wind, earthquake, and crime risk in one report',
  'Find out which insurance carriers are still writing in that ZIP code',
  'Estimate what homeowners insurance will actually cost — before closing',
  'Compare risk profiles across properties you&apos;re considering',
  'Catch uninsurable properties before you waste an offer on one',
  'Share your findings with your agent, lender, or family',
]

const faqs = [
  {
    q: 'Is it really free?',
    a: 'Yes. Every CoverGuard account comes with 3 free property reports — no credit card required. If you want more, Home Buyer Pro is $29/month.',
  },
  {
    q: 'How accurate is the data?',
    a: 'CoverGuard aggregates data from FEMA, USGS, NOAA, Cal Fire, FBI crime stats, and live carrier availability feeds — the same data professional underwriters use.',
  },
  {
    q: 'Do I need to be buying a home to use it?',
    a: 'No. Homeowners and renters use CoverGuard too — to audit their current coverage, prepare for a move, or understand risk in neighborhoods they&apos;re exploring.',
  },
  {
    q: 'Will this replace my insurance agent?',
    a: 'No — it makes you a better client. CoverGuard arms you with the risk data and carrier availability, so your agent can focus on finding the right policy, not explaining the basics.',
  },
]

export default function BuyersPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-brand-50/50 via-white to-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">Home Buyers</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Know what it costs to insure —
              <span className="text-brand-600"> before you make an offer</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              Insurance is now one of the biggest hidden costs of homeownership — and in some ZIP codes,
              you can&apos;t get it at all. CoverGuard gives you a 90-second multi-peril risk report and
              live carrier availability on any US address, so you go into every showing with your eyes open.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                See Pricing — Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Book a Walkthrough
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              3 free reports · No credit card required · Results in 90 seconds
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
                Buy your home with insurance intelligence on your side
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                The last thing you want is to find out — two weeks from closing — that the only
                carrier who will write the property is quoting 3x what you budgeted. CoverGuard
                surfaces that risk before you&apos;re under contract.
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
                  <p className="mt-2 text-gray-700">&quot;We were a week from closing when our insurance fell through. The only carrier writing the property wanted $6,200/year — way over our budget.&quot;</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">After CoverGuard</p>
                  <p className="mt-2 text-gray-700">&quot;We ran a CoverGuard report on every house we toured. It flagged the one in a fire zone before we even made an offer — we ended up in a home with real coverage options.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center">
            Common questions from home buyers
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-white border border-gray-200 p-6"
              >
                <h3 className="text-base font-semibold text-gray-900">{item.q}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Don&apos;t let insurance surprises derail your dream home
          </h2>
          <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
            Start with 3 free reports. No credit card. No commitment.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
            >
              See Pricing
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-transparent px-6 py-3 text-base font-semibold text-white hover:bg-brand-900 transition-colors"
            >
              <Calendar className="h-4 w-4" />
              Book a Walkthrough
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
