import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingNav, MarketingFooter, FooterPagesNav } from '@/components/marketing'
import { Shield, Lock, Server, Eye, ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security — CoverGuard',
  description: 'Learn how CoverGuard protects your data with enterprise-grade security, encryption, and compliance controls.',
}

const practices = [
  { icon: Lock, title: 'Encryption Everywhere', description: 'All data is encrypted in transit via TLS 1.3 and at rest with AES-256. Database backups are encrypted and stored in geographically redundant locations.' },
  { icon: Server, title: 'Infrastructure', description: 'Hosted on Vercel and Supabase with SOC 2-compliant infrastructure. Automatic scaling, DDoS protection, and 99.9% uptime SLA.' },
  { icon: Eye, title: 'Access Controls', description: 'Role-based access, row-level security in the database, and OAuth 2.0 authentication. We follow the principle of least privilege across all systems.' },
  { icon: Shield, title: 'Compliance', description: 'We are building toward SOC 2 Type II certification. Our data handling practices align with CCPA and industry best practices for PII protection.' },
]

export default function SecurityPage() {
  return (
    <>
      <MarketingNav />
      <FooterPagesNav />
      <main className="min-h-screen bg-white">
        <section className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 text-white">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Security</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-brand-100">Protecting property data is core to our mission. Here is how we keep your information safe.</p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-20">
          <div className="grid gap-10 sm:grid-cols-2">
            {practices.map((p) => (
              <div key={p.title} className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><p.icon className="h-6 w-6" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-gray-50">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Have a Security Question?</h2>
            <p className="mt-4 text-gray-600">If you have questions about our security practices or want to report a vulnerability, please reach out.</p>
            <Link href="mailto:security@coverguard.io" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-brand-700 transition-colors">Contact Security Team <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
