import Link from 'next/link'
import { MarketingNav, MarketingFooter } from '@/components/marketing'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — CoverGuard',
  description:
    'Simple, transparent pricing for individuals and teams. Start free, upgrade when you need more.',
}

const plans = [
  {
    name: 'Individual',
    description: 'For home buyers and independent agents getting started.',
    price: '$29',
    period: '/month',
    cta: 'Get Started',
    ctaHref: '/register',
    highlighted: false,
    features: [
      '10 property searches per month',
      'Risk profiles (flood, fire, wind, earthquake, crime)',
      'Carrier availability lookup',
      'Save up to 10 properties',
      'Email support',
    ],
  },
  {
    name: 'Professional',
    description: 'For active agents managing multiple clients and properties.',
    price: '$79',
    period: '/month',
    cta: 'Get Started',
    ctaHref: '/register',
    highlighted: true,
    features: [
      '100 property searches per month',
      'Everything in Individual',
      'Binding quote requests',
      'Client management dashboard',
      'Side-by-side property comparison',
      'Analytics & search history',
      'Priority support',
    ],
  },
  {
    name: 'Team',
    description: 'For brokerages and teams that need scale and collaboration.',
    price: '$199',
    period: '/month',
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@coverguard.io',
    highlighted: false,
    features: [
      'Unlimited property searches',
      'Everything in Professional',
      'Up to 10 team members',
      'Shared client & property lists',
      'Team analytics & reporting',
      'API access',
      'Dedicated account manager',
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main className="pt-16">
        <section className="py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
                Pricing
              </p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900">
                Simple, transparent pricing
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                Start with a free trial. No credit card required. Upgrade anytime as your needs grow.
              </p>
            </div>

            {/* Pricing cards */}
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border p-8 flex flex-col ${
                    plan.highlighted
                      ? 'border-brand-600 shadow-lg ring-1 ring-brand-600'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-2 text-sm text-gray-600">{plan.description}</p>

                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>

                  <Link
                    href={plan.ctaHref}
                    className={`mt-8 block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                      plan.highlighted
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {plan.cta}
                  </Link>

                  <ul className="mt-8 space-y-4 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
