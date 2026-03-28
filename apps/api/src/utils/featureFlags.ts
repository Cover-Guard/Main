/**
 * Feature flags — read from environment variables once at startup.
 * All flags default to OFF (false) unless explicitly set to "true".
 */

const STRIPE_SUBSCRIPTION_REQUIRED =
  process.env.STRIPE_SUBSCRIPTION_REQUIRED?.toLowerCase() === 'true'

export const featureFlags = {
  /** When true, users must have an active Stripe subscription to use authenticated routes. */
  stripeSubscriptionRequired: STRIPE_SUBSCRIPTION_REQUIRED,
} as const
