'use client'

import type {
  AmsConnection,
  AmsConnectionStatus,
  AmsProvider,
} from '@coverguard/shared'
import {
  amsProviderLabel,
  amsStatusCopy,
  isAmsProviderAvailable,
  nextAmsConnectionAction,
} from '@coverguard/shared'
import { Building2, Cloud, Server, ShieldCheck, ExternalLink, Loader2 } from 'lucide-react'

/**
 * Settings card listing the AMS / CRM systems the user can connect to,
 * with per-provider connection state + Connect / Reconnect / Disconnect
 * actions (P1 #6).
 *
 * Spec: docs/enhancements/p1/06-ams-integration.md.
 *
 * Stateless — the parent page owns the connection list and the action
 * handlers. Phase-3 providers (AMS360 / Applied Epic) are rendered with
 * a "Coming soon" badge instead of a button so users can see the roadmap.
 */
export interface AmsConnectionsCardProps {
  /** Existing connections, one row per (agency, provider) the user has. */
  connections: readonly AmsConnection[]
  /** Fired when the user clicks Connect / Reconnect on a provider. */
  onConnect: (provider: AmsProvider) => void
  /** Fired when the user clicks Disconnect on a connected provider. */
  onDisconnect: (connectionId: string) => void
}

const PROVIDER_ORDER: readonly AmsProvider[] = [
  'AGENCY_ZOOM',
  'SALESFORCE_FSC',
  'AMS360',
  'APPLIED_EPIC',
]

const PROVIDER_ICONS: Record<AmsProvider, typeof Building2> = {
  AGENCY_ZOOM:    Building2,
  SALESFORCE_FSC: Cloud,
  AMS360:         Server,
  APPLIED_EPIC:   Server,
}

export function AmsConnectionsCard({
  connections,
  onConnect,
  onDisconnect,
}: AmsConnectionsCardProps) {
  const byProvider = new Map<AmsProvider, AmsConnection>()
  for (const c of connections) byProvider.set(c.provider, c)

  return (
    <section
      aria-labelledby="ams-connections-heading"
      className="rounded-2xl border border-gray-200 bg-white"
    >
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
        <div>
          <h2
            id="ams-connections-heading"
            className="text-sm font-semibold text-gray-900"
          >
            Agency management system connections
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Push CoverGuard reports straight into your AMS so they show up
            on the contact / opportunity automatically.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {PROVIDER_ORDER.map((provider) => (
          <ProviderRow
            key={provider}
            provider={provider}
            connection={byProvider.get(provider)}
            onConnect={() => onConnect(provider)}
            onDisconnect={(id) => onDisconnect(id)}
          />
        ))}
      </ul>
    </section>
  )
}

function ProviderRow({
  provider,
  connection,
  onConnect,
  onDisconnect,
}: {
  provider: AmsProvider
  connection: AmsConnection | undefined
  onConnect: () => void
  onDisconnect: (id: string) => void
}) {
  const Icon = PROVIDER_ICONS[provider]
  const status: AmsConnectionStatus = connection?.status ?? 'NOT_CONNECTED'
  const copy = amsStatusCopy(status)
  const action = nextAmsConnectionAction(status)
  const available = isAmsProviderAvailable(provider)

  return (
    <li className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-200">
          <Icon className="h-4 w-4 text-gray-600" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {amsProviderLabel(provider)}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <StatusBadge status={status} />
            {connection?.externalAccountLabel && (
              <span className="text-[11px] text-gray-500">
                {connection.externalAccountLabel}
              </span>
            )}
            {!available && (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                Coming soon
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">{copy.description}</p>
        </div>
      </div>
      <div className="shrink-0">
        {!available ? null : action === 'WAIT' ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Authorizing…
          </span>
        ) : action === 'DISCONNECT' && connection ? (
          <button
            type="button"
            onClick={() => onDisconnect(connection.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            {action === 'RECONNECT' ? 'Reconnect' : 'Connect'}
          </button>
        )}
      </div>
    </li>
  )
}

function StatusBadge({ status }: { status: AmsConnectionStatus }) {
  const copy = amsStatusCopy(status)
  const variantClasses: Record<typeof copy.variant, string> = {
    neutral:  'bg-gray-50 text-gray-700 ring-gray-200',
    progress: 'bg-amber-50 text-amber-800 ring-amber-200',
    success:  'bg-emerald-50 text-emerald-800 ring-emerald-200',
    warning:  'bg-orange-50 text-orange-800 ring-orange-200',
    danger:   'bg-red-50 text-red-700 ring-red-200',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${variantClasses[copy.variant]}`}
      title={copy.description}
    >
      {copy.label}
    </span>
  )
}
