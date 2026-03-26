import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Building2, User, ArrowRight } from 'lucide-react'
import { CoverGuardShield } from '@/components/icons/CoverGuardShield'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Started — CoverGuard',
  description: 'Choose how you want to use CoverGuard — as an insurance agent or an individual home buyer.',
}

export default async function GetStartedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 via-white to-white flex flex-col">
      {/* Header */}
      <header className="pt-10 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <CoverGuardShield className="h-9 w-9" />
          <span className="text-xl font-bold text-gray-900">CoverGuard</span>
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              How would you like to use CoverGuard?
            </h1>
            <p className="mt-3 text-lg text-gray-600">
              Select your account type to get started
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Agent Card */}
            <Link
              href="/agents/login"
              className="group relative rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-brand-500 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 group-hover:bg-brand-100 transition-colors mb-5">
                  <Building2 className="h-8 w-8 text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Agent</h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  For real estate agents, brokers, and lenders who need client management, property comparison, and analytics.
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 group-hover:gap-2.5 transition-all">
                  Continue as Agent
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* Individual Card */}
            <Link
              href="/login"
              className="group relative rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-brand-500 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-50 group-hover:bg-brand-100 transition-colors mb-5">
                  <User className="h-8 w-8 text-brand-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Individual</h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  For home buyers and homeowners looking to check property risks, insurance costs, and get quotes.
                </p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 group-hover:gap-2.5 transition-all">
                  Continue as Individual
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-gray-500">
            Not sure?{' '}
            <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Individual accounts
            </Link>{' '}
            work great for most users.
          </p>
        </div>
      </main>
    </div>
  )
}
