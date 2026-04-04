import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { FooterPagesNav } from '@/components/marketing'

export const metadata: Metadata = { title: 'Privacy Policy — CoverGuard' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <FooterPagesNav />
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2 text-brand-700">
          <Shield className="h-8 w-8" />
          <span className="text-2xl font-bold">CoverGuard</span>
        </div>

        <div className="card p-8 md:p-12">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="mb-8 text-sm text-gray-500">Last updated: March 26, 2026</p>

          <div className="prose prose-sm max-w-none text-gray-600 space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
              <p>
                CoverGuard, Inc. (&ldquo;CoverGuard,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy and is
                committed to protecting your personal information. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you use our platform (&ldquo;Platform&rdquo;). We process
                personal data in accordance with applicable privacy laws, including the California Consumer
                Privacy Act (CCPA), the California Privacy Rights Act (CPRA), and other applicable U.S. state
                privacy statutes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
              <p>
                We limit the collection of personal information to what is necessary to provide,
                operate, and improve the Platform (&ldquo;data minimization&rdquo;). We collect the following
                categories of information:
              </p>
              <div className="mt-2 space-y-3">
                <div>
                  <p className="font-medium text-gray-700">Account Information</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Name, email address, and hashed password credentials</li>
                    <li>Company name and license number (for agents and lenders)</li>
                    <li>Account role and preferences</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Usage Data</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Property searches and viewed addresses</li>
                    <li>Saved properties, notes, and tags</li>
                    <li>Quote requests submitted through the Platform</li>
                    <li>Feature usage and navigation patterns</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Technical Data</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>IP address, browser type, and device information</li>
                    <li>Log data including access times and pages visited</li>
                    <li>Cookies and similar tracking technologies (see Section 7)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Your Information</h2>
              <p>
                We process your personal information only for specific, documented purposes (&ldquo;purpose
                limitation&rdquo;). We use the information we collect to:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Provide, maintain, and improve the Platform</li>
                <li>Create and manage your account</li>
                <li>Process quote requests and connect you with insurance carriers</li>
                <li>Send transactional emails (account confirmation, quote updates)</li>
                <li>Analyze usage patterns to improve our service</li>
                <li>Detect, prevent, and address fraud, unauthorized access, or security incidents</li>
                <li>Maintain audit logs for security monitoring and incident investigation</li>
                <li>Comply with legal and regulatory obligations</li>
              </ul>
              <p className="mt-2 font-medium text-gray-700">
                We do not sell, rent, or trade your personal information to third parties for monetary
                or other valuable consideration.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Information Sharing &amp; Subprocessors</h2>
              <p>We may share your information with the following categories of recipients:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <span className="font-medium">Insurance carriers</span> — only when you explicitly request a quote,
                  and only the minimum information necessary to fulfill that request
                </li>
                <li>
                  <span className="font-medium">Service providers (subprocessors)</span> — vetted third-party vendors
                  who assist in operating the Platform (e.g., database hosting, authentication, cloud
                  infrastructure). All subprocessors are bound by written data processing agreements
                  that require them to protect your data with security measures at least as stringent
                  as our own and to process data solely on our documented instructions
                </li>
                <li>
                  <span className="font-medium">Legal authorities</span> — when required by law, court order,
                  subpoena, or governmental authority, or to protect the rights, property, or safety of
                  CoverGuard, our users, or the public
                </li>
                <li>
                  <span className="font-medium">Business transfers</span> — in connection with a merger,
                  acquisition, or sale of assets, with appropriate prior notice to users. Any successor
                  entity will be bound by this Privacy Policy with respect to your previously collected data
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Security</h2>
              <p>
                We maintain a comprehensive information security program designed to protect the confidentiality,
                integrity, and availability of your personal information. Our security measures include:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Encryption of data in transit (TLS 1.2+) and at rest (AES-256)</li>
                <li>Secure authentication with support for multi-factor authentication (MFA)</li>
                <li>Role-based access controls enforcing least-privilege principles across all systems</li>
                <li>Continuous monitoring, intrusion detection, and automated alerting</li>
                <li>Regular penetration testing, vulnerability assessments, and independent security audits</li>
                <li>Documented incident response procedures with defined escalation paths</li>
                <li>Employee security awareness training conducted at onboarding and annually thereafter</li>
                <li>Formal change management processes for all production systems</li>
              </ul>
              <p className="mt-2">
                No method of electronic transmission or storage is 100% secure. While we maintain rigorous
                safeguards, we cannot guarantee absolute security. We continuously evaluate and enhance our
                security posture to address emerging threats.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Breach Notification</h2>
              <p>
                In the event of a confirmed security breach that compromises your personal information,
                we will notify affected users without unreasonable delay and in accordance with applicable
                law. Notification will include a description of the incident, the categories of data involved,
                the measures taken to address the breach, and steps you can take to protect yourself.
                We will also notify relevant regulatory authorities as required by applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Cookies and Tracking</h2>
              <p>
                We use strictly necessary cookies to maintain your session and authenticate your identity.
                We do not use third-party advertising or behavioral tracking cookies. You can control
                cookies through your browser settings, but disabling essential cookies may affect Platform
                functionality.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Data Retention &amp; Disposal</h2>
              <p>
                We retain your personal information only for as long as necessary to fulfill the purposes
                described in this Policy, or as required by law. Specific retention periods are as follows:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><span className="font-medium">Account data</span> — retained while your account is active and for 30 days following account deletion to allow recovery</li>
                <li><span className="font-medium">Search history and usage logs</span> — retained for up to 24 months, then automatically purged or anonymized</li>
                <li><span className="font-medium">Quote request records</span> — retained for up to 7 years to comply with insurance and financial record-keeping requirements</li>
                <li><span className="font-medium">Security and audit logs</span> — retained for a minimum of 12 months for security monitoring and incident investigation</li>
              </ul>
              <p className="mt-2">
                When data reaches the end of its retention period, it is securely deleted or irreversibly
                anonymized using industry-standard disposal methods.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Your Rights</h2>
              <p>Depending on your jurisdiction, you have the following rights regarding your personal information:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><span className="font-medium">Access</span> — request a copy of the personal information we hold about you</li>
                <li><span className="font-medium">Correction</span> — request correction of inaccurate or incomplete data</li>
                <li><span className="font-medium">Deletion</span> — request deletion of your personal information, subject to legal retention obligations</li>
                <li><span className="font-medium">Restriction</span> — object to or restrict certain processing of your data</li>
                <li><span className="font-medium">Portability</span> — receive your data in a structured, commonly used, machine-readable format</li>
                <li><span className="font-medium">Withdrawal of consent</span> — withdraw consent at any time where processing is based on consent</li>
                <li><span className="font-medium">Non-discrimination</span> — you will not be discriminated against for exercising any of these rights</li>
              </ul>
              <p className="mt-2">
                To exercise these rights, contact us at{' '}
                <a href="mailto:privacy@coverguard.com" className="text-brand-600 hover:underline">
                  privacy@coverguard.com
                </a>
                . We will respond to verified requests within 30 days. If we need additional time, we will
                notify you of the reason and extension period (not to exceed an additional 60 days).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">10. California Privacy Rights (CCPA/CPRA)</h2>
              <p>
                California residents have the following rights under the California Consumer Privacy Act (CCPA)
                as amended by the California Privacy Rights Act (CPRA):
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>The right to know what personal information we collect, use, disclose, and sell</li>
                <li>The right to delete personal information we have collected</li>
                <li>The right to correct inaccurate personal information</li>
                <li>The right to opt-out of the sale or sharing of personal information</li>
                <li>The right to limit use of sensitive personal information</li>
                <li>The right to non-discrimination for exercising your rights</li>
              </ul>
              <p className="mt-2">
                We do not sell or share personal information as defined under the CCPA/CPRA. For CCPA
                requests, contact{' '}
                <a href="mailto:privacy@coverguard.com" className="text-brand-600 hover:underline">
                  privacy@coverguard.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">11. Children&apos;s Privacy</h2>
              <p>
                The Platform is not intended for users under the age of 18. We do not knowingly collect
                personal information from children. If we learn that we have inadvertently collected such
                information, we will delete it promptly and notify any relevant authorities as required
                by law.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">12. Third-Party Links</h2>
              <p>
                The Platform may contain links to third-party websites or services. We are not responsible
                for the privacy practices of those websites and encourage you to review their privacy
                policies before providing any personal information.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">13. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy periodically to reflect changes in our practices, technologies,
                legal requirements, or other factors. We will notify you of material changes by updating
                the &ldquo;Last updated&rdquo; date, sending an email to the address associated with your account,
                and, where required by law, obtaining your renewed consent. Your continued use of the Platform
                after the effective date of any changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">14. Contact Us</h2>
              <p>
                For privacy-related questions, to exercise your data rights, or to report a concern, contact
                our Privacy Team at{' '}
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
