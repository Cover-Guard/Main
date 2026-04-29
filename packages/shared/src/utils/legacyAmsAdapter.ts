/**
 * Helpers for the legacy AMS integration program (P2 #13 â AMS360 +
 * Applied Epic).
 *
 * The P1 #6 amsAdapter helpers shipped a stub: `isAmsProviderAvailable`
 * returned `false` for AMS360 and APPLIED_EPIC, and the connections card
 * rendered a "Coming soon" pill. Now that we're scaffolding the legacy
 * track, this file:
 *
 *   - un-stubs both providers behind a feature flag so the un-flag is a
 *     one-line change once Vertafore + Applied developer-program access
 *     lands;
 *   - encodes the polling-vs-webhooks delta: AMS360 has no webhooks at
 *     all, so we infer POLLING; Applied Epic supports webhooks for some
 *     event classes, so it can opt into REALTIME;
 *   - validates polling cadence + renders human copy for it ("every 15
 *     minutes", "every 4 hours");
 *   - centralizes the tenant-SSO requirement check used by the settings
 *     card, which is a hard upmarket-agency requirement per spec.
 *
 * Pure / I/O-free â safe to import in client components.
 *
 * Spec: docs/enhancements/p2/13-ams360-applied-epic.md.
 */
import type { AmsProvider } from '../types/amsIntegration'
import {
  DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN,
  LEGACY_AMS_FEATURE_FLAGS,
  MAX_LEGACY_AMS_POLL_INTERVAL_MIN,
  MIN_LEGACY_AMS_POLL_INTERVAL_MIN,
  type LegacyAmsAuthScheme,
  type LegacyAmsDeliveryMode,
  type LegacyAmsProvider,
  type LegacyAmsTenantConfig,
} from '../types/legacyAms'

/** All providers covered by this module. */
export const LEGACY_AMS_PROVIDERS: readonly LegacyAmsProvider[] = [
  'AMS360',
  'APPLIED_EPIC',
] as const

/** Type guard â narrows `AmsProvider` to the legacy subset. */
export function isLegacyAmsProvider(
  provider: AmsProvider,
): provider is LegacyAmsProvider {
  return provider === 'AMS360' || provider === 'APPLIED_EPIC'
}

/**
 * Whether the legacy AMS adapter for the given provider is currently
 * shipped + connectable. Until the Vertafore / Applied developer-program
 * approvals land, we keep this gated behind an env-var flag so we can
 * un-flag with a single config change in production.
 *
 * The function takes the flag explicitly (rather than reading
 * `process.env`) so the helper stays pure and testable.
 */
export function isLegacyAmsProviderAvailable(
  provider: LegacyAmsProvider,
  releaseFlags: { ams360Enabled: boolean; appliedEpicEnabled: boolean },
): boolean {
  switch (provider) {
    case 'AMS360':
      return releaseFlags.ams360Enabled
    case 'APPLIED_EPIC':
      return releaseFlags.appliedEpicEnabled
  }
}

/**
 * The delivery mode a provider can plausibly use. AMS360 has no webhooks,
 * so it always polls. Applied Epic has webhooks for some event classes,
 * so the user can choose. The settings UI uses this to gate the toggle.
 */
export function supportedDeliveryModes(
  provider: LegacyAmsProvider,
): LegacyAmsDeliveryMode[] {
  const flags = LEGACY_AMS_FEATURE_FLAGS[provider]
  return flags.webhooksAvailable ? ['REALTIME', 'POLLING'] : ['POLLING']
}

/**
 * The default delivery mode at first-connect time. We default to POLLING
 * universally â webhooks need explicit per-tenant Applied Epic config
 * and we don't want to fail the connection if it isn't set up. We accept
 * the provider argument for forward-compat (future providers may want a
 * different default), but the helper deliberately ignores it today.
 */
export function defaultDeliveryMode(
  provider: LegacyAmsProvider,
): LegacyAmsDeliveryMode {
  void provider
  return 'POLLING'
}

/**
 * Validate a poll interval (in minutes). Returns a discriminated result
 * the settings form uses to render an inline error without throwing.
 */
export type PollIntervalValidation =
  | { ok: true; minutes: number }
  | { ok: false; reason: 'BELOW_MIN' | 'ABOVE_MAX' | 'NOT_INTEGER' }

export function validatePollInterval(minutes: number): PollIntervalValidation {
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) {
    return { ok: false, reason: 'NOT_INTEGER' }
  }
  if (minutes < MIN_LEGACY_AMS_POLL_INTERVAL_MIN) {
    return { ok: false, reason: 'BELOW_MIN' }
  }
  if (minutes > MAX_LEGACY_AMS_POLL_INTERVAL_MIN) {
    return { ok: false, reason: 'ABOVE_MAX' }
  }
  return { ok: true, minutes }
}

/**
 * Human-friendly polling cadence label. Centralized so the settings card,
 * status email, and admin dashboard read identically.
 *
 *   15  -> "every 15 minutes"
 *   60  -> "every hour"
 *   90  -> "every 1h 30m"
 *   240 -> "every 4 hours"
 */
