import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Carrier Availability — CoverGuard',
  description:
    'See which carriers are actively writing and binding new policies in any ZIP code. Stop guessing which insurers will cover your client.',
}

const statuses = [
  {
    icon: CheckCircle2,
    color: 'text-green-600 bg-green-50',
    label: 'Writing',
    desc: 'Carrier is actively binding new policies in this market.',
  },
  {
    icon: AlertCircle,
    color: 'text-amber-600 bg-amber-50',
    label: 'Restricted',
    desc: 'Carrier is writing limited business — narrow eligibility rules apply.',
  },
  {
    icon: XCircle,
    color: 'text-red-600 bg-red-50',
    label: 'Non-Renewing',
    desc: 'Carrier has paused or exited — new business is not being accepted.',
  },
]

export default function CarrierAvailabilityPage() {
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
              <span className="text-sm font-medium text-brand-700">Carrier Availability</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              Know who&apos;s writing —<span className="text-brand-600"> before you write the offer</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              State Farm, Allstate, and Farmers have pulled out of entire markets. CoverGuard
              tracks which carriers are actively binding at any US address — updated continuously.
            </p>
            <div className="mt-10">
              <Link
                href="/get-started"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                Check Carrier Availability
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-2xl">
            Three writing statuses, one clear answer
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {statuses.map((status) => (
              <div key={status.label} className="rounded-2xl border border-gray-200 p-6">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${status.color}`}>
                  <status.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-gray-900">{status.label}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{status.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
