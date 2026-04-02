import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav, MarketingFooter } from '@/components/marketing'
import { BookOpen, Code2, FileText, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Documentation — CoverGuard',
  description: 'Guides, tutorials, and references to help you get the most out of CoverGuard property insurability platform.',
}

const sections = [
  { icon: BookOpen, title: 'Getting Started', description: 'Set up your account, run your first property search, and understand your risk report in under five minutes.', href: '/docs' },
  { icon: Code2, title: 'API Reference', description: 'Integrate CoverGuard data into your own applications with our RESTful API.', href: '/api-reference' },
  { icon: FileText, title: 'Knowledge Base', description: 'In-depth articles on flood zones, fire scores, carrier appetites, and more.', href: '/docs' },
]

export default function DocsPage() {
  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Documentation</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">Everything you need to understand, integrate, and get the most value from CoverGuard.</p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-20">
          <div className="grid gap-8 sm:grid-cols-3">
            {sections.map((s) => (
              <div key={s.title} className="rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <s.icon className="h-8 w-8 text-brand-600" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.description}</p>
                <Link href={s.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">Explore <ArrowRight className="h-3 w-3" /></Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
