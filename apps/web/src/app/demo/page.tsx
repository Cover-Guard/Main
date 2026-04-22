'use client'

import { useState } from 'react'
import { MarketingNav, MarketingFooter } from '@/components/marketing'
import { CheckCircle, Shield, Zap, Clock, BarChart3, AlertCircle } from 'lucide-react'

const highlights = [
  {
    icon: Shield,
    title: 'AI-Powered Tracking',
    description:
      'Automatically monitor and verify insurance certificates across your entire portfolio.',
  },
  {
    icon: Zap,
    title: 'Instant Compliance Alerts',
    description:
      'Get notified the moment a policy lapses, expires, or falls out of compliance.',
  },
  {
    icon: Clock,
    title: 'Save Hours Weekly',
    description:
      'Eliminate manual certificate chasing and reduce administrative overhead by up to 80%.',
  },
  {
    icon: BarChart3,
    title: 'Portfolio-Wide Visibility',
    description:
      'One dashboard to track coverage status across all properties, tenants, and vendors.',
  },
]

export default function DemoPage() {
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('submitting')
    setErrorMsg('')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
      source: 'demo',
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('Failed to send request')
      setFormState('success')
      form.reset()
    } catch {
      setFormState('error')
      setErrorMsg('Something went wrong. Please email us directly at sales@coverguard.io')
    }
  }

  return (
    <>
      <MarketingNav />
      <main id="main-content" className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
              See CoverGuard in Action
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">
              Book a personalized demo and discover how CoverGuard helps real
              estate professionals automate insurance tracking, eliminate
              compliance gaps, and protect their portfolios.
            </p>
          </div>
        </section>

        {/* Form + Highlights */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-16 lg:grid-cols-2">
            {/* Demo Request Form */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Request Your Demo
              </h2>
              <p className="mt-2 text-gray-600">
                Fill out the form below and a member of our team will reach out
                to schedule your personalized walkthrough.
              </p>

              {formState === 'success' ? (
                <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
                  <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    Demo Request Received!
                  </h3>
                  <p className="mt-2 text-gray-600">
                    Thank you! A member of our team will reach out within 1
                    business day to schedule your personalized walkthrough.
                  </p>
                  <button
                    onClick={() => setFormState('idle')}
                    className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <fieldset>
                    <legend className="sr-only">Demo request form</legend>

                    <div className="space-y-5">
                      <div>
                        <label
                          htmlFor="demo-name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Full Name
                        </label>
                        <input
                          type="text"
                          id="demo-name"
                          name="name"
                          required
                          autoComplete="name"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="Jane Smith"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="demo-email"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Work Email
                        </label>
                        <input
                          type="email"
                          id="demo-email"
                          name="email"
                          required
                          autoComplete="email"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="jane@company.com"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="demo-company"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Company
                        </label>
                        <input
                          type="text"
                          id="demo-company"
                          name="company"
                          required
                          autoComplete="organization"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="Acme Realty"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="demo-phone"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Phone <span className="text-gray-400">(optional)</span>
                        </label>
                        <input
                          type="tel"
                          id="demo-phone"
                          name="phone"
                          autoComplete="tel"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="demo-message"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Message / Notes{' '}
                          <span className="text-gray-400">(optional)</span>
                        </label>
                        <textarea
                          id="demo-message"
                          name="message"
                          rows={4}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="Tell us about your portfolio size, current workflow, or specific needs..."
                        />
                      </div>
                    </div>
                  </fieldset>

                  {formState === 'error' && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formState === 'submitting'}
                    className="w-full rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                  >
                    {formState === 'submitting' ? 'Sending...' : 'Book My Demo'}
                  </button>
                </form>
              )}
            </div>

            {/* Selling Points */}
            <div className="flex flex-col justify-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Why CoverGuard?
              </h2>
              <p className="mt-2 text-gray-600">
                Join hundreds of real estate professionals who trust CoverGuard
                to keep their portfolios protected.
              </p>

              <div className="mt-8 space-y-6">
                {highlights.map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                      <item.icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-xl border border-brand-100 bg-brand-50 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-gray-900">
                      No commitment required
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Get a free 30-minute walkthrough tailored to your
                      workflow. No credit card, no pressure.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
