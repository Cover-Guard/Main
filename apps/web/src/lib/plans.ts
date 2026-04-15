export type PlanTier = 'free' | 'individual' | 'professional' | 'team'
export type UserType = 'individual' | 'agent'

export type Feature =
  | 'search'
  | 'save'
  | 'insurance_cost_estimates'
  | 'property_comparison'
  | 'client_dashboard'
  | 'quote_requests'
  | 'analytics'
  | 'pdf_reports'
  | 'api_access'
  | 'priority_support'

export interface Plan {
  name: string
  description: string
  price: number
  period: string
  searchLimit: number
  saveLimit: number
  features: Feature[]
}

// Single source of truth for plan tiers — mirrors the pricing page packages.
// Pricing page segments (Home Buyers, Residential Agents, etc.) all map to these
// three paid tiers via the NEXT_PUBLIC_STRIPE_PRICE_* env vars:
//   INDIVIDUAL   → $29/month  (Home Buyer Pro / Agent Starter)
//   PROFESSIONAL → $79/month  (Professional / CRE Starter / Lender Starter / Carrier Starter)
//   TEAM         → $199/month (Brokerage / CRE Professional)
export const PLANS: Record<PlanTier, Plan> = {
  free: {
    name: 'Free',
    description: 'For buyers exploring properties before committing.',
    price: 0,
    period: '',
    searchLimit: 3,
    saveLimit: 3,
    features: ['search', 'save'],
  },
  individual: {
    name: 'Individual',
    description: 'For active buyers and agents getting started.',
    price: 29,
    period: '/month',
    searchLimit: 25,
    saveLimit: 25,
    features: [
      'search',
      'save',
      'insurance_cost_estimates',
      'property_comparison',
      'client_dashboard',
    ],
  },
  professional: {
    name: 'Professional',
    description: 'For agents managing multiple clients and listings.',
    price: 79,
    period: '/month',
    searchLimit: 100,
    saveLimit: 100,
    features: [
      'search',
      'save',
      'insurance_cost_estimates',
      'property_comparison',
      'client_dashboard',
      'quote_requests',
      'analytics',
      'pdf_reports',
    ],
  },
  team: {
    name: 'Team',
    description: 'For brokerages and teams that need scale and collaboration.',
    price: 199,
    period: '/month',
    searchLimit: Infinity,
    saveLimit: Infinity,
    features: [
      'search',
      'save',
      'insurance_cost_estimates',
      'property_comparison',
      'client_dashboard',
      'quote_requests',
      'analytics',
      'pdf_reports',
      'api_access',
      'priority_support',
    ],
  },
}

export const INDIVIDUAL_FEATURES: Feature[] = [
  'search',
  'save',
  'insurance_cost_estimates',
  'property_comparison',
  'client_dashboard',
]

export const AGENT_FEATURES: Feature[] = [
  'search',
  'save',
  'insurance_cost_estimates',
  'property_comparison',
  'client_dashboard',
  'quote_requests',
  'analytics',
  'pdf_reports',
  'api_access',
  'priority_support',
]

const FEATURE_NAMES: Record<Feature, string> = {
  search: 'Property Search',
  save: 'Saved Properties',
  insurance_cost_estimates: 'Insurance Cost Estimates',
  property_comparison: 'Property Comparison',
  client_dashboard: 'Client Management',
  quote_requests: 'Binding Quote Requests',
  analytics: 'Advanced Analytics',
  pdf_reports: 'Professional PDF Reports',
  api_access: 'API Access',
  priority_support: 'Priority Support',
}

// Maps each feature to the minimum plan tier required to access it.
// Aligns with the pricing page feature lists by segment:
//   - property_comparison: Individual ($29) — Home Buyer Pro & Agent Starter include it
//   - client_dashboard:    Individual ($29) — Agent Starter includes basic client mgmt
//   - analytics:           Professional ($79) — analytics is a Professional feature for agents
//   - quote_requests:      Professional ($79) — binding quotes require Professional
//   - api_access:          Team ($199) — Brokerage/CRE Professional tier
const FEATURE_PLAN_REQUIREMENTS: Record<Feature, PlanTier> = {
  search: 'free',
  save: 'free',
  insurance_cost_estimates: 'individual',
  property_comparison: 'individual',
  client_dashboard: 'individual',
  quote_requests: 'professional',
  analytics: 'professional',
  pdf_reports: 'professional',
  api_access: 'team',
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
