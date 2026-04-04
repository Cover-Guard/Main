import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'
import { Mail, MessageSquare, MapPin } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact — CoverGuard',
  description: 'Get in touch with the CoverGuard team. We are here to help with questions about our platform, partnerships, and more.',
}

const channels = [
  { icon: Mail, title: 'Email', description: 'For general inquiries and support requests.', value: 'hello@coverguard.io', href: 'mailto:hello@coverguard.io' },
  { icon: MessageSquare, title: 'Sales', description: 'Talk to our team about enterprise plans and integrations.', value: 'sales@coverguard.io', href: 'mailto:sales@coverguard.io' },
  { icon: MapPin, title: 'Office', description: 'CoverGuard, Inc.', value: 'Austin, TX', href: '#' },
]

export default function ContactPage() {
  return (
    <>
      <MarketingNav />
      <FooterPagesNav />
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Contact Us</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">Have a question, want a demo, or interested in partnering? We would love to hear from you.</p>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-4 py-20">
          <div className="grid gap-8 sm:grid-cols-3">
            {channels.map((ch) => (
              <Link key={ch.title} href={ch.href} className="rounded-xl border border-gray-200 p-6 text-center hover:shadow-lg transition-shadow">
                <ch.icon className="mx-auto h-8 w-8 text-brand-600" />
                <h3 className="mt-4 font-semibold text-gray-900">{ch.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{ch.description}</p>
                <p className="mt-3 text-sm font-medium text-brand-600">{ch.value}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
