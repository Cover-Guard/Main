import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import {
  MarketingNav,
  Hero,
  ProductOfferings,
  HowItWorks,
  WhyCoverGuard,
  InvestorsSection,
  CTABanner,
  MarketingFooter,
} from '@/components/marketing'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CoverGuard — Know Whether You Can Insure It Before You Bid',
  description:
    'The only national platform that combines carrier-grade risk data, live carrier-writing status, and binding-quote requests for any U.S. property. All 50 states. Day one. Built for home buyers, agents, brokers, and lenders.',
}

export default async function HomePage() {
  // When Supabase is configured, redirect authenticated users to the dashboard.
  // When env vars are missing (e.g. first deploy), just render the marketing page.
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <Hero />
        <ProductOfferings />
        <HowItWorks />
        <WhyCoverGuard />
        <InvestorsSection />
        <CTABanner />
      </main>
      <MarketingFooter />
    </div>
  )
}
