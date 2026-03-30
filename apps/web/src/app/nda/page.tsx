import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'

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

          <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Parties</h2>
              <p>
                This Non-Disclosure Agreement (&ldquo;Agreement&rdquo;) is entered into between CoverGuard, Inc.
                (&ldquo;CoverGuard,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) and the individual or entity accessing or
                using the CoverGuard platform (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;). By creating an account
                or accessing the Platform, you agree to the terms of this Agreement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Definition of Confidential Information</h2>
              <p>
                &ldquo;Confidential Information&rdquo; means any non-public information disclosed by CoverGuard to
                User through the Platform, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Proprietary risk scoring methodologies and algorithms</li>
                <li>Carrier availability data and writing status intelligence</li>
                <li>Underwriting intelligence and market condition assessments</li>
                <li>Property insurability assessments and scoring models</li>
                <li>Pricing models and premium estimation methodologies</li>
                <li>Aggregated market data and carrier relationship information</li>
                <li>Platform source code, technical architecture, and infrastructure details</li>
                <li>Business strategies, partnerships, and non-public product roadmaps</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Obligations of Receiving Party</h2>
              <p>User agrees to:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Hold all Confidential Information in strict confidence</li>
                <li>Not disclose Confidential Information to any third party without prior written consent from CoverGuard</li>
                <li>Use Confidential Information solely for lawful property research purposes and personal or professional decision-making</li>
                <li>Take reasonable measures to protect the confidentiality of information, using at least the same degree of care used to protect their own confidential information</li>
                <li>Promptly notify CoverGuard of any unauthorized disclosure or use of Confidential Information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Exclusions</h2>
              <p>Confidential Information does not include information that:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Is or becomes publicly available through no fault of the User</li>
                <li>Was known to the User prior to disclosure by CoverGuard, as evidenced by written records</li>
                <li>Is independently developed by the User without use of or reference to the Confidential Information</li>
                <li>Is disclosed with the prior written approval of CoverGuard</li>
                <li>Is required to be disclosed by law, regulation, or court order, provided that the User gives CoverGuard prompt written notice to allow CoverGuard to seek a protective order</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Term and Duration</h2>
              <p>
                This Agreement is effective upon your first access to the Platform and shall remain in effect
                for a period of five (5) years following the termination of your access to the Platform,
                regardless of the reason for termination. The confidentiality obligations under this Agreement
                survive expiration or termination.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Remedies</h2>
              <p>
                User acknowledges that any breach of this Agreement may cause irreparable harm to CoverGuard
                for which monetary damages may be inadequate. Accordingly, CoverGuard shall be entitled to
                seek equitable relief, including injunction and specific performance, in addition to all other
                remedies available at law or in equity, without the requirement of posting a bond.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. No License</h2>
              <p>
                Nothing in this Agreement grants User any rights in or to the Confidential Information,
                except the limited right to use it as described herein. All Confidential Information remains
                the sole and exclusive property of CoverGuard.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Governing Law</h2>
              <p>
                This Agreement shall be governed by and construed in accordance with the laws of the State of
                Delaware, without regard to its conflict of laws principles. Any disputes arising under this
                Agreement shall be resolved in the state or federal courts located in Delaware.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact</h2>
              <p>
                If you have questions about this Agreement, please contact us at{' '}
                <a href="mailto:legal@coverguard.com" className="text-brand-600 hover:underline">legal@coverguard.com</a>.
              </p>
            </section>
          </div>
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
