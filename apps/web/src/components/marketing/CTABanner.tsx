import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CTABanner() {
  return (
    <section className="py-24 bg-brand-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Ready to know the true cost of coverage?
        </h2>
        <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
          Join hundreds of agents and buyers who check insurability before making an offer.
          Start for free — no credit card required.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/agents/register"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-400 px-6 py-3 text-base font-semibold text-white hover:bg-brand-900 transition-colors"
          >
            Agent Portal
          </Link>
        </div>
      </div>
    </section>
  )
}
