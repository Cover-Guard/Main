import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'
import { Code2, Lock, Zap, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'API Reference — CoverGuard',
  description: 'Integrate property insurability data into your applications with the CoverGuard REST API.',
}

const endpoints = [
  { method: 'GET', path: '/v1/properties/:id/risk', description: 'Retrieve the composite risk profile for a property including flood, fire, wind, earthquake, and crime scores.' },
  { method: 'GET', path: '/v1/properties/:id/carriers', description: 'List carriers currently writing coverage for this property, with appetite indicators.' },
  { method: 'POST', path: '/v1/searches', description: 'Submit a new property search by address or coordinates and receive a risk report.' },
  { method: 'GET', path: '/v1/quotes/:id', description: 'Check the status of a quote request and retrieve carrier responses.' },
]

export default function ApiReferencePage() {
  return (
    <>
      <MarketingNav />
      <div className="pt-16">
        <FooterPagesNav />
      </div>
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">API Reference</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">Build on top of CoverGuard. Access property risk data, carrier availability, and quote workflows programmatically.</p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-16">
          <div className="grid gap-6 sm:grid-cols-3 mb-16">
            <div className="flex gap-3 items-start"><Zap className="h-5 w-5 text-brand-600 mt-0.5" /><div><h3 className="font-semibold text-gray-900">Fast</h3><p className="text-sm text-gray-600">Sub-200ms p95 latency on all read endpoints.</p></div></div>
            <div className="flex gap-3 items-start"><Lock className="h-5 w-5 text-brand-600 mt-0.5" /><div><h3 className="font-semibold text-gray-900">Secure</h3><p className="text-sm text-gray-600">OAuth 2.0 bearer tokens. All traffic over TLS 1.3.</p></div></div>
            <div className="flex gap-3 items-start"><Code2 className="h-5 w-5 text-brand-600 mt-0.5" /><div><h3 className="font-semibold text-gray-900">RESTful</h3><p className="text-sm text-gray-600">JSON over HTTPS. Predictable, resource-oriented URLs.</p></div></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Endpoints</h2>
          <div className="space-y-4">
            {endpoints.map((ep) => (
              <div key={ep.path} className="rounded-lg border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-mono font-semibold text-brand-700">{ep.method}</span>
                  <code className="text-sm font-mono text-gray-800">{ep.path}</code>
                </div>
                <p className="text-sm text-gray-600">{ep.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-xl bg-gray-50 p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900">Ready to integrate?</h3>
            <p className="mt-2 text-sm text-gray-600">Contact us for API credentials and a sandbox environment.</p>
            <Link href="/contact" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 transition-colors">Request Access <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
