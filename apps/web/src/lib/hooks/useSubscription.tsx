'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  PlanTier,
  UserType,
  PLANS,
  canAccessFeature,
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

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [plan, setPlan] = useState<PlanTier>('free')
  const [userType, setUserType] = useState<UserType>('individual')
  const [searchesUsed, setSearchesUsed] = useState(0)
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    if (user?.user_metadata) {
      setPlan((user.user_metadata.plan as PlanTier) || 'free')
      setUserType((user.user_metadata.user_type as UserType) || 'individual')
    }
  }, [user?.user_metadata])

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

  const value: SubscriptionContextType = {
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
  }

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
