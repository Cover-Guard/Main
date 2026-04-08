'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MarketingNav, MarketingFooter } from '@/components/marketing'
import { Mail, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react'

const channels = [
  { icon: Mail, title: 'Email', description: 'For general inquiries and support requests.', value: 'hello@coverguard.io', href: 'mailto:hello@coverguard.io' },
  { icon: MessageSquare, title: 'Sales', description: 'Talk to our team about enterprise plans and integrations.', value: 'sales@coverguard.io', href: 'mailto:sales@coverguard.io' },
]

export default function ContactPage() {
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
      source: 'contact',
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('Failed to send message')
      setFormState('success')
      form.reset()
    } catch {
      setFormState('error')
      setErrorMsg('Something went wrong. Please email us directly at investor@coverguard.io')
    }
  }

  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Contact Us</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">Have a question, want a demo, or interested in partnering? We would love to hear from you.</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20">
          <div className="grid gap-8 sm:grid-cols-2 mb-16">
            {channels.map((ch) => (
              <Link key={ch.title} href={ch.href} className="rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
                <ch.icon className="mx-auto h-8 w-8 text-brand-600" />
                <h3 className="mt-4 font-semibold text-gray-900">{ch.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{ch.description}</p>
                <p className="mt-3 text-sm font-medium text-brand-600">{ch.value}</p>
              </Link>
            ))}
          </div>

          {/* Contact Form */}
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 text-center">Send Us a Message</h2>
            <p className="mt-2 text-center text-gray-600">
              Fill out the form below and our team will get back to you shortly.
            </p>

            {formState === 'success' ? (
              <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
                <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">Message Sent!</h3>
                <p className="mt-2 text-gray-600">Thank you for reaching out. We&apos;ll get back to you within 1 business day.</p>
                <button
                  onClick={() => setFormState('idle')}
                  className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="contact-name"
                      name="name"
                      required
                      autoComplete="name"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700">
                      Work Email
                    </label>
                    <input
                      type="email"
                      id="contact-email"
                      name="email"
                      required
                      autoComplete="email"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="contact-company" className="block text-sm font-medium text-gray-700">
                      Company
                    </label>
                    <input
                      type="text"
                      id="contact-company"
                      name="company"
                      required
                      autoComplete="organization"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                      placeholder="Acme Realty"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700">
                      Phone <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      id="contact-phone"
                      name="phone"
                      autoComplete="tel"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={4}
                    required
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                    placeholder="Tell us how we can help..."
                  />
                </div>

                {formState === 'error' && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formState === 'submitting'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {formState === 'submitting' ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
