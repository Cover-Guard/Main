'use client'

import { useState } from 'react'
import { Crown, Check, Zap, X } from 'lucide-react'
import { PlanTier, PLANS } from '@/lib/plans'

type PaywallTrigger = 'limit' | 'feature' | 'preview'

interface PaywallModalProps {
  open: boolean
  onClose: () => void
  trigger: PaywallTrigger
  onSelectPlan: (plan: PlanTier) => void
}

export function PaywallModal({
  open,
  onClose,
  trigger,
  onSelectPlan,
}: PaywallModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  if (!open) return null

  const getTriggerText = () => {
    switch (trigger) {
      case 'limit':
        return 'Search Limit Reached'
      case 'feature':
        return 'Premium Feature'
      case 'preview':
        return 'Preview Available'
      default:
        return 'Upgrade Your Plan'
    }
  }

  const getTriggerDescription = () => {
    switch (trigger) {
      case 'limit':
        return "You've used all your searches for this month. Upgrade to search more properties."
      case 'feature':
        return 'This feature is available on paid plans. Unlock professional tools to grow your business.'
      case 'preview':
        return 'Get full access to this feature with a premium plan.'
      default:
        return ''
    }
  }

  const handleSelectPlan = async (plan: PlanTier) => {
    setIsLoading(true)
    try {
      onSelectPlan(plan)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='relative w-full max-w-2xl rounded-lg bg-white p-8 shadow-lg'>
        <button
          onClick={onClose}
          className='absolute right-4 top-4 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          disabled={isLoading}
        >
          <X className='h-5 w-5' />
        </button>

        <div className='mb-8 flex items-center gap-3'>
          <div className='rounded-full bg-purple-100 p-2'>
            <Crown className='h-6 w-6 text-purple-600' />
          </div>
          <div>
            <h2 className='text-2xl font-bold text-gray-900'>
              {getTriggerText()}
            </h2>
            <p className='mt-1 text-gray-600'>{getTriggerDescription()}</p>
          </div>
        </div>

        <div className='grid gap-6 sm:grid-cols-2'>
          {/* Individual Plan */}
          <div className='rounded-lg border border-gray-200 p-6 transition hover:border-gray-300 hover:shadow-md'>
            <div className='mb-4'>
              <h3 className='text-lg font-semibold text-gray-900'>
                {PLANS.individual.name}
              </h3>
              <p className='mt-2 text-3xl font-bold text-gray-900'>
                ${PLANS.individual.price}
                <span className='text-sm text-gray-500'>/month</span>
              </p>
            </div>

            <ul className='mb-6 space-y-3'>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                {PLANS.individual.searchLimit} property searches
              </li>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                {PLANS.individual.saveLimit} saved properties
              </li>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                Basic search filters
              </li>
            </ul>

            <button
              onClick={() => handleSelectPlan('individual')}
              disabled={isLoading}
              className='w-full rounded-lg border border-purple-600 px-4 py-2 font-medium text-purple-600 transition hover:bg-purple-50 disabled:opacity-50'
            >
              Choose Plan
            </button>
          </div>

          {/* Professional Plan - Most Popular */}
          <div className='relative rounded-lg border-2 border-purple-600 p-6 shadow-md'>
            <div className='absolute -top-3 left-1/2 -translate-x-1/2 transform'>
              <span className='inline-block rounded-full bg-purple-600 px-3 py-1 text-xs font-semibold text-white'>
                Most Popular
              </span>
            </div>

            <div className='mb-4 mt-2'>
              <h3 className='text-lg font-semibold text-gray-900'>
                {PLANS.professional.name}
              </h3>
              <p className='mt-2 text-3xl font-bold text-gray-900'>
                ${PLANS.professional.price}
                <span className='text-sm text-gray-500'>/month</span>
              </p>
            </div>

            <ul className='mb-6 space-y-3'>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                {PLANS.professional.searchLimit} property searches
              </li>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                {PLANS.professional.saveLimit} saved properties
              </li>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                Quote requests
              </li>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                Property comparison tools
              </li>
              <li className='flex items-center gap-2 text-sm text-gray-700'>
                <Check className='h-5 w-5 text-green-500' />
                Advanced analytics
              </li>
            </ul>

            <button
              onClick={() => handleSelectPlan('professional')}
              disabled={isLoading}
              className='w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50'
            >
              Choose Plan
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className='mt-6 w-full text-center text-sm text-gray-600 transition hover:text-gray-900'
          disabled={isLoading}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
