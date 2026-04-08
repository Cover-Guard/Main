'use client'

import { ReactNode } from 'react'
import { Lock, Zap } from 'lucide-react'
import { PlanTier, isFeatureLocked, getPlanDisplayName } from '@/lib/plans'

interface FeatureGateProps {
  feature: string
  userPlan: PlanTier
  requiredPlan: PlanTier
  onUpgrade: () => void
  children: ReactNode
}

export function FeatureGate({
  feature,
  userPlan,
  requiredPlan,
  onUpgrade,
  children,
}: FeatureGateProps) {
  const isLocked = isFeatureLocked(userPlan, requiredPlan)

  if (!isLocked) {
    return <>{children}</>
  }

  return (
    <div className='relative'>
      <div className='pointer-events-none absolute inset-0 z-10 rounded-lg backdrop-blur-sm' />
      <div className='opacity-50'>{children}</div>

      <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-lg'>
        <div className='rounded-full bg-gray-900/80 p-3'>
          <Lock className='h-6 w-6 text-white' />
        </div>
        <div className='text-center'>
          <p className='font-semibold text-gray-100'>{feature} Feature</p>
          <p className='text-sm text-gray-300'>
            Available on {getPlanDisplayName(requiredPlan)} and higher
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className='mt-2 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700'
        >
          <Zap className='h-4 w-4' />
          Upgrade
        </button>
      </div>
    </div>
  )
}
