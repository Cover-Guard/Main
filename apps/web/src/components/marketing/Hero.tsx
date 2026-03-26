import Link from 'next/link'
import { ArrowRight, Shield, Search, TrendingUp } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/50 via-white to-white pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-40 h-[400px] w-[400px] rounded-full bg-brand-50/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
            <Shield className="h-4 w-4 text-brand-600" />
            <span className="text-sm font-medium text-brand-700">Property Insurability Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
            Know the true cost of
            <span className="text-brand-600"> insuring a property </span>
            before you bid
          </h1>

          {/* Subheadline */}
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Instantly assess flood, fire, earthquake, wind, and crime risks for any US property.
            See which carriers are actively writing policies and request a binding quote — all in one platform.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
            >
              Start Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#product"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              See How It Works
            </a>
          </div>

          {/* Trust indicators */}
          <p className="mt-8 text-sm text-gray-500">
            Trusted by 500+ real estate agents and lenders across 38 states
          </p>
        </div>

        {/* Stats row */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 mx-auto mb-3">
              <Search className="h-6 w-6 text-brand-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">1.2M+</div>
            <div className="text-sm text-gray-500 mt-1">Properties Analyzed</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 mx-auto mb-3">
              <Shield className="h-6 w-6 text-brand-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">150+</div>
            <div className="text-sm text-gray-500 mt-1">Active Carriers</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-50 mx-auto mb-3">
              <TrendingUp className="h-6 w-6 text-brand-600" />
            </div>
            <div className="text-3xl font-bold text-gray-900">38</div>
            <div className="text-sm text-gray-500 mt-1">States Covered</div>
          </div>
        </div>
      </div>
    </section>
  )
}
