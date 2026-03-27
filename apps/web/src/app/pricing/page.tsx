'use client'

import Link from 'next/link'
import { MarketingNav, MarketingFooter } from '@/components/marketing'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { createCheckoutSession, createPortalSession } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

const plans = [
  {
    name: 'Individual',
    description: 'For home buyers and independent agents getting started.',
    price: '$29',
    period: '/month',
    highlighted: false,
    priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
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
    highlighted: true,
    priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
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
    highlighted: false,
    priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_TEAM',
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

// Stripe price IDs from env (available at build time via NEXT_PUBLIC_ prefix)
const PRICE_IDS: Record<string, string | undefined> = {
  NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL: process.env.NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL,
  NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL,
  NEXT_PUBLIC_STRIPE_PRICE_TEAM: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM,
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(plan: typeof plans[number]) {
    setError(null)

    // Check if user is authenticated
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      // Not logged in — send to register
      window.location.assign('/register')
      return
    }

    const priceId = PRICE_IDS[plan.priceEnvKey]
    if (!priceId) {
      console.error(`Stripe price env var not configured: ${plan.priceEnvKey}`)
      setError('This plan is not yet available. Please contact sales@coverguard.io.')
      return
    }

    setLoadingPlan(plan.name)
    try {
      const { url } = await createCheckoutSession(priceId)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout. Please try again.')
      setLoadingPlan(null)
    }
  }

  async function handleManageSubscription() {
    setError(null)
    try {
      const { url } = await createPortalSession()
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal.')
    }
  }

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

            {error && (
              <div className="mt-8 mx-auto max-w-lg rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

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

                  {plan.name === 'Team' ? (
                    <Link
                      href="mailto:sales@coverguard.io"
                      className="mt-8 block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      Contact Sales
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={loadingPlan !== null}
                      className={`mt-8 block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        plan.highlighted
                          ? 'bg-brand-600 text-white hover:bg-brand-700'
                          : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {loadingPlan === plan.name ? 'Redirecting...' : 'Get Started'}
                    </button>
                  )}

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

            {/* Manage existing subscription */}
            <div className="mt-12 text-center">
              <p className="text-sm text-gray-500">
                Already subscribed?{' '}
                <button
                  onClick={handleManageSubscription}
                  className="text-brand-600 hover:underline font-medium"
                >
                  Manage your subscription
                </button>
              </p>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
