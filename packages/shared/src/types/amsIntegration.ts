/**
 * Agency Management System (AMS) integration — types shared between API
 * and web.
 *
 * Spec: docs/enhancements/p1/06-ams-integration.md (PR #312 P1 #6).
 *
 * The spec is a phased rollout:
 *   Phase 1 — AgencyZoom (modern API, fastest path)
 *   Phase 2 — Salesforce Financial Services Cloud (managed package)
 *   Phase 3 — AMS360 + Applied Epic (deferred to P2 #13)
 *
 * The shared types in this file describe the *abstraction* every adapter
 * implements. The API has one adapter per provider, each one fronting a
 * different vendor SDK; the web layer reads + renders connection state
 * without caring which vendor it came from.
 *
 * Per-vendor capability flags (`capabilities.contactSync`,
 * `capabilities.attachmentsApi`, etc.) let the UI hide buttons that a
 * particular vendor doesn't support without each component growing a
 * provider-specific branch.
 */

/** Which AMS / CRM the connection talks to. */
export type AmsProvider =
  | 'AGENCY_ZOOM'      // Phase 1
  | 'SALESFORCE_FSC'   // Phase 2
  | 'AMS360'           // Phase 3 (P2 #13)
  | 'APPLIED_EPIC'     // Phase 3 (P2 #13)

/** Lifecycle of a connection between a CoverGuard agency and an AMS tenant. */
export type AmsConnectionStatus =
  | 'NOT_CONNECTED'    // user has never connected this provider
  | 'CONNECTING'       // OAuth flow in progress
  | 'CONNECTED'        // healthy, recent successful API call
  | 'DEGRADED'         // last API call failed; user-action recommended
  | 'EXPIRED'          // OAuth token expired and we couldn't refresh
  | 'DISCONNECTED'     // user explicitly disconnected

/**
 * Per-provider feature flags. The UI hides actions that a given AMS
 * doesn't yet support so users don't see a button that does nothing.
 *
 * These reflect *current* vendor support — flip a flag here when an
 * adapter learns a new capability.
 */
export interface AmsCapabilities {
  /** Push CoverGuard reports as attachments on the contact / opportunity. */
  attachmentsApi: boolean
  /** Two-way sync: contact created in AMS appears in CoverGuard recents. */
  contactSync: boolean
  /** Agency tenant SSO (vs. per-user OAuth). */
  ssoTenantAuth: boolean
}

/**
 * One row per (agency, provider). Owned by the API; the web layer reads it
 * and exposes a connect / disconnect / re-auth UI.
 */
export interface AmsConnection {
  /** Stable id; safe to surface in URLs. */
  id: string
  /** Agency this connection belongs to. */
  agencyId: string
  /** Which AMS this connection points at. */
  provider: AmsProvider
  /** Lifecycle state. */
  status: AmsConnectionStatus
  /** Vendor-side label so the UI can render "Acme Insurance Agency (AgencyZoom)". */
  externalAccountLabel?: string | null
  /** Last successful API call. Null until the first push. */
  lastSyncedAt?: string | null
  /** Last failure message; populated when status is DEGRADED / EXPIRED. */
  lastErrorMessage?: string | null
  /** ISO timestamps. */
  connectedAt: string
  updatedAt: string
}

/**
 * What a CoverGuard report looks like when we push it to an AMS. Adapters
 * translate this into provider-specific call shapes.
 */
export interface AmsPushPayload {
  /** Property the report is about (slug or DB id). */
  propertyId: string
  /** Plain-text summary the AMS surfaces in its notes/activity feed. */
  summary: string
  /** PDF report bytes — base64-encoded so this transports across HTTP boundaries. */
  pdfBase64: string
  /** Filename to attach as. */
  filename: string
  /** Optional contact / opportunity id in the AMS to attach to. */
  externalContactId?: string | null
}

/** Adapter return value from a push attempt. */
export interface AmsPushResult {
  /** Did the push succeed? */
  ok: boolean
  /** ID of the resulting attachment / activity in the AMS. Populated on success. */
  externalId?: string | null
  /** Human-readable error when ok === false. */
  errorMessage?: string | null
  /** ISO timestamp of when the push completed. */
  completedAt: string
}
