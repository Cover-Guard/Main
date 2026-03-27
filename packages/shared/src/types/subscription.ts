export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'

export type SubscriptionPlan = 'individual' | 'professional' | 'team'

export interface Subscription {
  id: string
  userId: string
  stripeSubscriptionId: string
  stripePriceId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

export interface SubscriptionState {
  /** Whether the subscription feature flag is enabled */
  required: boolean
  /** Whether the user has an active (or trialing) subscription */
  active: boolean
  /** The user's current subscription, if any */
  subscription: Subscription | null
}
