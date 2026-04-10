import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, User, ArrowRight, Landmark, Shield, Warehouse } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Started — CoverGuard',
  description: 'Choose how you want to use CoverGuard — as a home buyer, residential agent, CRE broker, lender, or insurance broker.',
}

const userTypes = [
  {
    icon: User,
    title: 'Home Buyer',
    description: 'For home buyers and homeowners. Start with 3 free property reports — check risk, insurance costs, and carrier availability.',
    href: '/login',
    cta: 'Continue as Home Buyer',
    tag: 'Free to start',
  },
  {
    icon: Building2,
    title: 'Residential Agent / Broker',
    description: 'For real estate agents and brokers who need pre-offer insurability checks, client management, and professional risk reports.',
    href: '/agents/login',
    cta: 'Continue as Agent',
    tag: null,
  },
  {
    icon: Warehouse,
    title: 'CRE Agent / Broker',
    description: 'For commercial real estate brokers evaluating property risk, environmental exposure, and carrier availability for commercial deals.',
    href: '/agents/login',
    cta: 'Continue as CRE Broker',
    tag: null,
  },
  {
    icon: Landmark,
    title: 'Lender',
    description: 'For mortgage lenders and loan officers. Verify insurability before loan commitment — eliminate last-minute closing delays.',
    href: '/login',
    cta: 'Continue as Lender',
    tag: null,
  },
  {
    icon: Shield,
    title: 'Insurance Broker',
    description: 'For independent brokers and agencies. Pre-qualify leads, screen books of business, and see live carrier availability before you shop submissions.',
    href: '/login',
    cta: 'Continue as Insurance Broker',
    tag: null,
  },
]

export default async function GetStartedPage() {
  let isAuthenticated = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isAuthenticated = !!user
  } catch {
    // If Supabase is unavailable, render the page without the auth redirect
  }

  if (isAuthenticated) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 via-white to-white flex flex-col">
      {/* Header */}
      <header className="pt-10 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <CoverGuardShield className="h-9 w-9" />
          <span className="text-xl font-bold text-gray-900">CoverGuard</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              How would you like to use CoverGuard?
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              Select your account type to get started. Every account includes 3 free property reports.
            </p>
          </div>

          {/* Top row: Individual (full width callout) */}
          <div className="mb-6">
            <Link
              href={userTypes[0].href}
              className="group relative rounded-2xl border-2 border-brand-200 bg-brand-50/50 p-8 hover:border-brand-500 hover:shadow-lg transition-all duration-200 flex flex-col sm:flex-row items-center gap-6"
            >
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 group-hover:bg-brand-200 transition-colors shrink-0">
                <User className="h-8 w-8 text-brand-600" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <h2 className="text-xl font-semibold text-gray-900">{userTypes[0].title}</h2>
                  <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
                    {userTypes[0].tag}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  {userTypes[0].description}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 group-hover:gap-2.5 transition-all shrink-0">
                {userTypes[0].cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          {/* Bottom grid: Professional accounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {userTypes.slice(1).map((type) => {
              const Icon = type.icon
              return (
                <Link
                  key={type.title}
                  href={type.href}
                  className="group relative rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-brand-500 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 group-hover:bg-brand-100 transition-colors mb-5">
                      <Icon className="h-8 w-8 text-brand-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">{type.title}</h2>
                    <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                      {type.description}
                    </p>
                    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 group-hover:gap-2.5 transition-all">
                      {type.cta}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            Not sure?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Home Buyer accounts
            </Link>{' '}
            start free with 3 property reports — perfect for getting started.
          </p>
        </div>
      </main>
    </div>
  )
}
