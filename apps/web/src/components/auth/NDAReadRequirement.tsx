'use client'

import { useState, useRef, useCallback } from 'react'
import { FileText, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'

interface NDAReadRequirementProps {
  acknowledged: boolean
  onAcknowledgedChange: (value: boolean) => void
}

export default function NDAReadRequirement({ acknowledged, onAcknowledgedChange }: NDAReadRequirementProps) {
  const [expanded, setExpanded] = useState(false)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    // Consider "scrolled to bottom" when within 20px of the end
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setHasScrolledToBottom(true)
    }
  }, [])

  const canAcknowledge = hasScrolledToBottom

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <FileText className="h-4 w-4 text-brand-600" />
          Non-Disclosure Agreement
          {acknowledged && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 pb-4">
          {/* Scrollable NDA content */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="mt-3 max-h-64 overflow-y-auto rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 space-y-4"
          >
            <section>
              <h3 className="font-semibold text-gray-900">1. Parties</h3>
              <p>
                This Non-Disclosure Agreement (&ldquo;Agreement&rdquo;) is entered into between CoverGuard, Inc.
                (&ldquo;CoverGuard,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) and the individual or entity accessing or
                using the CoverGuard platform (&ldquo;User,&rdquo; &ldquo;you,&rdquo; or &ldquo;your&rdquo;). By creating an account
                or accessing the Platform, you agree to the terms of this Agreement.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">2. Definition of Confidential Information</h3>
              <p>
                &ldquo;Confidential Information&rdquo; means any non-public information disclosed by CoverGuard to
                User through the Platform, including but not limited to:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 mt-1">
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
              <h3 className="font-semibold text-gray-900">3. Obligations of Receiving Party</h3>
              <p>User agrees to:</p>
              <ul className="list-disc pl-5 space-y-0.5 mt-1">
                <li>Hold all Confidential Information in strict confidence</li>
                <li>Not disclose Confidential Information to any third party without prior written consent from CoverGuard</li>
                <li>Use Confidential Information solely for lawful property research purposes and personal or professional decision-making</li>
                <li>Take reasonable measures to protect the confidentiality of information, using at least the same degree of care used to protect their own confidential information</li>
                <li>Promptly notify CoverGuard of any unauthorized disclosure or use of Confidential Information</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">4. Exclusions</h3>
              <p>Confidential Information does not include information that:</p>
              <ul className="list-disc pl-5 space-y-0.5 mt-1">
                <li>Is or becomes publicly available through no fault of the User</li>
                <li>Was known to the User prior to disclosure by CoverGuard, as evidenced by written records</li>
                <li>Is independently developed by the User without use of or reference to the Confidential Information</li>
                <li>Is disclosed with the prior written approval of CoverGuard</li>
                <li>Is required to be disclosed by law, regulation, or court order, provided that the User gives CoverGuard prompt written notice to allow CoverGuard to seek a protective order</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">5. Term and Duration</h3>
              <p>
                This Agreement is effective upon your first access to the Platform and shall remain in effect
                for a period of five (5) years following the termination of your access to the Platform,
                regardless of the reason for termination. The confidentiality obligations under this Agreement
                survive expiration or termination.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">6. Remedies</h3>
              <p>
                User acknowledges that any breach of this Agreement may cause irreparable harm to CoverGuard
                for which monetary damages may be inadequate. Accordingly, CoverGuard shall be entitled to
                seek equitable relief, including injunction and specific performance, in addition to all other
                remedies available at law or in equity, without the requirement of posting a bond.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">7. No License</h3>
              <p>
                Nothing in this Agreement grants User any rights in or to the Confidential Information,
                except the limited right to use it as described herein. All Confidential Information remains
                the sole and exclusive property of CoverGuard.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">8. Governing Law</h3>
              <p>
                This Agreement shall be governed by and construed in accordance with the laws of the State of
                Delaware, without regard to its conflict of laws principles. Any disputes arising under this
                Agreement shall be resolved in the state or federal courts located in Delaware.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-gray-900">9. Contact</h3>
              <p>
                If you have questions about this Agreement, please contact us at{' '}
                <a href="mailto:legal@coverguard.com" className="text-brand-600 hover:underline">legal@coverguard.com</a>.
              </p>
            </section>
          </div>

          {/* Scroll prompt */}
          {!hasScrolledToBottom && (
            <p className="mt-2 text-xs text-amber-600">
              Please scroll to the bottom of the agreement to continue.
            </p>
          )}

          {/* Acknowledge checkbox */}
          <label className={`mt-3 flex items-start gap-2 text-xs ${canAcknowledge ? 'text-gray-700' : 'text-gray-400'}`}>
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={!canAcknowledge}
              onChange={(e) => onAcknowledgedChange(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
            />
            <span>I have read and acknowledge the Non-Disclosure Agreement</span>
          </label>
        </div>
      )}
    </div>
  )
}
