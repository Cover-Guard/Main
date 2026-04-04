import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Users, BarChart3, BookmarkCheck, Layers } from 'lucide-react'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Agent Dashboard — CoverGuard',
  description:
    'The real estate agent command center: clients, saved properties, comparisons, and analytics in one place.',
}

const features = [
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
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <div className="pt-16">
        <FooterPagesNav />
      </div>

      <section className="pt-16 pb-20 bg-gradient-to-b from-brand-50/50 via-white to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">Agent Dashboard</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Your real estate command center — <span className="text-brand-600">built for insurability</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              Manage clients, saved properties, side-by-side comparisons, and pipeline analytics —
              all anchored to the risk and carrier data that wins deals.
            </p>
            <div className="mt-10">
              <Link
                href="/agents/register"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                Create an Agent Account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-2xl">
            Everything you need to protect every deal
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-gray-200 p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
