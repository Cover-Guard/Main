import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'

export const metadata: Metadata = { title: 'Privacy Policy — CoverGuard' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 text-brand-700">
          <Shield className="h-8 w-8" />
          <span className="text-2xl font-bold">CoverGuard</span>
        </div>

        <div className="card p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mb-8 text-sm text-gray-500">Last updated: January 1, 2025</p>

          <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
              <p>
                CoverGuard, Inc. (&ldquo;CoverGuard,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy and is
                committed to protecting your personal information. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
              <p>We collect the following types of information:</p>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium text-gray-700">Account Information</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Name, email address, and password</li>
                    <li>Company name and license number (for agents and lenders)</li>
                    <li>Account role and preferences</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Usage Data</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Property searches and viewed addresses</li>
                    <li>Saved properties, notes, and tags</li>
                    <li>Quote requests submitted through the platform</li>
                    <li>Feature usage and navigation patterns</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Technical Data</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>IP address, browser type, and device information</li>
                    <li>Log data including access times and pages visited</li>
                    <li>Cookies and similar tracking technologies</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Provide, maintain, and improve the Platform</li>
                <li>Create and manage your account</li>
                <li>Process quote requests and connect you with insurance carriers</li>
                <li>Send transactional emails (account confirmation, quote updates)</li>
                <li>Analyze usage patterns to improve our service</li>
                <li>Detect, prevent, and address fraud or security issues</li>
                <li>Comply with legal obligations</li>
              </ul>
              <p className="mt-2 font-medium text-gray-700">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Information Sharing</h2>
              <p>We may share your information with:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <span className="font-medium">Insurance carriers</span> — only when you explicitly request a quote,
                  and only the information necessary to fulfill that request
                </li>
                <li>
                  <span className="font-medium">Service providers</span> — trusted third-party vendors who assist
                  in operating the Platform (e.g., database, authentication, hosting) under strict confidentiality agreements
                </li>
                <li>
                  <span className="font-medium">Legal authorities</span> — when required by law, court order,
                  or governmental authority
                </li>
                <li>
                  <span className="font-medium">Business transfers</span> — in connection with a merger,
                  acquisition, or sale of assets, with appropriate notice to users
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Security</h2>
              <p>
                We implement industry-standard security measures to protect your personal information, including:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Encryption of data in transit (TLS/HTTPS) and at rest</li>
                <li>Secure authentication via Supabase with multi-factor options</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls limiting employee data access to what is necessary</li>
              </ul>
              <p className="mt-2">
                No method of electronic transmission or storage is 100% secure. While we strive to protect your
                information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Cookies and Tracking</h2>
              <p>
                We use cookies and similar tracking technologies to maintain your session, remember your
                preferences, and analyze platform usage. You can control cookies through your browser settings,
                but disabling cookies may affect Platform functionality.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Retention</h2>
              <p>
                We retain your personal information for as long as your account is active or as needed to provide
                services. You may request deletion of your account and associated data at any time through the
                Account Settings page. We may retain certain information as required by law or for legitimate
                business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain processing of your data</li>
                <li>Data portability (receiving your data in a machine-readable format)</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, contact us at{' '}
                <a href="mailto:privacy@coverguard.com" className="text-brand-600 hover:underline">
                  privacy@coverguard.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. California Privacy Rights (CCPA)</h2>
              <p>
                California residents have additional rights under the California Consumer Privacy Act (CCPA),
                including the right to know what personal information we collect, the right to delete personal
                information, and the right to opt-out of the sale of personal information. We do not sell
                personal information. For CCPA requests, contact{' '}
                <a href="mailto:privacy@coverguard.com" className="text-brand-600 hover:underline">
                  privacy@coverguard.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. Children&apos;s Privacy</h2>
              <p>
                The Platform is not intended for users under the age of 18. We do not knowingly collect
                personal information from children. If we learn that we have inadvertently collected such
                information, we will delete it promptly.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Third-Party Links</h2>
              <p>
                The Platform may contain links to third-party websites. We are not responsible for the privacy
                practices of those websites and encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically. We will notify you of material changes by
                updating the &ldquo;Last updated&rdquo; date and, where required, providing additional notice. Your
                continued use of the Platform after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Contact Us</h2>
              <p>
                For privacy-related questions or to exercise your rights, contact our Privacy Team at{' '}
                <a href="mailto:privacy@coverguard.com" className="text-brand-600 hover:underline">
                  privacy@coverguard.com
                </a>{' '}
                or write to: CoverGuard, Inc., Privacy Team, Wilmington, DE 19801.
              </p>
            </section>
          </div>

          <div className="mt-10 border-t border-gray-200 pt-6 flex flex-wrap gap-4">
            <Link href="/terms" className="text-sm text-brand-600 hover:underline">Terms of Use</Link>
            <Link href="/login" className="text-sm text-gray-500 hover:underline">← Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
