import type { Metadata } from 'next'
import { Users, BarChart3, BookmarkCheck, Layers } from 'lucide-react'
import { ProductPageTemplate, type ProductFeature } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Agent Dashboard — CoverGuard',
  description:
    'The real estate agent command center: clients, saved properties, comparisons, and analytics in one place.',
}

const features: ProductFeature[] = [
  {
    icon: Users,
    title: 'Client management',
    desc: "Track every buyer or seller, their saved searches, and which properties you've vetted.",
  },
  {
    icon: BookmarkCheck,
    title: 'Saved properties',
    desc: 'Keep tagged notes and insurability results attached to each property you monitor.',
  },
  {
    icon: Layers,
    title: 'Side-by-side compare',
    desc: 'Compare up to 3 properties on risk, insurability, and carrier availability at once.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    desc: 'See search history, risk distribution across your pipeline, and activity trends.',
  },
]

export default function AgentDashboardPage() {
  return (
    <ProductPageTemplate
      badge="Agent Dashboard"
      headingLead="Your real estate command center —"
      headingAccent="built for insurability"
      subtitle="Manage clients, saved properties, side-by-side comparisons, and pipeline analytics — all anchored to the risk and carrier data that wins deals."
      ctaLabel="Create an Agent Account"
      ctaHref="/agents/register"
      sectionTitle="Everything you need to protect every deal"
      features={features}
      gridClassName="grid-cols-1 sm:grid-cols-2"
    />
  )
}