export function pollIntervalLabel(minutes: number): string {
  if (minutes < 60) return `every ${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) {
    return `every ${hours} hour${hours === 1 ? '' : 's'}`
  }
  return `every ${hours}h ${remainder}m`
}

/**
 * Whether the connection is configured to use a tenant-scoped SSO realm.
 * Upmarket agencies require this â they will not let agents auth with
 * per-user OAuth against an AMS that fronts the agency's book of
 * business.
 */
export function requiresTenantSso(config: LegacyAmsTenantConfig): boolean {
  return config.authScheme === 'TENANT_SAML' || config.authScheme === 'TENANT_OIDC'
}

/**
 * Whether the auth scheme is a tenant-scoped one *and* the realm is
 * actually populated. The settings card uses this to decide whether to
 * show a "Tenant SSO realm missing" warning.
 */
export function isTenantSsoConfigured(config: LegacyAmsTenantConfig): boolean {
  return requiresTenantSso(config) && (config.ssoRealm ?? '').trim().length > 0
}

/**
 * Default tenant config for a brand-new connection. The settings card
 * starts from this and lets the user edit polling cadence + SSO realm
 * before saving.
 */
export function defaultLegacyAmsTenantConfig(
  provider: LegacyAmsProvider,
  connectionId: string,
  tenantId: string,
  tenantLabel: string,
): LegacyAmsTenantConfig {
  return {
    connectionId,
    provider,
    tenantId,
    tenantLabel,
    deliveryMode: defaultDeliveryMode(provider),
    pollIntervalMinutes: DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN,
    authScheme: 'PER_USER',
    ssoRealm: null,
    lastSyncAt: null,
    attachmentsEnabled: LEGACY_AMS_FEATURE_FLAGS[provider].directAttachmentsApi,
  }
}

/**
 * Merge a partial update into an existing config. The settings form
 * sends partial patches as the user edits one field at a time; this
 * helper applies the patch *and* re-validates the resulting shape so
 * the UI never persists an obviously broken config.
 *
 * Returns the merged config plus an error map for any invalid fields
 * (so the form can render inline errors next to each input).
 */
export interface LegacyAmsMergeResult {
  config: LegacyAmsTenantConfig
  errors: Partial<Record<keyof LegacyAmsTenantConfig, string>>
}

export function mergeLegacyAmsConfig(
  existing: LegacyAmsTenantConfig,
  patch: Partial<LegacyAmsTenantConfig>,
): LegacyAmsMergeResult {
  const next: LegacyAmsTenantConfig = { ...existing, ...patch }
  const errors: LegacyAmsMergeResult['errors'] = {}

  // Validate poll interval.
  const pollCheck = validatePollInterval(next.pollIntervalMinutes)
  if (!pollCheck.ok) {
    errors.pollIntervalMinutes =
      pollCheck.reason === 'BELOW_MIN'
        ? `Must be at least ${MIN_LEGACY_AMS_POLL_INTERVAL_MIN} minutes.`
        : pollCheck.reason === 'ABOVE_MAX'
          ? `Must be at most ${MAX_LEGACY_AMS_POLL_INTERVAL_MIN} minutes.`
          : 'Must be a whole number of minutes.'
  }

  // Validate delivery mode against provider capability.
  if (!supportedDeliveryModes(next.provider).includes(next.deliveryMode)) {
    errors.deliveryMode = `${next.provider} does not support ${next.deliveryMode}.`
  }

  // Validate tenant SSO realm.
  if (requiresTenantSso(next) && (next.ssoRealm ?? '').trim().length === 0) {
    errors.ssoRealm = 'Tenant SSO realm is required for tenant-scoped auth.'
  }

  // Attachments cannot be enabled for a provider whose API doesn't
  // expose them â clamp it instead of erroring (UI hides the toggle, but
  // an old persisted config might still flip it on).
  if (
    next.attachmentsEnabled &&
    !LEGACY_AMS_FEATURE_FLAGS[next.provider].directAttachmentsApi
  ) {
    next.attachmentsEnabled = false
  }

  return { config: next, errors }
}

/**
 * The full set of auth schemes the settings dropdown should offer for a
 * given provider. Both legacy AMSes support all three, but we centralize
 * here so a future provider that only supports a subset can override.
 */
export function supportedAuthSchemes(
  provider: LegacyAmsProvider,
): LegacyAmsAuthScheme[] {
  if (LEGACY_AMS_FEATURE_FLAGS[provider].tenantSsoSupported) {
    return ['TENANT_SAML', 'TENANT_OIDC', 'PER_USER']
  }
  return ['PER_USER']
}

/**
 * Display label for an auth scheme. Used in the settings dropdown and
 * the admin overview.
 */
export function authSchemeLabel(scheme: LegacyAmsAuthScheme): string {
  switch (scheme) {
    case 'TENANT_SAML':
      return 'Tenant SSO (SAML)'
    case 'TENANT_OIDC':
      return 'Tenant SSO (OIDC)'
    case 'PER_USER':
      return 'Per-user OAuth'
  }
}
