import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { FooterPagesNav } from '@/components/marketing'

export const metadata: Metadata = { title: 'Terms of Use — CoverGuard' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <FooterPagesNav offsetNav={false} />
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 text-brand-700">
          <Shield className="h-8 w-8" />
          <span className="text-2xl font-bold">CoverGuard</span>
        </div>

        <div className="card p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms of Use</h1>
          <p className="mb-8 text-sm text-gray-500">Last updated: March 26, 2026</p>

          <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing or using CoverGuard (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Use
                (&ldquo;Terms&rdquo;), our{' '}
                <a href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</a>, and any
                supplemental terms presented during registration. If you do not agree to these Terms, do not
                use the Platform. These Terms apply to all visitors, users, and others who access or use the Platform.
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
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. User Accounts &amp; Authentication</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all
                activities that occur under your account. You agree to: (a) create only one account per
                individual; (b) provide accurate, current, and complete registration information; (c) use a
                strong, unique password of at least eight characters; (d) enable multi-factor authentication
                where available; and (e) notify us immediately at{' '}
                <a href="mailto:security@coverguard.com" className="text-brand-600 hover:underline">
                  security@coverguard.com
                </a>{' '}
                upon discovering any unauthorized use or suspected compromise of your account. CoverGuard is
                not liable for any loss or damage arising from your failure to maintain account security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Acceptable Use</h2>
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Use the Platform for any unlawful purpose or in violation of any applicable laws or regulations</li>
                <li>Systematically scrape, crawl, extract, or redistribute data from the Platform through automated means</li>
                <li>Resell, sublicense, or commercialize any data obtained from the Platform without our prior written consent</li>
                <li>Attempt to reverse-engineer, decompile, or circumvent any security measures, access controls, or technical protections</li>
                <li>Probe, scan, or test the vulnerability of the Platform or any connected system or network</li>
                <li>Introduce malicious code, viruses, or any other harmful technology</li>
                <li>Use the Platform to harass, harm, or discriminate against any individual</li>
                <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity</li>
                <li>Share, transfer, or otherwise make your account credentials available to any other person</li>
              </ul>
              <p className="mt-2">
                Violation of this Acceptable Use policy may result in immediate suspension or termination of
                your account, and we reserve the right to report violations to applicable law enforcement authorities.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Data Accuracy</h2>
              <p>
                CoverGuard makes reasonable efforts to provide accurate and current information, but makes
                no warranties or representations regarding the accuracy, completeness, or timeliness of any
                data on the Platform. Risk scores and insurance estimates are derived from third-party data
                sources that may be incomplete, outdated, or inaccurate for specific locations. You acknowledge
                that all data is provided for informational purposes and should be independently verified
                before making any decision.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Confidentiality &amp; Data Protection</h2>
              <p>
                We treat all non-public information you provide through the Platform as confidential and handle
                it in accordance with our{' '}
                <a href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</a>.
                You agree to treat all proprietary data, risk scoring methodologies, carrier intelligence, and
                non-public information made available to you through the Platform as confidential and to not
                disclose such information to any third party without our prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Intellectual Property</h2>
              <p>
                The Platform and its original content, features, functionality, risk scoring algorithms, and
                data models are owned by CoverGuard, Inc. and are protected by copyright, trademark, trade
                secret, and other intellectual property laws. You may not reproduce, distribute, modify, or
                create derivative works without our express written permission. You retain ownership of any
                data you submit to the Platform, and grant us a limited license to use that data solely to
                provide and improve the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Service Availability</h2>
              <p>
                We use commercially reasonable efforts to maintain the availability of the Platform. However,
                we do not guarantee uninterrupted or error-free access. The Platform may be temporarily
                unavailable due to scheduled maintenance, system upgrades, or circumstances beyond our
                reasonable control. We will make reasonable efforts to provide advance notice of planned
                downtime when feasible.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by applicable law, CoverGuard, Inc., its officers, directors,
                employees, and agents shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages, including but not limited to loss of profits, data, goodwill, or other
                intangible losses, arising from your use of or inability to use the Platform, even if advised
                of the possibility of such damages. In no event shall our total aggregate liability exceed
                the greater of (a) the amounts paid by you to CoverGuard in the twelve (12) months preceding
                the claim, or (b) one hundred dollars ($100).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Disclaimer of Warranties</h2>
              <p>
                The Platform is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without any warranties of any
                kind, express or implied, including but not limited to warranties of merchantability, fitness
                for a particular purpose, non-infringement, or accuracy of data. CoverGuard does not warrant
                that the Platform will be secure, error-free, or available at all times.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless CoverGuard, Inc. and its officers, directors,
                employees, and agents from and against any claims, liabilities, damages, losses, and expenses
                (including reasonable attorneys&apos; fees) arising out of or related to: (a) your use of or access
                to the Platform; (b) your violation of these Terms; (c) your violation of any third-party right,
                including any intellectual property or privacy right; or (d) any claim that your actions caused
                damage to a third party.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Termination</h2>
              <p>
                We reserve the right to terminate or suspend your account and access to the Platform at our
                sole discretion, with or without notice, for conduct that we believe violates these Terms, is
                harmful to other users or the Platform, or for any other reason. Upon termination, your right
                to use the Platform ceases immediately. You may delete your account at any time through Account
                Settings. Sections 7, 8, 10, 11, 12, 14, and 15 survive termination of these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Governing Law &amp; Dispute Resolution</h2>
              <p>
                These Terms are governed by the laws of the State of Delaware, without regard to conflict of
                law principles. Any dispute arising out of or relating to these Terms or the Platform shall
                first be submitted to good-faith mediation. If mediation is unsuccessful, disputes shall be
                resolved in the state or federal courts located in Wilmington, Delaware, and you consent to
                the exclusive jurisdiction of those courts.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">15. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of material
                changes by updating the &ldquo;Last updated&rdquo; date, sending an email to the address associated
                with your account, and, where required by law, obtaining your renewed consent. Your continued
                use of the Platform after the effective date of any changes constitutes acceptance of the
                revised Terms. If you do not agree to the updated Terms, you must discontinue use of the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">16. Severability</h2>
              <p>
                If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions
                shall continue in full force and effect. The invalid or unenforceable provision shall be modified
                to the minimum extent necessary to make it valid and enforceable.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">17. Contact Us</h2>
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
