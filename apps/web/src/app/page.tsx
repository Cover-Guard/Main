import { redirect } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import {
  MarketingNav,
  Hero,
  ProductOfferings,
  HowItWorks,
  InvestorsSection,
  CTABanner,
  MarketingFooter,
} from '@/components/marketing'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CoverGuard — Check Property Insurability Before the Offer',
  description:
    'Real-time flood, fire, earthquake, wind & crime risk for any US property. See which carriers are still writing — in 90 seconds. Built for agents, brokers & lenders.',
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
        <InvestorsSection />
        <CTABanner />
      </main>
      <MarketingFooter />
    </div>
  )
}
