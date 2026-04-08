'use client'

import { Lock, Zap } from 'lucide-react'

interface UpgradePromptProps {
  feature: string
  onUpgrade: () => void
}

export function UpgradePrompt({ feature, onUpgrade }: UpgradePromptProps) {
  return (
    <div className='overflow-hidden rounded-lg border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-purple-100 p-6'>
      <div className='flex gap-4'>
        <div className='shrink-0'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-purple-200'>
            <Lock className='h-5 w-5 text-purple-600' />
          </div>
        </div>
        <div className='flex-1'>
          <h3 className='font-semibold text-gray-900'>Unlock {feature}</h3>
          <p className='mt-1 text-sm text-gray-700'>
            Available on Professional and Team plans
          </p>
          <button
            onClick={onUpgrade}
            className='mt-3 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-purple-700'
          >
            <Zap className='h-4 w-4' />
            Upgrade
          </button>
        </div>
      </div>
    </div>
  )
}
