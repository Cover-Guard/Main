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
  'Get a full insurability assessment — not just hazard risk, but coverage availability',
  'See which carriers are actively writing in that ZIP code before you write the offer',
  'Catch flood, fire, seismic, wind & crime risks — and know if each risk is coverable',
  'Request a binding quote in the same platform',
  'Share a professional, branded Insurability Report PDF with your clients',
  'See a 1–10 insurability score on every property — back where Zillow stopped showing one',
  'Works on any US property — residential & commercial. All 50 states. Day one.',
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
              <span className="text-sm font-medium text-brand-700">Real Estate Agents</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              The insurance check your clients deserve —
              <span className="text-brand-600"> before they make an offer</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              CDI is filing enforcement against State Farm in CA. Florida rates are easing. Carrier appetite is reshuffling
              ZIP-by-ZIP every week. CoverGuard tells you &mdash; in 90 seconds &mdash; exactly who&rsquo;ll cover your client&rsquo;s next
              property, in all 50 states, before the offer goes in.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                See Agent Pricing
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
                  <p className="mt-2 text-gray-700">&quot;We&apos;re three days from closing and the buyer just found out State Farm won&apos;t write the property. Deal is dead.&quot;</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">After CoverGuard</p>
                  <p className="mt-2 text-gray-700">&quot;I ran the insurability check before we made the offer. Two carriers were writing — we went in knowing exactly what coverage would cost.&quot;</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Differentiator */}
      <section className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-6">
              <span className="text-sm font-medium text-brand-700">Property Insurability Intelligence</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Other tools score the hazard. We score the coverage risk.
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Most risk platforms stop at hazard scores — flood zone, fire severity, seismic exposure.
              CoverGuard goes further: every risk assessment includes an <strong>insurability verdict</strong> that
              answers the question your client needs answered before making an offer. It&apos;s not just
              &quot;is this property in a high-risk zone&quot; — it&apos;s &quot;can this property actually be covered?&quot;
            </p>
            <p className="mt-4 text-lg text-gray-600">
              When you run a CoverGuard check, you see which carriers are actively binding in that ZIP
              code, whether adequate coverage is available at all, and what a realistic premium looks like.
              That&apos;s the difference between a risk score and insurability intelligence — and it&apos;s the
              information that protects your deal before you&apos;re too deep to walk away.
            </p>
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
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
            >
              See Agent Pricing
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
