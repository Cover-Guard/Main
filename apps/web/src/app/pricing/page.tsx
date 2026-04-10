'use client'

import Link from 'next/link'
import { MarketingNav, MarketingFooter } from '@/components/marketing'
import { Check, User, Building2, Landmark, Shield, Warehouse } from 'lucide-react'
import { useState } from 'react'
import { createCheckoutSession, createPortalSession } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

/* ------------------------------------------------------------------ */
/*  Audience Segments                                                  */
/* ------------------------------------------------------------------ */

const segments = [
  { key: 'home_buyer', label: 'Home Buyers', icon: User },
  { key: 'residential', label: 'Residential Agents', icon: Building2 },
  { key: 'cre', label: 'CRE Brokers', icon: Warehouse },
  { key: 'lender', label: 'Lenders', icon: Landmark },
  { key: 'insurance', label: 'Insurance Brokers', icon: Shield },
] as const

type SegmentKey = (typeof segments)[number]['key']

/* ------------------------------------------------------------------ */
/*  Plans per segment                                                  */
/* ------------------------------------------------------------------ */

interface Plan {
  name: string
  description: string
  price: string
  period: string
  highlighted: boolean
  priceEnvKey: string
  cta: string
  features: string[]
  contactSales?: boolean
}

const plansBySegment: Record<SegmentKey, Plan[]> = {
  home_buyer: [
    {
      name: 'Free',
      description: 'For homeowners and buyers exploring a property before they commit.',
      price: '$0',
      period: '',
      highlighted: false,
      priceEnvKey: '',
      cta: 'Create Free Account',
      features: [
        'Up to 3 property reports — free forever',
        'Risk profiles (flood, fire, wind, earthquake, crime)',
        'Carrier availability lookup',
        'Save up to 3 properties',
        'Email support',
      ],
    },
    {
      name: 'Home Buyer Pro',
      description: 'For active home buyers who need more reports and deeper insights.',
      price: '$29',
      period: '/month',
      highlighted: true,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
      cta: 'Get Started',
      features: [
        '25 property reports per month',
        'Everything in Free',
        'Side-by-side property comparison',
        'Insurance cost estimates',
        'Search history & saved reports',
        'Priority email support',
      ],
    },
  ],
  residential: [
    {
      name: 'Agent Starter',
      description: 'For individual residential agents getting started with insurability checks.',
      price: '$29',
      period: '/month',
      highlighted: false,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
      cta: 'Get Started',
      features: [
        '25 property reports per month',
        'Risk profiles (flood, fire, wind, earthquake, crime)',
        'Carrier availability lookup',
        'Save up to 25 properties',
        'Client management (up to 10 clients)',
        'Email support',
      ],
    },
    {
      name: 'Professional',
      description: 'For active agents managing multiple clients and listings.',
      price: '$79',
      period: '/month',
      highlighted: true,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
      cta: 'Get Started',
      features: [
        '100 property reports per month',
        'Everything in Agent Starter',
        'Binding quote requests',
        'Full client management dashboard',
        'Side-by-side property comparison',
        'Analytics & search history',
        'Professional risk report PDFs',
        'Priority support',
      ],
    },
    {
      name: 'Brokerage',
      description: 'For teams and brokerages that need scale and collaboration.',
      price: '$199',
      period: '/month',
      highlighted: false,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_TEAM',
      cta: 'Contact Sales',
      contactSales: true,
      features: [
        'Unlimited property reports',
        'Everything in Professional',
        'Up to 10 team members',
        'Shared client & property lists',
        'Team analytics & reporting',
        'API access',
        'Dedicated account manager',
      ],
    },
  ],
  cre: [
    {
      name: 'CRE Starter',
      description: 'For individual CRE brokers evaluating commercial property risk.',
      price: '$79',
      period: '/month',
      highlighted: false,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
      cta: 'Get Started',
      features: [
        '50 property reports per month',
        'Commercial property risk profiles',
        'Carrier availability by property type',
        'Environmental risk layers',
        'Client management dashboard',
        'Priority support',
      ],
    },
    {
      name: 'CRE Professional',
      description: 'For CRE teams managing portfolios and investor due diligence.',
      price: '$199',
      period: '/month',
      highlighted: true,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_TEAM',
      cta: 'Contact Sales',
      contactSales: true,
      features: [
        'Unlimited property reports',
        'Everything in CRE Starter',
        'Portfolio-level risk analysis',
        'Up to 10 team members',
        'Shared deal pipelines',
        'Team analytics & reporting',
        'API access',
        'Dedicated account manager',
      ],
    },
  ],
  lender: [
    {
      name: 'Lender Starter',
      description: 'For individual loan officers verifying insurability before commitment.',
      price: '$79',
      period: '/month',
      highlighted: false,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
      cta: 'Get Started',
      features: [
        '100 property reports per month',
        'Pre-commitment insurability verification',
        'Carrier availability by ZIP & risk profile',
        'Flood zone & SFHA status checks',
        'Insurance cost estimates for underwriting',
        'Priority support',
      ],
    },
    {
      name: 'Lender Enterprise',
      description: 'For lending teams and mortgage companies at scale.',
      price: 'Custom',
      period: '',
      highlighted: true,
      priceEnvKey: '',
      cta: 'Contact Sales',
      contactSales: true,
      features: [
        'Unlimited property reports',
        'Everything in Lender Starter',
        'Bulk property screening',
        'API integration with your LOS',
        'Custom risk thresholds',
        'Team accounts & role management',
        'SLA-backed support',
        'Dedicated account manager',
      ],
    },
  ],
  insurance: [
    {
      name: 'Carrier Starter',
      description: 'For individual insurance agents pre-qualifying inbound leads.',
      price: '$79',
      period: '/month',
      highlighted: false,
      priceEnvKey: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
      cta: 'Get Started',
      features: [
        '100 property reports per month',
        'Full multi-peril risk profiles',
        'Carrier availability by ZIP & risk tier',
        'Pre-qualify leads before quoting',
        'Client management dashboard',
        'Priority support',
      ],
    },
    {
      name: 'Carrier Enterprise',
      description: 'For insurance companies and MGAs integrating risk data at scale.',
      price: 'Custom',
      period: '',
      highlighted: true,
      priceEnvKey: '',
      cta: 'Contact Sales',
      contactSales: true,
      features: [
        'Unlimited property reports',
        'Everything in Carrier Starter',
        'API integration for automated underwriting',
        'Bulk risk screening',
        'Custom risk scoring models',
        'Portfolio analytics & loss modeling',
        'White-label reports',
        'SLA-backed support',
        'Dedicated account manager',
      ],
    },
  ],
}

