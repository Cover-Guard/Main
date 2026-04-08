'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import {
  PlanTier,
  UserType,
  PLANS,
  isFeatureLocked,
} from '@/lib/plans'

interface SubscriptionContextType {
  plan: PlanTier
  userType: UserType
  searchesUsed: number
  searchLimit: number
  savedCount: number
  saveLimit: number
  incrementSearch: () => void
  incrementSaved: () => void
  canSearch: () => boolean
  canSave: () => boolean
  isFeatureLocked: (requiredPlan: PlanTier) => boolean
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
)

interface SubscriptionProviderProps {
  children: ReactNode
  initialPlan?: PlanTier
  initialUserType?: UserType
}

export function SubscriptionProvider({
  children,
  initialPlan = 'free',
  initialUserType = 'individual',
}: SubscriptionProviderProps) {
  const [plan] = useState<PlanTier>(initialPlan)
  const [userType] = useState<UserType>(initialUserType)
  const [searchesUsed, setSearchesUsed] = useState(0)
  const [savedCount, setSavedCount] = useState(0)

  const searchLimit = PLANS[plan].searchLimit
  const saveLimit = PLANS[plan].saveLimit

  const incrementSearch = useCallback(() => {
    setSearchesUsed((prev) => prev + 1)
  }, [])

  const incrementSaved = useCallback(() => {
    setSavedCount((prev) => prev + 1)
  }, [])

  const canSearch = useCallback(() => {
    return searchesUsed < searchLimit
  }, [searchesUsed, searchLimit])

  const canSave = useCallback(() => {
    return savedCount < saveLimit
  }, [savedCount, saveLimit])

  const isFeatureLockedFn = useCallback(
    (requiredPlan: PlanTier) => {
      return isFeatureLocked(plan, requiredPlan)
    },
    [plan]
  )

  const value = useMemo<SubscriptionContextType>(
    () => ({
      plan,
      userType,
      searchesUsed,
      searchLimit,
      savedCount,
      saveLimit,
      incrementSearch,
      incrementSaved,
      canSearch,
      canSave,
      isFeatureLocked: isFeatureLockedFn,
    }),
    [
      plan,
      userType,
      searchesUsed,
      searchLimit,
      savedCount,
      saveLimit,
      incrementSearch,
      incrementSaved,
      canSearch,
      canSave,
      isFeatureLockedFn,
    ]
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error(
      'useSubscription must be used within a SubscriptionProvider'
    )
  }
  return context
}
