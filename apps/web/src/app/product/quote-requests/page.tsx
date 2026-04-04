import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, FileText, Send, CheckSquare } from 'lucide-react'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'Quote Requests — CoverGuard',
  description:
    'Request binding insurance quotes from active carriers — directly from the CoverGuard platform.',
}

const steps = [
  {
    icon: FileText,
    title: 'Review the risk profile',
    desc: 'Confirm flood, fire, wind, earthquake, and crime exposure for the property.',
  },
  {
    icon: CheckSquare,
    title: 'Pick an active carrier',
    desc: 'Choose from carriers actually writing in the ZIP — no wasted calls.',
  },
  {
    icon: Send,
    title: 'Send the quote request',
    desc: 'Submit the property details and receive a binding quote from the carrier directly.',
  },
]

export default function QuoteRequestsPage() {
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
              <span className="text-sm font-medium text-brand-700">Quote Requests</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              From risk check to binding quote — <span className="text-brand-600">in minutes</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              After you&apos;ve verified insurability and seen which carriers are active, request a
              binding quote right from the property page — no separate portals, no phone tag.
            </p>
            <div className="mt-10">
              <Link
                href="/get-started"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                Request Your First Quote
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 max-w-2xl">
            Three steps to a binding quote
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, idx) => (
              <div key={step.title} className="rounded-2xl border border-gray-200 p-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <step.icon className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-medium text-brand-600">Step {idx + 1}</p>
                <h3 className="mt-1 text-xl font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-gray-600 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
