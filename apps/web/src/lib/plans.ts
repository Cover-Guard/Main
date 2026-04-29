/**
 * Subscription plan definitions — source of truth derived from the /pricing page.
 *
 * Feature mapping:
 *
 * | Feature                   | Free | Individual | Professional | Team      |
 * |---------------------------|------|------------|--------------|-----------|
 * | Property searches         | 1    | 25         | 100          | Unlimited |
 * | Property reports          | 1    | 25         | 100          | Unlimited |
 * | AI Agent interactions     | 5    | Unlimited  | Unlimited    | Unlimited |
 * | Risk profiles             | ✓    | ✓          | ✓            | ✓         |
 * | Carrier availability      | ✓    | ✓          | ✓            | ✓         |
 * | Save properties           | 1    | 25         | 100          | Unlimited |
 * | Client management         | ✗    | 10 clients | Unlimited    | Unlimited |
 * | Insurance cost estimates  | ✗    | ✓          | ✓            | ✓         |
 * | Quote requests            | ✗    | ✗          | ✓            | ✓         |
 * | Property comparison       | ✗    | ✗          | ✓            | ✓         |
 * | Analytics & search history| ✗    | ✗          | ✓            | ✓         |
 * | Risk report PDFs          | ✗    | ✗          | ✓            | ✓         |
 * | Priority support          | ✗    | ✗          | ✓            | ✓         |
 * | Team members              | 1    | 1          | 1            | 10        |
 * | API access                | ✗    | ✗          | ✗            | ✓         |
 * | Dedicated account manager | ✗    | ✗          | ✗            | ✓         |
 *
 * Free-tier hard limits (enforced server-side, lifetime):
 *   - 1 property search
 *   - 5 AI Agent interactions
 * See apps/api/src/middleware/usageLimit.ts for enforcement.
 */

export type PlanTier = 'free' | 'individual' | 'professional' | 'team'
export type UserType = 'individual' | 'agent'

/**
 * Every gated capability in the app. Features listed here can be checked
 * against a user's plan tier to determine access.
 */
export type Feature =
  | 'search'                 // property search (all plans, but usage-limited)
  | 'save'                   // save properties (all plans, but count-limited)
  | 'ai_agent'               // AI Agent / Advisor chat (all plans, but usage-limited on free)
  | 'risk_profiles'          // risk profiles (all plans)
  | 'carrier_availability'   // carrier lookup (all plans)
  | 'insurance_estimates'    // insurance cost estimates (individual+)
  | 'client_management'      // client dashboard / CRM (individual+, count-limited)
  | 'quote_requests'         // binding quote requests (professional+)
  | 'property_comparison'    // side-by-side comparison (professional+)
  | 'analytics'              // analytics & search history (professional+)
  | 'report_pdfs'            // professional risk report PDFs (professional+)
  | 'priority_support'       // priority support (professional+)
  | 'team_members'           // multiple team members (team only)
  | 'api_access'             // API access (team only)
  | 'dedicated_account_mgr'  // dedicated account manager (team only)

export interface PlanLimits {
  /** Lifetime property search limit on Free; monthly report limit on paid plans (Infinity = unlimited) */
  searchLimit: number
  /** Lifetime AI Agent / Advisor interaction limit on Free (Infinity = unlimited) */
  aiInteractionLimit: number
  /** Monthly property report limit (Infinity = unlimited) */
  reportLimit: number
  /** Max saved properties */
  saveLimit: number
  /** Max clients in CRM (0 = not available, Infinity = unlimited) */
  clientLimit: number
  /** Max team members */
  teamMemberLimit: number
}

export interface Plan {
  name: string
  price: number
  limits: PlanLimits
  features: Feature[]
}

/** Canonical plan definitions — order matters (index = tier rank). */
export const PLAN_ORDER: PlanTier[] = ['free', 'individual', 'professional', 'team']

export const PLANS: Record<PlanTier, Plan> = {
  free: {
    name: 'Free',
    price: 0,
    limits: {
      // Free tier — hard server-side limits, lifetime
      searchLimit: 1,
      aiInteractionLimit: 5,
      reportLimit: 1,
      saveLimit: 1,
      clientLimit: 0,
      teamMemberLimit: 1,
    },
    features: [
      'search',
      'save',
      'ai_agent',
      'risk_profiles',
      'carrier_availability',
    ],
  },
  individual: {
    name: 'Individual',
    price: 29,
    limits: {
      searchLimit: 25,
      aiInteractionLimit: Infinity,
      reportLimit: 25,
      saveLimit: 25,
      clientLimit: 10,
      teamMemberLimit: 1,
    },
    features: [
      'search',
      'save',
      'ai_agent',
      'risk_profiles',
      'carrier_availability',
      'insurance_estimates',
      'client_management',
    ],
  },
  professional: {
    name: 'Professional',
    price: 79,
    limits: {
      searchLimit: 100,
      aiInteractionLimit: Infinity,
      reportLimit: 100,
      saveLimit: 100,
      clientLimit: Infinity,
      teamMemberLimit: 1,
    },
    features: [
      'search',
      'save',
      'ai_agent',
      'risk_profiles',
      'carrier_availability',
      'insurance_estimates',
      'client_management',
      'quote_requests',
      'property_comparison',
      'analytics',
      'report_pdfs',
      'priority_support',
    ],
  },
  team: {
    name: 'Team',
    price: 199,
    limits: {
      searchLimit: Infinity,
      aiInteractionLimit: Infinity,
      reportLimit: Infinity,
      saveLimit: Infinity,
      clientLimit: Infinity,
      teamMemberLimit: 10,
    },
    features: [
      'search',
      'save',
      'ai_agent',
      'risk_profiles',
      'carrier_availability',
      'insurance_estimates',
      'client_management',
      'quote_requests',
      'property_comparison',
      'analytics',
      'report_pdfs',
      'priority_support',
      'team_members',
      'api_access',
      'dedicated_account_mgr',
    ],
  },
}

