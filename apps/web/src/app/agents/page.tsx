import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Calendar,
  Waves,
  Flame,
  Wind,
  Activity,
  Shield,
  XCircle,
  AlertCircle,
  FileText,
  CheckSquare,
  Send,
  Users,
  BookmarkCheck,
  Layers,
  BarChart3,
  TrendingUp,
  Briefcase,
  BookOpen,
  Code2,
  Mail,
  Lock,
  Server,
  Eye,
} from 'lucide-react'
import { MarketingNav, AgentMarketingFooter } from '@/components/marketing'

export const metadata: Metadata = {
  title: 'CoverGuard for Real Estate Agents — Check Insurability Before the Offer',
  description:
    'Stop losing deals to insurance surprises. CoverGuard gives real estate agents a 90-second insurability check for any US property — before your client makes an offer.',
}

const benefits = [
  'Run a full risk check before showing any listing',
  'See which carriers are still writing in that ZIP code',
  'Catch flood, fire, seismic, wind & crime risks upfront',
  'Request a binding quote in the same platform',
  'Share a professional risk report with your clients',
  'Works on any US property — residential & commercial',
]

type AnchorSection = {
  id: string
  eyebrow: string
  title: string
  body: string
  bullets?: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string }[]
}

const productSections: AnchorSection[] = [
  {
    id: 'risk-intelligence',
    eyebrow: 'Risk Intelligence',
    title: 'Every peril. Every property. One report.',
    body: 'CoverGuard pulls flood, fire, wind, earthquake, and crime data from authoritative public sources and combines them into a single risk profile in under 90 seconds.',
    bullets: [
      { icon: Waves, label: 'Flood', desc: 'FEMA NFHL zones, SFHA, BFE, and OpenFEMA claims by ZIP.' },
      { icon: Flame, label: 'Fire', desc: 'Cal Fire FHSZ and USFS Wildland-Urban Interface nationwide.' },
      { icon: Wind, label: 'Wind', desc: 'ASCE 7 design wind speeds and NOAA SLOSH surge zones.' },
      { icon: Activity, label: 'Earthquake', desc: 'USGS ASCE 7-22 spectral acceleration values.' },
      { icon: Shield, label: 'Crime', desc: 'FBI Crime Data Explorer rates by agency.' },
    ],
  },
  {
    id: 'carrier-availability',
    eyebrow: 'Carrier Availability',
    title: "Know who's writing — before you write the offer.",
    body: 'State Farm, Allstate, and Farmers have pulled out of entire markets. CoverGuard tracks which carriers are actively binding at any US address — updated continuously.',
    bullets: [
      { icon: CheckCircle2, label: 'Writing', desc: 'Carrier is actively binding new policies in this market.' },
      { icon: AlertCircle, label: 'Restricted', desc: 'Carrier is writing limited business with narrow eligibility.' },
      { icon: XCircle, label: 'Non-Renewing', desc: 'Carrier has paused or exited new business.' },
    ],
  },
  {
    id: 'quote-requests',
    eyebrow: 'Quote Requests',
    title: 'From risk check to binding quote — in minutes.',
    body: 'After you have verified insurability and seen which carriers are active, request a binding quote right from the property page — no separate portals, no phone tag.',
    bullets: [
      { icon: FileText, label: 'Review risk', desc: 'Confirm flood, fire, wind, earthquake, and crime exposure.' },
      { icon: CheckSquare, label: 'Pick a carrier', desc: 'Choose from carriers actually writing in the ZIP.' },
      { icon: Send, label: 'Send request', desc: 'Receive a binding quote from the carrier directly.' },
    ],
  },
  {
    id: 'agent-dashboard',
    eyebrow: 'Agent Dashboard',
    title: 'Your real estate command center — built for insurability.',
    body: 'Manage clients, saved properties, side-by-side comparisons, and pipeline analytics — all anchored to the risk and carrier data that wins deals.',
    bullets: [
      { icon: Users, label: 'Clients', desc: 'Track every buyer or seller and their saved searches.' },
      { icon: BookmarkCheck, label: 'Saved properties', desc: 'Tagged notes and insurability results per property.' },
      { icon: Layers, label: 'Compare', desc: 'Side-by-side compare up to 3 properties at once.' },
      { icon: BarChart3, label: 'Analytics', desc: 'Search history, risk distribution, activity trends.' },
    ],
  },
]

