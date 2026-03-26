import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  MarketingNav,
  Hero,
  ProductOfferings,
  HowItWorks,
  TeamSection,
  InvestorsSection,
  CTABanner,
  MarketingFooter,
} from '@/components/marketing'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CoverGuard — Property Insurability Intelligence',
  description:
    'Know the true cost of insuring any US property before you bid. Assess flood, fire, earthquake, wind, and crime risks instantly.',
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Authenticated users go straight to the app
  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen">
      <MarketingNav />
      <main>
        <Hero />
        <ProductOfferings />
        <HowItWorks />
        <TeamSection />
        <InvestorsSection />
        <CTABanner />
      </main>
      <MarketingFooter />
    </div>
  )
}
