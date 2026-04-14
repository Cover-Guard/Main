'use client'

import { useState } from 'react'
import { Lock, Zap } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { PaywallModal } from '@/components/paywall'

interface GatedQuoteButtonProps {
  /** The original onClick handler for when the feature is accessible */
  onQuoteRequest: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Wraps a "Request Quote" button with subscription gating.
 * If the user's plan doesn't include quote_requests (Professional+),
 * clicking shows the PaywallModal instead of the quote form.
 */
export function GatedQuoteButton({
  onQuoteRequest,
  children,
  className = '',
}: GatedQuoteButtonProps) {
  const { plan, isLocked } = useSubscription()
  const [showModal, setShowModal] = useState(false)

  const locked = isLocked('quote_requests')

  return (
    <>
      <button
        onClick={() => {
          if (locked) {
            setShowModal(true)
          } else {
            onQuoteRequest()
          }
        }}
        className={className}
      >
        {locked && <Lock className="mr-1.5 h-3.5 w-3.5 inline" />}
        {children}
        {locked && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
            PRO
          </span>
        )}
      </button>

      <PaywallModal
        open={showModal}
        onClose={() => setShowModal(false)}
        feature="quote_requests"
        currentPlan={plan}
      />
    </>
  )
}