// Stripe price IDs from env (available at build time via NEXT_PUBLIC_ prefix)
const PRICE_IDS: Record<string, string | undefined> = {
  NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL: process.env.NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL,
  NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL,
  NEXT_PUBLIC_STRIPE_PRICE_TEAM: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM,
}

export default function PricingPage() {
  const [activeSegment, setActiveSegment] = useState<SegmentKey>('home_buyer')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failedPlan, setFailedPlan] = useState<string | null>(null)

  const plans = plansBySegment[activeSegment]

  async function handleSubscribe(plan: Plan) {
    setError(null)

    if (plan.contactSales) {
      window.location.assign('mailto:sales@coverguard.io')
      return
    }

    if (plan.name === 'Free') {
      window.location.assign('/register')
      return
    }

    // Check if user is authenticated
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
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
    setFailedPlan(null)
    try {
      const { url } = await createCheckoutSession(priceId)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout.')
      setFailedPlan(plan.name)
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
                Plans for every role in real estate
              </h1>
              <p className="mt-4 text-lg text-gray-600">
                Whether you&apos;re a home buyer, agent, broker, lender, or insurance broker — CoverGuard has a plan built for you. Home buyers start free with up to 3 property reports.
              </p>
            </div>

            {/* Segment tabs */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
              {segments.map((seg) => {
                const Icon = seg.icon
                return (
                  <button
                    key={seg.key}
                    onClick={() => {
                      setActiveSegment(seg.key)
                      setError(null)
                      setFailedPlan(null)
                    }}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                      activeSegment === seg.key
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {seg.label}
                  </button>
                )
              })}
            </div>

            {error && (
              <div className="mt-8 mx-auto max-w-lg rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 text-center">
                {error}
              </div>
            )}

            {/* Pricing cards */}
            <div className={`mt-16 grid gap-8 ${plans.length === 3 ? 'grid-cols-1 md:grid-cols-3' : plans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' : 'grid-cols-1 max-w-lg mx-auto'}`}>
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
                        {plan.name === 'Free' ? 'Start Here' : 'Most Popular'}
                      </span>
                    </div>
                  )}

                  <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                  <p className="mt-2 text-sm text-gray-600">{plan.description}</p>

                  <div className="mt-6">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-500">{plan.period}</span>}
                  </div>

                  {plan.contactSales ? (
                    <Link
                      href="mailto:sales@coverguard.io"
                      className="mt-8 block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      {plan.cta}
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan)}
                      disabled={loadingPlan !== null}
                      className={`mt-8 block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${
                        failedPlan === plan.name
                          ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                          : plan.highlighted
                            ? 'bg-brand-600 text-white hover:bg-brand-700'
                            : 'bg-gray-50 text-gray-900 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {loadingPlan === plan.name
                        ? 'Redirecting...'
                        : failedPlan === plan.name
                          ? 'Retry Checkout'
                          : plan.cta}
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

            {/* Free tier callout */}
            {activeSegment !== 'home_buyer' && (
              <div className="mt-12 text-center rounded-2xl bg-brand-50 border border-brand-100 p-8 max-w-2xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-900">Not ready to commit?</h3>
                <p className="mt-2 text-sm text-gray-600">
                  Every account starts with <span className="font-semibold text-brand-700">3 free property reports</span> — no credit card required. Try CoverGuard risk-free before choosing a plan.
                </p>
                <Link
                  href="/register"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                >
                  Create Free Account
                </Link>
              </div>
            )}

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
