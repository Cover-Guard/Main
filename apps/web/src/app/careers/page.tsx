import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'
import { Briefcase, MapPin, Heart, Zap, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Careers \u2014 CoverGuard',
  description: 'Join the team building the future of property insurability intelligence. See open roles at CoverGuard.',
}

const perks = [
  { icon: Zap, title: 'Move Fast', description: 'We ship weekly. You will own features end-to-end and see them in production fast.' },
  { icon: Heart, title: 'Mission-Driven', description: 'Every property search we power helps someone make a smarter, safer real-estate decision.' },
  { icon: MapPin, title: 'Remote-First', description: 'Work from anywhere in the US. We gather in-person once a quarter to build together.' },
  { icon: Briefcase, title: 'Competitive Package', description: 'Salary, equity, full benefits, and a home-office stipend so you can do your best work.' },
]

export default function CareersPage() {
  return (
    <>
      <MarketingNav />
      <FooterPagesNav />
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Build the Future of Property Intelligence</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">CoverGuard is on a mission to make insurability data transparent for every property transaction. We&apos;re looking for talented people who want to solve hard problems at the intersection of real&nbsp;estate, insurance, and technology.</p>
            <Link href="mailto:careers@coverguard.io" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-800 shadow hover:bg-brand-50 transition-colors">View Open Positions <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-20">
          <h2 className="text-center text-3xl font-bold text-gray-900">Why CoverGuard?</h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2">
            {perks.map((perk) => (
              <div key={perk.title} className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><perk.icon className="h-6 w-6" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">{perk.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{perk.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-gray-50">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Don&apos;t See Your Role?</h2>
            <p className="mt-4 text-gray-600">We&apos;re always interested in hearing from exceptional people. Send us your resume and tell us how you&apos;d contribute.</p>
            <Link href="mailto:careers@coverguard.io" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 transition-colors">Get in Touch <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
