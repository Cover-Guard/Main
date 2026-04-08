export type PlanTier = 'free' | 'individual' | 'professional' | 'team'
export type UserType = 'individual' | 'agent'

export type Feature =
  | 'search'
  | 'save'
  | 'quote_requests'
  | 'client_dashboard'
  | 'property_comparison'
  | 'analytics'
  | 'priority_support'

export interface Plan {
  name: string
  price: number
  searchLimit: number
  saveLimit: number
  features: Feature[]
}

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    name: 'Free',
    price: 0,
    searchLimit: 1,
    saveLimit: 1,
    features: ['search', 'save'],
  },
  individual: {
    name: 'Individual',
    price: 29,
    searchLimit: 10,
    saveLimit: 10,
    features: ['search', 'save'],
  },
  professional: {
    name: 'Professional',
    price: 79,
    searchLimit: 100,
    saveLimit: 100,
    features: [
      'search',
      'save',
      'quote_requests',
      'client_dashboard',
      'property_comparison',
      'analytics',
    ],
  },
  team: {
    name: 'Team',
    price: 199,
    searchLimit: Infinity,
    saveLimit: Infinity,
    features: [
      'search',
      'save',
      'quote_requests',
      'client_dashboard',
      'property_comparison',
      'analytics',
      'priority_support',
    ],
  },
}

export const INDIVIDUAL_FEATURES = ['search', 'save']

export const AGENT_FEATURES = [
  'search',
  'save',
  'quote_requests',
  'client_dashboard',
  'property_comparison',
  'analytics',
  'priority_support',
]

const FEATURE_NAMES: Record<Feature, string> = {
  search: 'Property Searches',
  save: 'Saved Properties',
  quote_requests: 'Quote Requests',
  client_dashboard: 'Client Dashboard',
  property_comparison: 'Property Comparison',
  analytics: 'Advanced Analytics',
  priority_support: 'Priority Support',
}

const FEATURE_PLAN_REQUIREMENTS: Record<Feature, PlanTier> = {
  search: 'free',
  save: 'free',
  quote_requests: 'professional',
  client_dashboard: 'professional',
  property_comparison: 'professional',
  analytics: 'professional',
  priority_support: 'team',
}

export function canAccessFeature(plan: PlanTier, feature: Feature): boolean {
  const requiredPlan = FEATURE_PLAN_REQUIREMENTS[feature]
  const planOrder: PlanTier[] = ['free', 'individual', 'professional', 'team']
  const planIndex = planOrder.indexOf(plan)
  const requiredIndex = planOrder.indexOf(requiredPlan)
  return planIndex >= requiredIndex
}

export function isFeatureLocked(
  currentPlan: PlanTier,
  requiredPlan: PlanTier
): boolean {
  const planOrder: PlanTier[] = ['free', 'individual', 'professional', 'team']
  const currentIndex = planOrder.indexOf(currentPlan)
  const requiredIndex = planOrder.indexOf(requiredPlan)
  return currentIndex < requiredIndex
}

export function getPlanDisplayName(plan: PlanTier): string {
  return PLANS[plan].name
}

export function getFeatureDisplayName(feature: Feature): string {
  return FEATURE_NAMES[feature]
}

export function getFeaturePlanRequirement(feature: Feature): PlanTier {
  return FEATURE_PLAN_REQUIREMENTS[feature]
}

export const STRIPE_PRICE_ENV_MAPPING: Record<PlanTier, string> = {
  free: '',
  individual: 'NEXT_PUBLIC_STRIPE_PRICE_INDIVIDUAL',
  professional: 'NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL',
  team: 'NEXT_PUBLIC_STRIPE_PRICE_TEAM',
}

export function getStripePriceId(plan: PlanTier): string {
  const envKey = STRIPE_PRICE_ENV_MAPPING[plan]
  if (!envKey) return ''
  return process.env[envKey] || ''
}
