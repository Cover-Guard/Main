import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Flame, Waves, Wind, Activity, Shield } from 'lucide-react'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Risk Intelligence — CoverGuard',
  description:
    'Comprehensive property risk profiles combining FEMA, USGS, Cal Fire, NOAA, FBI, and ASCE data into one instant report.',
}

const perils = [
  {
    icon: Waves,
    name: 'Flood',
    desc: 'FEMA NFHL zones, SFHA status, BFE, and OpenFEMA historical claims by ZIP.',
  },
  {
    icon: Flame,
    name: 'Fire',
    desc: 'Cal Fire FHSZ for California and USFS Wildland-Urban Interface nationwide.',
  },
  {
    icon: Wind,
    name: 'Wind',
    desc: 'ASCE 7 design wind speeds and NOAA SLOSH hurricane surge zones for coastal homes.',
  },
  {
    icon: Activity,
    name: 'Earthquake',
    desc: 'USGS ASCE 7-22 spectral acceleration values for seismic design.',
  },
  {
    icon: Shield,
    name: 'Crime',
    desc: 'FBI Crime Data Explorer rates by agency and jurisdiction.',
  },
]

export default function RiskIntelligencePage() {
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
              <span className="text-sm font-medium text-brand-700">Risk Intelligence</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Every peril. Every property. <span className="text-brand-600">In one report.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              CoverGuard pulls flood, fire, wind, earthquake, and crime data from authoritative
              public sources — and combines them into a single risk profile in under 90 seconds.
            </p>
            <div className="mt-10">
              <Link
                href="/get-started"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                Check a Property Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-2xl">
            Five perils, one unified score
          </h2>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {perils.map((peril) => (
              <div
                key={peril.name}
                className="rounded-2xl border border-gray-200 p-6 hover:border-brand-200 hover:shadow-md transition-all"
              >
                <peril.icon className="h-8 w-8 text-brand-600" />
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{peril.name}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{peril.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
