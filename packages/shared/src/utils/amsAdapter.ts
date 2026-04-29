/**
 * AMS adapter helpers — display copy, capability lookups, status math.
 *
 * Spec: docs/enhancements/p1/06-ams-integration.md.
 *
 * The actual per-vendor integration code (OAuth + REST clients) lives
 * server-side under `apps/api/src/integrations/ams/`. *That* code is one
 * adapter per provider implementing a common interface.
 *
 * This file is the **provider-agnostic** part of the abstraction:
 *   - human label per provider
 *   - capability lookup (so UI can hide unsupported actions)
 *   - status copy bundle (badge label + variant + tooltip)
 *   - "is this connection actionable?" check used by the connect button
 *
 * Pure functions only — safe to import in client components.
 */
import type {
  AmsCapabilities,
  AmsConnection,
  AmsConnectionStatus,
  AmsProvider,
} from '../types/amsIntegration'

/** Display label per provider. Used in cards, tables, and emails. */
export function amsProviderLabel(provider: AmsProvider): string {
  switch (provider) {
    case 'AGENCY_ZOOM':    return 'AgencyZoom'
    case 'SALESFORCE_FSC': return 'Salesforce Financial Services Cloud'
    case 'AMS360':         return 'Vertafore AMS360'
    case 'APPLIED_EPIC':   return 'Applied Epic'
  }
}

/**
 * Capability table. Phase-1 vendor (AgencyZoom) gets every flag; later
 * vendors add to the table as their adapters land. UI components ask the
 * lookup and gate buttons accordingly.
 */
const CAPABILITY_TABLE: Record<AmsProvider, AmsCapabilities> = {
  AGENCY_ZOOM:    { attachmentsApi: true,  contactSync: true,  ssoTenantAuth: false },
  SALESFORCE_FSC: { attachmentsApi: true,  contactSync: true,  ssoTenantAuth: true  },
  AMS360:         { attachmentsApi: false, contactSync: false, ssoTenantAuth: false },
  APPLIED_EPIC:   { attachmentsApi: false, contactSync: false, ssoTenantAuth: false },
}

export function getAmsCapabilities(provider: AmsProvider): AmsCapabilities {
  return CAPABILITY_TABLE[provider]
}

/** Whether a given provider's adapter is shipped (Phase 1 / 2 are; 3 isn't). */
export function isAmsProviderAvailable(provider: AmsProvider): boolean {
  return provider === 'AGENCY_ZOOM' || provider === 'SALESFORCE_FSC'
}

/**
 * Display copy bundle for a connection status. Centralized so the badge,
 * tooltip, alert email, and admin dashboard all read the same thing.
 */
export interface AmsStatusCopy {
  label: string
  description: string
  variant: 'neutral' | 'progress' | 'success' | 'warning' | 'danger'
}

export function amsStatusCopy(status: AmsConnectionStatus): AmsStatusCopy {
  switch (status) {
    case 'NOT_CONNECTED':
      return {
        label: 'Not connected',
        description: 'You have not yet linked this AMS.',
        variant: 'neutral',
      }
    case 'CONNECTING':
      return {
        label: 'Connecting',
        description: 'OAuth flow in progress — finish authorizing in the popup.',
        variant: 'progress',
      }
    case 'CONNECTED':
      return {
        label: 'Connected',
        description: 'Reports will be pushed to this AMS automatically.',
        variant: 'success',
      }
    case 'DEGRADED':
      return {
        label: 'Issue detected',
        description: 'The last sync attempt failed. Your AMS may need re-authorization.',
        variant: 'warning',
      }
    case 'EXPIRED':
      return {
        label: 'Re-auth required',
        description: 'Your AMS token expired and could not refresh — reconnect to resume.',
        variant: 'danger',
      }
    case 'DISCONNECTED':
      return {
        label: 'Disconnected',
        description: 'You disconnected this AMS. Reconnect any time to resume sync.',
        variant: 'neutral',
      }
  }
}

/**
 * Whether the user should currently see a "Connect" button vs. a
 * "Reconnect" button vs. nothing. The UI calls this so the action label
 * matches the status without each card growing a switch.
 */
export function nextAmsConnectionAction(
  status: AmsConnectionStatus,
): 'CONNECT' | 'RECONNECT' | 'DISCONNECT' | 'WAIT' {
  switch (status) {
    case 'NOT_CONNECTED': return 'CONNECT'
    case 'CONNECTING':    return 'WAIT'
    case 'CONNECTED':     return 'DISCONNECT'
    case 'DEGRADED':      return 'RECONNECT'
    case 'EXPIRED':       return 'RECONNECT'
    case 'DISCONNECTED':  return 'CONNECT'
  }
}

/**
 * Whether a connection is currently capable of receiving push events.
 * The API checks this before invoking an adapter — saves us the round
 * trip if the connection is broken.
 */
export function isAmsConnectionPushable(connection: AmsConnection): boolean {
  return connection.status === 'CONNECTED'
}
