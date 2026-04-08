'use client'

import { Zap } from 'lucide-react'

interface TrialNudgeProps {
  searchesUsed: number
  searchLimit: number
  onUpgrade: () => void
}

export function TrialNudge({
  searchesUsed,
  searchLimit,
  onUpgrade,
}: TrialNudgeProps) {
  if (searchesUsed === 0) {
    return null
  }

  const remaining = searchLimit - searchesUsed
  const isExhausted = remaining <= 0

  const getMessage = () => {
    if (isExhausted) {
      return "You've used all your free searches"
    }
    return `${remaining} of ${searchLimit} searches remaining`
  }

  return (
    <div className='overflow-hidden rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 p-4'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex-1'>
          <p className='text-sm font-medium text-white'>{getMessage()}</p>
          <p className='mt-1 text-xs text-purple-100'>
            {isExhausted
              ? 'Upgrade to continue searching properties'
              : 'Upgrade to unlimited searches'}
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className='inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-purple-600 transition hover:bg-purple-50'
        >
          <Zap className='h-4 w-4' />
          Upgrade
        </button>
      </div>
    </div>
  )
}
