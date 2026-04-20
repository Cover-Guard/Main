'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  MarketingNav,
  MarketingFooter,
  HelpAdvisorPanel,
} from '@/components/marketing'
import { ReleaseNotes } from '@/components/release-notes'
import {
  Search,
  Sparkles,
  Rocket,
  Map as MapIcon,
  FileText,
  ShieldCheck,
  Users,
  CreditCard,
  ChevronDown,
  Mail,
  MessageSquare,
  Send,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  BookOpen,
} from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const gettingStartedSteps = [
  {
    icon: Rocket,
    title: '1. Create your account',
    body: 'Sign up with your work email. Choose your role — agent, broker, buyer, or lender — so CoverGuard can tailor your dashboard.',
    href: '/get-started',
    cta: 'Start signup',
  },
  {
    icon: MapIcon,
    title: '2. Run your first property search',
    body: 'Enter an address to see flood, fire, wind, and earthquake risk scores, plus carrier availability in seconds.',
    href: '/search',
    cta: 'Open search',
  },
  {
    icon: FileText,
    title: '3. Generate an insurability report',
    body: 'Export a branded PDF with risk scores, carrier matches, and recommendations you can share with clients.',
    href: '/reports',
    cta: 'See a sample report',
  },
  {
    icon: Users,
    title: '4. Invite your team',
    body: 'Add teammates, share saved properties, and collaborate on client portfolios from one workspace.',
    href: '/account',
    cta: 'Manage team',
  },
]

type Article = {
  title: string
  description: string
  category: 'Getting Started' | 'Risk Scores' | 'Carriers' | 'Reports' | 'Account & Billing' | 'API'
  href: string
}

const articles: Article[] = [
  {
    title: 'Understanding flood risk scores',
    description: 'How CoverGuard calculates flood risk using FEMA zones, elevation, and historical claims.',
    category: 'Risk Scores',
    href: '/docs',
  },
  {
    title: 'Reading your fire risk report',
    description: 'What a Fire Score of 72 means, how WUI proximity factors in, and what mitigation credits apply.',
    category: 'Risk Scores',
    href: '/docs',
  },
  {
    title: 'How carrier appetite matching works',
    description: 'The logic behind which carriers show up for a property and how to interpret match confidence.',
    category: 'Carriers',
    href: '/docs',
  },
  {
    title: 'Surplus lines vs. admitted carriers',
    description: 'When to recommend an E&S carrier, what extra disclosures apply, and how to explain it to buyers.',
    category: 'Carriers',
    href: '/docs',
  },
  {
    title: 'Generating a client-ready PDF report',
    description: 'Customize branding, add notes, and export insurability reports you can hand to a buyer or lender.',
    category: 'Reports',
    href: '/reports',
  },
  {
    title: 'Sharing a report with a teammate',
    description: 'Send reports inside your workspace or via a secure public link that expires after 30 days.',
    category: 'Reports',
    href: '/reports',
  },
  {
    title: 'Changing your subscription plan',
    description: 'Upgrade, downgrade, or cancel your CoverGuard plan and what happens to your saved properties.',
    category: 'Account & Billing',
    href: '/pricing',
  },
  {
    title: 'Managing teammates and permissions',
    description: 'Invite teammates, assign roles, and control who can view or edit each client portfolio.',
    category: 'Account & Billing',
    href: '/account',
  },
  {
    title: 'Quickstart: your first property search',
    description: 'A five-minute walkthrough from signup to your first risk report.',
    category: 'Getting Started',
    href: '/get-started',
  },
  {
    title: 'Importing a list of properties',
    description: 'Upload a CSV of addresses to bulk-score your pipeline and track insurability over time.',
    category: 'Getting Started',
    href: '/dashboard',
  },
  {
    title: 'Using the CoverGuard API',
    description: 'Authenticate, pull risk scores programmatically, and integrate CoverGuard into your CRM.',
    category: 'API',
    href: '/api-reference',
  },
  {
    title: 'Webhook events and integrations',
    description: 'Subscribe to property updates, carrier changes, and report events in real time.',
    category: 'API',
    href: '/api-reference',
  },
]