const companySections: AnchorSection[] = [
  {
    id: 'pricing',
    eyebrow: 'Pricing',
    title: 'Plans for every stage of your business.',
    body: 'Individual ($29/mo) for getting started, Professional ($79/mo) for active agents, and Team ($199/mo) for brokerages. Every plan includes risk profiles, carrier availability, and saved properties.',
    bullets: [
      { icon: CheckCircle2, label: 'Individual · $29/mo', desc: '10 searches, risk profiles, carrier lookup, 10 saved properties.' },
      { icon: CheckCircle2, label: 'Professional · $79/mo', desc: '100 searches, binding quotes, client dashboard, compare, analytics.' },
      { icon: CheckCircle2, label: 'Team · $199/mo', desc: 'Unlimited seats, team workflows, priority support, and onboarding.' },
    ],
  },
  {
    id: 'investors',
    eyebrow: 'Investors',
    title: 'Rebuilding the insurability layer of real estate.',
    body: 'Insurance is now the #1 reason deals die at closing. CoverGuard sits between the agent, the risk data, and the carriers to make insurability a pre-offer signal — not a post-contract surprise.',
    bullets: [
      { icon: TrendingUp, label: 'Massive tailwind', desc: 'Carrier retreats are expanding the addressable pain every quarter.' },
      { icon: Users, label: 'Trusted wedge', desc: 'Agents are the decision-makers who control the property flow.' },
      { icon: BarChart3, label: 'Data moat', desc: 'Proprietary carrier-writing signal built on top of public risk data.' },
    ],
  },
  {
    id: 'careers',
    eyebrow: 'Careers',
    title: 'Build the future of property intelligence.',
    body: 'We are a small, remote-first team building the platform that agents, buyers, and lenders rely on before every major real estate decision.',
    bullets: [
      { icon: Briefcase, label: 'Remote-first', desc: 'Work from anywhere in the US; quarterly in-person gatherings.' },
      { icon: TrendingUp, label: 'Move fast', desc: 'Ship weekly, own features end-to-end, see them in production.' },
      { icon: CheckCircle2, label: 'Full package', desc: 'Competitive salary, equity, benefits, and home-office stipend.' },
    ],
  },
]

const resourcesSections: AnchorSection[] = [
  {
    id: 'docs',
    eyebrow: 'Documentation',
    title: 'Everything you need to get the most from CoverGuard.',
    body: 'Guides, tutorials, and reference material covering account setup, risk report interpretation, carrier appetite, and binding quote workflows.',
    bullets: [
      { icon: BookOpen, label: 'Getting started', desc: 'Run your first search and read your first risk report in five minutes.' },
      { icon: FileText, label: 'Knowledge base', desc: 'Deep dives on flood zones, fire scores, and carrier appetite.' },
      { icon: Code2, label: 'API reference', desc: 'Integrate CoverGuard data into your own applications.' },
    ],
  },
  {
    id: 'api-reference',
    eyebrow: 'API Reference',
    title: 'Property insurability data, in your stack.',
    body: 'A RESTful API for risk profiles, carrier availability, and quote workflows. Authenticated, versioned, and rate-limited by plan.',
    bullets: [
      { icon: Code2, label: 'GET /v1/properties/:id/risk', desc: 'Composite risk profile: flood, fire, wind, earthquake, crime.' },
      { icon: Code2, label: 'GET /v1/properties/:id/carriers', desc: 'List carriers writing coverage with appetite indicators.' },
      { icon: Code2, label: 'POST /v1/searches', desc: 'Submit a property search by address or coordinates.' },
    ],
  },
  {
    id: 'blog',
    eyebrow: 'Blog',
    title: 'Insights on insurance, risk, and real estate technology.',
    body: 'Field notes from the CoverGuard team on how insurability is reshaping how agents price, negotiate, and close deals.',
    bullets: [
      { icon: FileText, label: 'Pre-offer checks', desc: 'How running an insurability report before the offer saves deals.' },
      { icon: FileText, label: 'Flood zones explained', desc: 'Plain-English guide to FEMA A, V, and X designations.' },
      { icon: FileText, label: 'Carrier appetite 2026', desc: 'Which carriers are expanding or contracting this year.' },
    ],
  },
  {
    id: 'contact',
    eyebrow: 'Contact',
    title: 'Talk to the CoverGuard team.',
    body: 'Questions about the platform, enterprise plans, or partnerships — we would love to hear from you.',
    bullets: [
      { icon: Mail, label: 'hello@coverguard.io', desc: 'General inquiries and support.' },
      { icon: Mail, label: 'sales@coverguard.io', desc: 'Enterprise plans and integrations.' },
      { icon: BookOpen, label: 'Austin, TX', desc: 'CoverGuard, Inc. headquarters.' },
    ],
  },
]