// ─── Feature display names (for UI labels) ──────────────────────────────────

const FEATURE_NAMES: Record<Feature, string> = {
  search: 'Property Search',
  save: 'Saved Properties',
  ai_agent: 'AI Agent',
  risk_profiles: 'Risk Profiles',
  carrier_availability: 'Carrier Availability',
  insurance_estimates: 'Insurance Cost Estimates',
  client_management: 'Client Management',
  quote_requests: 'Binding Quote Requests',
  property_comparison: 'Property Comparison',
  analytics: 'Analytics & Search History',
  report_pdfs: 'Professional Risk Reports',
  priority_support: 'Priority Support',
  team_members: 'Team Members',
  api_access: 'API Access',
  dedicated_account_mgr: 'Dedicated Account Manager',
}

// ─── Feature → minimum plan requirement ─────────────────────────────────────

const FEATURE_PLAN_REQUIREMENTS: Record<Feature, PlanTier> = {
  search: 'free',
  save: 'free',
  ai_agent: 'free',
  risk_profiles: 'free',
  carrier_availability: 'free',
  insurance_estimates: 'individual',
  client_management: 'individual',
  quote_requests: 'professional',
  property_comparison: 'professional',
  analytics: 'professional',
  report_pdfs: 'professional',
  priority_support: 'professional',
  team_members: 'team',
  api_access: 'team',
  dedicated_account_mgr: 'team',
}

// ─── Feature descriptions for upgrade prompts ───────────────────────────────

const FEATURE_DESCRIPTIONS: Record<Feature, string> = {
  search: 'Search any US property for risk and insurability data.',
  save: 'Save properties to your dashboard for easy access later.',
  ai_agent: 'Ask the CoverGuard AI Agent about flood zones, carriers, and insurability.',
  risk_profiles: 'View flood, fire, wind, earthquake, and crime risk scores.',
  carrier_availability: 'See which insurance carriers are actively writing policies.',
  insurance_estimates: 'Get estimated annual insurance premiums for any property.',
  client_management: 'Manage your clients and assign properties to them.',
  quote_requests: 'Request binding quotes directly from active carriers.',
  property_comparison: 'Compare up to 3 properties side-by-side.',
  analytics: 'Track your search history, risk distributions, and activity.',
  report_pdfs: 'Generate professional PDF risk reports for clients.',
  priority_support: 'Get faster responses from our support team.',
  team_members: 'Add up to 10 team members to your account.',
  api_access: 'Access CoverGuard data via our REST API.',
  dedicated_account_mgr: 'Get a dedicated account manager for your team.',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function planIndex(plan: PlanTier): number {
  return PLAN_ORDER.indexOf(plan)
}

/** Returns true if the user's plan includes the given feature. */
export function canAccessFeature(plan: PlanTier, feature: Feature): boolean {
  const required = FEATURE_PLAN_REQUIREMENTS[feature]
  return planIndex(plan) >= planIndex(required)
}

/** Returns true if the user's plan is lower than the required plan. */
export function isFeatureLocked(
  currentPlan: PlanTier,
  requiredPlan: PlanTier,
): boolean {
  return planIndex(currentPlan) < planIndex(requiredPlan)
}

export function getPlanDisplayName(plan: PlanTier): string {
  return PLANS[plan].name
}

export function getFeatureDisplayName(feature: Feature): string {
  return FEATURE_NAMES[feature]
}

export function getFeatureDescription(feature: Feature): string {
  return FEATURE_DESCRIPTIONS[feature]
}

export function getFeaturePlanRequirement(feature: Feature): PlanTier {
  return FEATURE_PLAN_REQUIREMENTS[feature]
}

/** Returns the plan limits for a given tier. */
export function getPlanLimits(plan: PlanTier): PlanLimits {
  return PLANS[plan].limits
}

/** Returns the minimum plan tier a user needs to upgrade to for a feature. */
export function getUpgradeTarget(feature: Feature): PlanTier {
  return FEATURE_PLAN_REQUIREMENTS[feature]
}

/** Maps a backend SubscriptionPlan (INDIVIDUAL/PROFESSIONAL/TEAM) to a PlanTier. */
export function subscriptionPlanToTier(
  backendPlan: 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM' | null | undefined,
): PlanTier {
  if (!backendPlan) return 'free'
  const map: Record<string, PlanTier> = {
    INDIVIDUAL: 'individual',
    PROFESSIONAL: 'professional',
    TEAM: 'team',
  }
  return map[backendPlan] ?? 'free'
}

// ─── Stripe price ID helpers ────────────────────────────────────────────────

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

// ─── Legacy exports (backward compat) ───────────────────────────────────────

export const INDIVIDUAL_FEATURES = PLANS.individual.features
export const AGENT_FEATURES = PLANS.professional.features
ptionPlanToTier(
  backendPlan: 'INDIVIDUAL' | 'PROFESSIONAL' | 'TEAM' | null | undefined,
): PlanTier {
  if (!backendPlan) return 'free'
  const map: Record<string, PlanTier> = {
    INDIVIDUAL: 'individual',
    PROFESSIONAL: 'professional',
    TEAM: 'team',
  }
  return map[backendPlan] ?? 'free'
}

// ─── Stripe price ID helpers ────────────────────────────────────────────────

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

// ─── Legacy exports (backward compat) ───────────────────────────────────────

export const INDIVIDUAL_FEATURES = PLANS.individual.features
export const AGENT_FEATURES = PLANS.professional.features