const faqs = [
  {
    q: 'What is CoverGuard and who is it for?',
    a: 'CoverGuard is a property insurability platform for real estate agents, brokers, buyers, and lenders. We combine flood, fire, wind, and earthquake risk data with live carrier appetite so you can tell — in seconds — whether a property is insurable and which carriers will write it.',
  },
  {
    q: 'Where does your risk data come from?',
    a: 'We combine authoritative public data (FEMA flood maps, USGS, Cal Fire, NOAA) with proprietary carrier appetite data, historical claims, and parcel-level attributes. All sources are cited in every report.',
  },
  {
    q: 'How accurate are the insurability scores?',
    a: 'Scores reflect current carrier availability and are updated continuously. They are decision support — not a binding quote. We recommend confirming final terms with the carrier or wholesaler before closing.',
  },
  {
    q: 'Can I share reports with clients and lenders?',
    a: 'Yes. Every insurability report can be exported as a branded PDF or shared via a secure link that expires after 30 days. Reports include your logo, contact info, and optional notes.',
  },
  {
    q: 'Is there an API?',
    a: 'Yes — the CoverGuard API lets you pull risk scores and carrier matches directly into your CRM or transaction platform. See the API reference for authentication, endpoints, and rate limits.',
  },
  {
    q: 'What does it cost?',
    a: 'CoverGuard offers free and paid tiers. Individual agents can start free; teams, brokerages, and lenders can upgrade for bulk search, API access, and white-label reports. See the pricing page for current plans.',
  },
  {
    q: 'How do I cancel or change my plan?',
    a: 'You can change or cancel your plan anytime from Account → Billing. Downgrades take effect at the next billing cycle and your saved properties remain accessible on the free tier.',
  },
  {
    q: 'Is my data secure?',
    a: "Yes. CoverGuard is SOC 2 aligned, uses TLS in transit and AES-256 at rest, and never sells customer data. See our Security page for details.",
  },
]