const legalSections: AnchorSection[] = [
  {
    id: 'privacy',
    eyebrow: 'Privacy Policy',
    title: 'How we handle your data.',
    body: 'We collect only the information needed to deliver risk reports and manage your account: email, property searches, saved properties, and client records you choose to store. We do not sell personal information.',
    bullets: [
      { icon: Lock, label: 'Data we collect', desc: 'Account info, searches, saved properties, support requests.' },
      { icon: Shield, label: 'How we use it', desc: 'To deliver risk reports, improve the product, and contact you.' },
      { icon: Eye, label: 'Your rights', desc: 'Access, correct, and delete your data at any time.' },
    ],
  },
  {
    id: 'terms',
    eyebrow: 'Terms of Service',
    title: 'The ground rules.',
    body: 'CoverGuard is a decision-support tool. Risk profiles and carrier availability are provided as-is based on public data and carrier signals; final coverage decisions rest with the carriers.',
    bullets: [
      { icon: FileText, label: 'Acceptable use', desc: 'Use CoverGuard only for legitimate real estate activities.' },
      { icon: FileText, label: 'No guarantees', desc: 'Risk reports inform decisions; they do not bind coverage.' },
      { icon: FileText, label: 'Account responsibility', desc: 'Keep your credentials secure; you are responsible for account activity.' },
    ],
  },
  {
    id: 'security',
    eyebrow: 'Security',
    title: 'Enterprise-grade security from day one.',
    body: 'CoverGuard runs on SOC 2-compliant infrastructure with encryption in transit and at rest, role-based access, and least-privilege controls across every system.',
    bullets: [
      { icon: Lock, label: 'Encryption', desc: 'TLS 1.3 in transit; AES-256 at rest; encrypted backups.' },
      { icon: Server, label: 'Infrastructure', desc: 'Vercel + Supabase with DDoS protection and 99.9% uptime.' },
      { icon: Eye, label: 'Access controls', desc: 'Role-based access, row-level security, OAuth 2.0 auth.' },
    ],
  },
]

function AnchorBlock({ section }: { section: AnchorSection }) {
  return (
    <div id={section.id} className="scroll-mt-28 border-t border-gray-100 first:border-t-0 py-16">
      <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
        {section.eyebrow}
      </p>
      <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 max-w-3xl">
        {section.title}
      </h3>
      <p className="mt-4 text-lg text-gray-600 max-w-3xl leading-relaxed">{section.body}</p>
      {section.bullets && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {section.bullets.map((b) => (
            <div
              key={b.label}
              className="rounded-xl border border-gray-200 p-5 hover:border-brand-200 transition-colors"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <b.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-semibold text-gray-900">{b.label}</p>
              <p className="mt-1 text-sm text-gray-600 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryBand({
  label,
  title,
  sections,
  bgClass = 'bg-white',
}: {
  label: string
  title: string
  sections: AnchorSection[]
  bgClass?: string
}) {
  return (
    <section className={`py-20 ${bgClass}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">{label}</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900 max-w-3xl">{title}</h2>
        <div className="mt-8">
          {sections.map((s) => (
            <AnchorBlock key={s.id} section={s} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default function AgentsPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-gradient-to-b from-brand-50/50 via-white to-white overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-4 py-1.5 mb-8">
              <span className="text-sm font-medium text-brand-700">For Real Estate Agents</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
              The insurance check your clients deserve —
              <span className="text-brand-600"> before they make an offer</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl leading-relaxed">
              With State Farm, Allstate, and Farmers exiting major markets, insurance is now the #1
              reason deals fall through at closing. CoverGuard surfaces those risks before your
              client is under contract.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/25"
              >
                Check a Property Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Calendar className="h-4 w-4" />
                Book a Demo
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              Free to start · No credit card required · Results in 90 seconds
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Win more deals by knowing more, sooner
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Insurance surprises kill deals. CoverGuard puts the insurability intelligence in
                your hands before you write the offer — so you can close with confidence.
              </p>
              <ul className="mt-8 space-y-4">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-brand-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-brand-50 rounded-3xl p-8 border border-brand-100">
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <p className="text-sm font-semibold text-brand-600 uppercase tracking-wider">
                    Before CoverGuard
                  </p>
                  <p className="mt-2 text-gray-700">
                    &quot;We&apos;re three days from closing and the buyer just found out State Farm
                    won&apos;t write the property. Deal is dead.&quot;
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-brand-200">
                  <p className="text-sm font-semibold text-green-600 uppercase tracking-wider">
                    After CoverGuard
                  </p>
                  <p className="mt-2 text-gray-700">
                    &quot;I ran the insurability check before we made the offer. Two carriers were
                    writing — we went in knowing exactly what coverage would cost.&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CategoryBand
        label="Product"
        title="Everything CoverGuard does for you"
        sections={productSections}
      />
      <CategoryBand
        label="Company"
        title="About CoverGuard"
        sections={companySections}
        bgClass="bg-gray-50"
      />
      <CategoryBand
        label="Resources"
        title="Learn, integrate, reach out"
        sections={resourcesSections}
      />
      <CategoryBand
        label="Legal"
        title="Our commitments to you"
        sections={legalSections}
        bgClass="bg-gray-50"
      />

      <section className="py-20 bg-brand-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Start protecting your deals today
          </h2>
          <p className="mt-4 text-lg text-brand-200 max-w-2xl mx-auto">
            Join 500+ agents already running pre-offer insurability checks across 38 states.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/get-started"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
            >
              Check a Property Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <AgentMarketingFooter />
    </div>
  )
}
