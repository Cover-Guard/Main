import Link from 'next/link'
import { ArrowRight, Calendar } from 'lucide-react'

export function CTABanner() {
  return (
    <section className="py-24 bg-brand-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Stop losing deals to insurance surprises
        </h2>
        <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
          With carriers exiting major markets, insurance is killing deals at closing.
          CoverGuard puts the insurability check where it belongs — before anyone signs on the dotted line.
        </p>
        <p className="mt-4 text-sm text-brand-300 max-w-xl mx-auto">
          Whether you&apos;re a home buyer, agent, broker, lender, or insurer — CoverGuard gives you the risk intelligence to move forward with confidence. Individuals get 3 free reports to get started.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/get-started"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
          >
            Check a Property Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-700 bg-transparent px-6 py-3 text-base font-semibold text-white hover:bg-brand-900 transition-colors"
          >
            <Calendar className="h-4 w-4" />
            Book a Demo
          </Link>
        </div>
        <p className="mt-6 text-sm text-brand-400">
          Free to start — no credit card required. Available in all 50 states.
        </p>
      </div>
    </section>
  )
}