const categories: Array<Article['category'] | 'All'> = [
  'All',
  'Getting Started',
  'Risk Scores',
  'Carriers',
  'Reports',
  'Account & Billing',
  'API',
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Article['category'] | 'All'>('All')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter((a) => {
      const matchesCategory = activeCategory === 'All' || a.category === activeCategory
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [query, activeCategory])

  // Contact form state
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('submitting')
    setErrorMsg('')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      topic: (form.elements.namedItem('topic') as HTMLSelectElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
      source: 'help',
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
      setErrorMsg('Something went wrong. Please email us directly at support@coverguard.io')
    }
  }

  return (
    <>
      <MarketingNav />
      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-gradient-to-b from-brand-50/60 via-white to-white pt-32 pb-12 sm:pt-40 sm:pb-16">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              <Sparkles className="h-3.5 w-3.5" />
              AI Advisor is your first stop
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              How can we help?
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-600">
              Ask the CoverGuard AI Advisor, search our knowledge base, or browse guides. Real humans
              are a click away if you need them.
            </p>

            {/* Search bar */}
            <div className="mx-auto mt-8 max-w-2xl">
              <label htmlFor="help-search" className="sr-only">
                Search the help center
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="help-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for 'flood score', 'export report', 'API keys'…"
                  className="w-full rounded-xl border border-gray-300 bg-white py-3.5 pl-12 pr-4 text-base text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </div>
            </div>
          </div>
        </section>

        {/* AI Advisor — primary helper */}
        <section id="ai-advisor" className="mx-auto max-w-5xl px-4 pb-8 sm:pb-12 -mt-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ask the AI Advisor</h2>
              <p className="mt-1 text-sm text-gray-600">
                Instant, conversational answers about CoverGuard, risk scores, and carriers — available
                24/7.
              </p>
            </div>
          </div>
          <HelpAdvisorPanel />
          <p className="mt-3 text-center text-xs text-gray-500">
            The AI Advisor can make mistakes. For binding quotes or account changes, use the contact
            form below.
          </p>
        </section>

        {/* Getting Started */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Getting started</h2>
            <p className="mt-2 text-gray-600">Four steps to your first insurability report.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {gettingStartedSteps.map((step) => (
              <div
                key={step.title}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 hover:shadow-lg transition-shadow"
              >
                <step.icon className="h-8 w-8 text-brand-600" />
                <h3 className="mt-4 text-base font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600">{step.body}</p>
                <Link
                  href={step.href}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Searchable articles */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Knowledge base</h2>
                <p className="mt-2 text-gray-600">
                  {filteredArticles.length} article{filteredArticles.length === 1 ? '' : 's'}
                  {query ? ` matching "${query}"` : ''}
                  {activeCategory !== 'All' ? ` in ${activeCategory}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const active = cat === activeCategory
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-brand-400 hover:text-brand-700'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            {filteredArticles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-3 text-sm font-medium text-gray-900">No articles matched your search.</p>
                <p className="mt-1 text-sm text-gray-600">
                  Try a different keyword, or ask the{' '}
                  <a href="#ai-advisor" className="font-medium text-brand-600 hover:text-brand-700">
                    AI Advisor
                  </a>{' '}
                  directly.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredArticles.map((a) => (
                  <Link
                    key={a.title}
                    href={a.href}
                    className="group flex flex-col rounded-xl border border-gray-200 bg-white p-5 hover:border-brand-300 hover:shadow-md transition-all"
                  >
                    <span className="inline-flex w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      {a.category}
                    </span>
                    <h3 className="mt-3 text-base font-semibold text-gray-900 group-hover:text-brand-700">
                      {a.title}
                    </h3>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-600">{a.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                      Read article <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Frequently asked questions</h2>
            <p className="mt-2 text-gray-600">
              Can&apos;t find what you&apos;re looking for? Ask the{' '}
              <a href="#ai-advisor" className="font-medium text-brand-600 hover:text-brand-700">
                AI Advisor
              </a>
              .
            </p>
          </div>
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
            {faqs.map((item, i) => {
              const open = openFaq === i
              return (
                <div key={item.q}>
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50"
                    aria-expanded={open}
                  >
                    <span className="text-sm font-semibold text-gray-900 sm:text-base">{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {open && (
                    <div className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{item.a}</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Release notes — what's new, pulled from merged PRs */}
        <section id="release-notes" className="mx-auto max-w-5xl px-4 py-16">
          <ReleaseNotes
            owner="Cover-Guard"
            repo="Main"
            baseBranch="main"
            variant="page"
          />
        </section>

        {/* Contact / support form */}
        <section id="contact" className="bg-gray-50 py-20">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Still need help?</h2>
              <p className="mt-2 text-gray-600">
                Our team replies within one business day. For urgent account issues, email us directly.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-5">
              {/* Channels */}
              <div className="space-y-4 lg:col-span-2">
                <a
                  href="mailto:support@coverguard.io"
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <Mail className="h-6 w-6 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Support email</p>
                    <p className="mt-0.5 text-sm text-gray-600">support@coverguard.io</p>
                    <p className="mt-1 text-xs text-gray-500">Account, billing, and bug reports</p>
                  </div>
                </a>
                <a
                  href="mailto:sales@coverguard.io"
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <MessageSquare className="h-6 w-6 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Talk to sales</p>
                    <p className="mt-0.5 text-sm text-gray-600">sales@coverguard.io</p>
                    <p className="mt-1 text-xs text-gray-500">Team plans, API, and integrations</p>
                  </div>
                </a>
                <Link
                  href="/security"
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <ShieldCheck className="h-6 w-6 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Security & compliance</p>
                    <p className="mt-0.5 text-sm text-gray-600">security@coverguard.io</p>
                    <p className="mt-1 text-xs text-gray-500">Report a vulnerability or request docs</p>
                  </div>
                </Link>
                <Link
                  href="/pricing"
                  className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
                >
                  <CreditCard className="h-6 w-6 text-brand-600" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Billing questions</p>
                    <p className="mt-0.5 text-sm text-gray-600">View plans and pricing</p>
                    <p className="mt-1 text-xs text-gray-500">Upgrade, downgrade, or request a refund</p>
                  </div>
                </Link>
              </div>

              {/* Form */}
              <div className="lg:col-span-3">
                {formState === 'success' ? (
                  <div className="rounded-xl border border-green-200 bg-white p-8 text-center">
                    <CheckCircle className="mx-auto h-10 w-10 text-green-600" />
                    <h3 className="mt-4 text-lg font-semibold text-gray-900">Message sent!</h3>
                    <p className="mt-2 text-gray-600">
                      Thanks for reaching out. We&apos;ll get back to you within one business day.
                    </p>
                    <button
                      onClick={() => setFormState('idle')}
                      className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleContactSubmit}
                    className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8 space-y-5"
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="help-name" className="block text-sm font-medium text-gray-700">
                          Full name
                        </label>
                        <input
                          type="text"
                          id="help-name"
                          name="name"
                          required
                          autoComplete="name"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="Jane Smith"
                        />
                      </div>
                      <div>
                        <label htmlFor="help-email" className="block text-sm font-medium text-gray-700">
                          Work email
                        </label>
                        <input
                          type="email"
                          id="help-email"
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
                        <label
                          htmlFor="help-company"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Company <span className="text-gray-400">(optional)</span>
                        </label>
                        <input
                          type="text"
                          id="help-company"
                          name="company"
                          autoComplete="organization"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                          placeholder="Acme Realty"
                        />
                      </div>
                      <div>
                        <label htmlFor="help-topic" className="block text-sm font-medium text-gray-700">
                          Topic
                        </label>
                        <select
                          id="help-topic"
                          name="topic"
                          defaultValue="general"
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                        >
                          <option value="general">General question</option>
                          <option value="account">Account or login</option>
                          <option value="billing">Billing</option>
                          <option value="bug">Report a bug</option>
                          <option value="data">Data or risk score issue</option>
                          <option value="api">API / integrations</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="help-message" className="block text-sm font-medium text-gray-700">
                        How can we help?
                      </label>
                      <textarea
                        id="help-message"
                        name="message"
                        rows={5}
                        required
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-brand-500"
                        placeholder="Tell us what's going on — include an address or report ID if relevant."
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
                      {formState === 'submitting' ? 'Sending…' : 'Send message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  )
}
