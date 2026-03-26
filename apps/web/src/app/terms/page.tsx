import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'

export const metadata: Metadata = { title: 'Terms of Use — CoverGuard' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 text-brand-700">
          <Shield className="h-8 w-8" />
          <span className="text-2xl font-bold">CoverGuard</span>
        </div>

        <div className="card p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms of Use</h1>
          <p className="mb-8 text-sm text-gray-500">Last updated: January 1, 2025</p>

          <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using CoverGuard (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Use
                (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Platform. These Terms apply to all
                visitors, users, and others who access or use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Description of Service</h2>
              <p>
                CoverGuard provides property risk intelligence and insurance information tools for real estate
                professionals, lenders, and home buyers. The Platform aggregates publicly available data from
                sources including FEMA, USGS, Cal Fire, and FBI Crime Data to provide risk assessments,
                insurance cost estimates, and carrier availability information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Informational Use Only</h2>
              <p>
                All information provided on CoverGuard is for informational and educational purposes only.
                Nothing on the Platform constitutes:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>A binding insurance quote, offer, or contract</li>
                <li>Professional insurance, financial, or legal advice</li>
                <li>A guarantee of coverage availability or pricing</li>
                <li>An endorsement of any particular insurance carrier or product</li>
              </ul>
              <p className="mt-2">
                You should consult a licensed insurance professional before making any insurance or real estate decision.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. User Accounts</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all
                activities that occur under your account. You agree to notify us immediately of any unauthorized
                use of your account. CoverGuard is not liable for any loss or damage arising from your failure
                to maintain account security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Use the Platform for any unlawful purpose or in violation of any regulations</li>
                <li>Systematically scrape, extract, or redistribute data from the Platform</li>
                <li>Resell or commercialize any data obtained from the Platform without written consent</li>
                <li>Attempt to reverse-engineer or circumvent any security measures</li>
                <li>Use the Platform to harass, harm, or discriminate against any individual</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Accuracy</h2>
              <p>
                CoverGuard makes reasonable efforts to provide accurate and current information, but makes
                no warranties or representations regarding the accuracy, completeness, or timeliness of any
                data on the Platform. Risk scores and insurance estimates are derived from third-party data
                that may be incomplete, outdated, or inaccurate for specific locations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Intellectual Property</h2>
              <p>
                The Platform and its original content, features, and functionality are owned by CoverGuard, Inc.
                and are protected by copyright, trademark, and other intellectual property laws. You may not
                reproduce, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, CoverGuard, Inc. shall not be liable for any indirect,
                incidental, special, consequential, or punitive damages arising from your use of or inability
                to use the Platform, even if advised of the possibility of such damages.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Disclaimer of Warranties</h2>
              <p>
                The Platform is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without any warranties of any
                kind, express or implied, including but not limited to warranties of merchantability, fitness
                for a particular purpose, or non-infringement.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Termination</h2>
              <p>
                We reserve the right to terminate or suspend your account and access to the Platform at our
                sole discretion, without notice, for conduct that we believe violates these Terms or is harmful
                to other users, the Platform, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the State of Delaware, without regard to conflict of
                law principles. Any disputes shall be resolved in the courts of the State of Delaware.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of material
                changes by updating the &ldquo;Last updated&rdquo; date and, where appropriate, providing additional
                notice. Your continued use of the Platform after changes constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Contact Us</h2>
              <p>
                If you have questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@coverguard.com" className="text-brand-600 hover:underline">
                  legal@coverguard.com
                </a>
                .
              </p>
            </section>
          </div>

          <div className="mt-10 border-t border-gray-200 pt-6 flex flex-wrap gap-4">
            <Link href="/privacy" className="text-sm text-brand-600 hover:underline">Privacy Policy</Link>
            <Link href="/login" className="text-sm text-gray-500 hover:underline">← Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
