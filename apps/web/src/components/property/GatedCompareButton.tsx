'use client'

import { useState } from 'react'
import { GitCompare, Lock } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { PaywallModal } from '@/components/paywall'

interface GatedCompareButtonProps {
  propertyId: string
}

/**
 * A "Compare" button that gates the property comparison feature.
 * If the user's plan doesn't include property_comparison (Professional+),
 * clicking shows the PaywallModal instead of navigating.
 */
export function GatedCompareButton({ propertyId }: GatedCompareButtonProps) {
  const { plan, isLocked } = useSubscription()
  const [showModal, setShowModal] = useState(false)

  const locked = isLocked('property_comparison')

  if (locked) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GitCompare className="h-4 w-4" />
          Compare
          <span className="inline-flex items-center rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
            <Lock className="mr-0.5 h-2.5 w-2.5" />
            PRO
          </span>
        </button>
        <PaywallModal
          open={showModal}
          onClose={() => setShowModal(false)}
          feature="property_comparison"
          currentPlan={plan}
        />
      </>
    )
  }

  return (
    <Link
      href={`/compare?ids=${propertyId}`}
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <GitCompare className="h-4 w-4" />
      Compare
    </Link>
  )
}
