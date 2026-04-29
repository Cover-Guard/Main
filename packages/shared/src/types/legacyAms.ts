/**
 * Types for the legacy AMS integration program (P2 #13).
 *
 * Spec: docs/enhancements/P2-enhancements.md ("P2 #13 - AMS360 + Applied
 * Epic Integrations") - "Same payload shape as the AgencyZoom integration
 * to minimize maintenance."
 *
 * P1 #6 stubbed AMS360 + APPLIED_EPIC as Phase 3 (Coming soon). This
 * module ships the additional shape they need on top of the shared P1 #6
 * contract: connection mode (REALTIME vs POLLING), tenant-SSO config,
 * polling cadence, and a vendor-specific Vertafore / Applied capability
 * delta.
 *
 * Forward-compat scaffold: the adapter impls themselves are gated on
 * Vertafore + Applied developer-program approval (per spec dependencies),
 * so this PR ships the contract + a polling helper + a tenant config UI
 * primitive. The actual API calls land in a follow-up infra PR.
 */

import type { AmsProvider } from './amsIntegration'

/** Subset of {@link AmsProvider} that is "legacy AMS" in the spec. */
export type LegacyAmsProvider = Extract<AmsProvider, 'AMS360' | 'APPLIED_EPIC'>

/**
 * How the integration delivers updates.
 *
 *  - REALTIME : the AMS calls our webhook on every change (rare on legacy)
 *  - POLLING  : we poll the AMS on a cadence and reconcile our cache
 *
 * AgencyZoom (P1 #6) is REALTIME. Legacy AMS systems are typically
 * POLLING because their webhook surface is limited.
 */
export type LegacyAmsDeliveryMode = 'REALTIME' | 'POLLING'

/**
 * Auth scheme for the legacy AMS connection. Spec calls for
 * tenant-level SSO (acceptance criterion).
 */
export type LegacyAmsAuthScheme =
  | 'TENANT_SAML'   // tenant SSO via SAML (preferred; meets spec)
  | 'TENANT_OIDC'   // tenant SSO via OIDC
  | 'PER_USER'      // fallback if tenant SSO isn't available

/**
 * Per-tenant configuration for one legacy AMS connection. Lives
 * alongside the {@link AmsConnection} from P1 #6.
 */
export interface LegacyAmsTenantConfig {
  /** Owner connection id (foreign key to AmsConnection.id). */
  connectionId: string
  /** Which legacy AMS this configuration is for. */
  provider: LegacyAmsProvider
  /** Vendor's tenant identifier ("agency 1234" / "epic-tenant-id"). */
  tenantId: string
  /** Display name shown on the settings page ("Acme Agency, IL"). */
  tenantLabel: string
  /** REALTIME or POLLING - drives the badge on the settings card. */
  deliveryMode: LegacyAmsDeliveryMode
  /**
   * Minutes between poll cycles when `deliveryMode === 'POLLING'`.
   * Ignored otherwise. Default lives in `DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN`.
   */
  pollIntervalMinutes: number
  /** Auth scheme actually negotiated with the tenant. */
  authScheme: LegacyAmsAuthScheme
  /**
   * SAML/OIDC realm or issuer URL the tenant logs in through. Required
   * when `authScheme` is one of the SSO variants; `null` for PER_USER.
   */
  ssoRealm: string | null
  /** ISO-8601 timestamp of the last successful poll / push. */
  lastSyncAt: string | null
  /** Has the tenant approved attachments (the spec acceptance criterion)? */
  attachmentsEnabled: boolean
}

/**
 * Default cadence for the polling loop. 15 minutes is fast enough for
 * the "report appears in AMS" UX and slow enough to stay inside both
 * vendor rate limits.
 */
export const DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN = 15

/**
 * Bounds enforced by the settings UI. Tighter than this and we hit
 * vendor rate limits; looser and the report-attach UX feels broken.
 */
export const MIN_LEGACY_AMS_POLL_INTERVAL_MIN = 5
export const MAX_LEGACY_AMS_POLL_INTERVAL_MIN = 240

/**
 * Vendor-specific feature delta vs the AgencyZoom (P1 #6) baseline.
 * Surfaced as feature flags on the settings card so the UI can hide
 * actions a particular legacy AMS doesn't yet support.
 */
export interface LegacyAmsFeatureFlags {
  /** Vendor exposes a webhook surface (else POLLING). */
  webhooksAvailable: boolean
  /** Vendor's API supports attachment upload directly. */
  directAttachmentsApi: boolean
  /** Vendor supports tenant SSO (vs PER_USER). */
  tenantSsoSupported: boolean
}

/**
 * Hard-coded vendor capability table. Real adapter impls will read
 * this; the UI uses it to decide what to show on the settings card.
 *
 * Numbers are based on Vertafore + Applied published docs as of 2026
 * Q2. Bump when the vendors ship new APIs.
 */
export const LEGACY_AMS_FEATURE_FLAGS: Record<LegacyAmsProvider, LegacyAmsFeatureFlags> = {
  AMS360: {
    webhooksAvailable:    false, // poll-only at time of writing
    directAttachmentsApi: true,
    tenantSsoSupported:   true,
  },
  APPLIED_EPIC: {
    webhooksAvailable:    true,
    directAttachmentsApi: true,
    tenantSsoSupported:   true,
  },
}
