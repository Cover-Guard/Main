'use client'

import type { ReactNode } from 'react'
import { SubscriptionProvider } from '@/lib/hooks/useSubscription'

/**
 * Client-side providers that wrap the entire app.
 * Mounted inside the root <body> so all pages can access shared context.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SubscriptionProvider>
      {children}
    </SubscriptionProvider>
  )
}
