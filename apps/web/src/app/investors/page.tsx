import type { Metadata } from 'next'
import { Shield, TrendingUp, Users, MapPin, BarChart3, Mail, ArrowRight, CheckCircle2 } from 'lucide-react'
import { FooterPagesNav, MarketingNav, MarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Investors — CoverGuard',
  description: 'Learn about CoverGuard\'s mission to transform property insurability intelligence. Request our pitch deck and business plan.',
}

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <MarketingNav />
      <FooterPagesNav />
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
          <div className="mb-8 flex items-center gap-2">
            <Shield className="h-8 w-8" />
            <span className="text-2xl font-bold">CoverGuard</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            The Future of Property<br />Insurability Intelligence
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-blue-100">
            CoverGuard empowers home buyers, real estate agents, and lenders to instantly
            understand property risk, carrier availability, and insurance costs &mdash; before
            placing a bid.
          </p>
          <a
            href="#contact"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-blue-50"
          >
            Request Pitch Deck <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Problem & Opportunity */}
      <div className="mx-auto max-w-5xl px-4 py-16 md:py-20">
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">The Problem</h2>
        <p className="mt-4 max-w-3xl text-gray-600">
          Every year, thousands of real estate transactions are delayed, renegotiated, or fall
          through because buyers and agents discover insurance challenges too late in the
          process. Rising climate risk, carrier pullbacks, and shifting regulations have made
          property insurability one of the most critical &mdash; yet least understood &mdash;
          factors in real estate.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="card p-6">
            <TrendingUp className="h-8 w-8 text-brand-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">$150B+ Market</h3>
            <p className="mt-2 text-sm text-gray-600">
              U.S. homeowners insurance premiums continue to surge, creating urgent demand for
              transparency and pre-purchase risk intelligence.
            </p>
          </div>
          <div className="card p-6">
            <MapPin className="h-8 w-8 text-brand-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Nationwide Coverage</h3>
            <p className="mt-2 text-sm text-gray-600">
              Integrating FEMA flood zones, wildfire severity, seismic data, wind speed, and
              crime data for any U.S. address &mdash; all in one platform.
            </p>
          </div>
          <div className="card p-6">
            <Users className="h-8 w-8 text-brand-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">Multi-Sided Platform</h3>
            <p className="mt-2 text-sm text-gray-600">
              Serving agents, buyers, and lenders with role-specific portals, client management,
              and carrier-direct quote requests.
            </p>
          </div>
        </div>
      </div>

      {/* What We Do */}
      <div className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 md:py-20">
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">What CoverGuard Delivers</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              'Instant multi-peril risk profiles (flood, fire, earthquake, wind, crime)',
              'Real-time carrier availability — who is actively writing policies by state and risk',
              'Insurance cost estimates before an offer is placed',
              'Side-by-side property comparison for risk and insurability',
              'Binding quote requests sent directly to active carriers',
              'Agent dashboard with client management and analytics',
              'Property reports for due diligence and disclosure',
              'Built on authoritative public data (FEMA, USGS, Cal Fire, NOAA, FBI)',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Placeholder */}
      <div className="mx-auto max-w-5xl px-4 py-16 md:py-20">
        <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">Why Now</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            { label: 'Carrier Exits', value: '12+', note: 'Major insurers have pulled out of high-risk states since 2023' },
            { label: 'Premium Growth', value: '30%+', note: 'Average homeowner premium increase in climate-exposed regions' },
            { label: 'Transactions at Risk', value: '1 in 5', note: 'Home sales impacted by insurance availability issues' },
            { label: 'Data Sources', value: '8+', note: 'Federal & state risk databases integrated into CoverGuard' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-brand-700">{stat.value}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{stat.label}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact / CTA */}
      <div id="contact" className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
        <div className="mx-auto max-w-3xl px-4 py-16 md:py-20 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-blue-200" />
          <h2 className="mt-6 text-2xl font-bold md:text-3xl">Interested in Learning More?</h2>
          <p className="mt-4 text-blue-100">
            We&rsquo;d love to share our pitch deck and business plan with you.
            Reach out to our investor relations team and we&rsquo;ll be in touch.
          </p>
          <a
            href="mailto:investor@coverguard.io"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-base font-semibold text-brand-700 shadow-lg transition hover:bg-blue-50"
          >
            <Mail className="h-5 w-5" />
            investor@coverguard.io
          </a>
          <p className="mt-6 text-sm text-blue-200">
            Request our pitch deck, business plan, or schedule a call with our team.
          </p>
        </div>
      </div>

      <MarketingFooter />
    </div>
  )
}
