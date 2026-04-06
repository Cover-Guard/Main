import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import NDAContent from '@/components/auth/NDAContent'

export const metadata: Metadata = { title: 'Non-Disclosure Agreement — CoverGuard' }

export default function NDAPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 text-brand-700">
          <Shield className="h-8 w-8" />
          <span className="text-2xl font-bold">CoverGuard</span>
        </div>

        <div className="card p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Non-Disclosure Agreement</h1>
          <p className="mb-8 text-sm text-gray-500">Last updated: March 26, 2026</p>

          <NDAContent className="prose prose-sm max-w-none text-gray-600 space-y-6 [&_h3]:text-lg [&_h3]:mb-2" />
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
            &larr; Back to CoverGuard
          </Link>
        </div>
      </div>
    </div>
  )
}
