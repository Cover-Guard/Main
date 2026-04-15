'use client'

import Link from 'next/link'
import { Lock, Zap } from 'lucide-react'
import { PLANS, PlanTier } from '@/lib/plans'

interface UpgradePromptProps {
  feature: string
  /** The minimum plan tier required. Displays plan name and price. */
  requiredPlan?: PlanTier
  /** When provided, the CTA calls this instead of navigating to /pricing. */
  onUpgrade?: () => void
}

export function UpgradePrompt({ feature, requiredPlan, onUpgrade }: UpgradePromptProps) {
  const planInfo = requiredPlan ? PLANS[requiredPlan] : null

  return (
    <div className='overflow-hidden rounded-xl border border-brand-200 bg-brand-50 p-6'>
      <div className='flex gap-4'>
        <div className='shrink-0'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100'>
            <Lock className='h-5 w-5 text-brand-600' />
          </div>
        </div>
        <div className='flex-1'>
          <h3 className='font-semibold text-gray-900'>Unlock {feature}</h3>
          {planInfo ? (
            <p className='mt-1 text-sm text-gray-600'>
              Available on the{' '}
              <span className='font-semibold text-brand-700'>{planInfo.name}</span> plan
              {planInfo.price > 0 && ` ($${planInfo.price}/month)`} and above.
            </p>
          ) : (
            <p className='mt-1 text-sm text-gray-600'>
              Available on paid plans. Upgrade to unlock this feature.
            </p>
          )}
          {onUpgrade ? (
            <button
              onClick={onUpgrade}
              className='mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700'
            >
              <Zap className='h-4 w-4' />
              Upgrade Plan
            </button>
          ) : (
            <Link
              href='/pricing'
              className='mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700'
            >
              <Zap className='h-4 w-4' />
              View Plans
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
