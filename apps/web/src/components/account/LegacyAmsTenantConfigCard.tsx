'use client'

import {
  authSchemeLabel,
  isTenantSsoConfigured,
  pollIntervalLabel,
  requiresTenantSso,
  supportedAuthSchemes,
  supportedDeliveryModes,
  type LegacyAmsAuthScheme,
  type LegacyAmsDeliveryMode,
  type LegacyAmsTenantConfig,
} from '@coverguard/shared'
import {
  DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN,
  MAX_LEGACY_AMS_POLL_INTERVAL_MIN,
  MIN_LEGACY_AMS_POLL_INTERVAL_MIN,
} from '@coverguard/shared'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  Loader2,
  Save,
  Server,
} from 'lucide-react'

/**
 * Settings card for a single legacy AMS tenant connection (P2 #13 â
 * AMS360 / Applied Epic).
 *
 * Spec: docs/enhancements/p2/13-ams360-applied-epic.md.
 *
 * Companion to {@link AmsConnectionsCard} (P1 #6). Once the user has
 * connected an AMS360 or Applied Epic tenant, this card surfaces the
 * legacy-AMS-specific config: delivery mode (only POLLING for AMS360),
 * polling cadence, tenant SSO realm, and attachments-enabled toggle.
 *
 * Stateless: the parent page owns the {@link LegacyAmsTenantConfig} and
 * handler. The merge + validation lives in the shared
 * {@link mergeLegacyAmsConfig} helper; this component just renders the
 * inputs and surfaces the error map.
 */
export interface LegacyAmsTenantConfigCardProps {
  /** The current persisted config for this tenant. */
  config: LegacyAmsTenantConfig
  /** Inline errors keyed by field, per `mergeLegacyAmsConfig`. */
  errors?: Partial<Record<keyof LegacyAmsTenantConfig, string>>
  /** Fired when any field changes â parent merges + validates. */
  onChange: (patch: Partial<LegacyAmsTenantConfig>) => void
  /** Fired when the user clicks "Save changes". */
  onSave: () => void
  /** True while the parent is persisting changes. */
  isSaving?: boolean
}

const DELIVERY_LABEL: Record<LegacyAmsDeliveryMode, string> = {
  REALTIME: 'Real-time (webhooks)',
  POLLING: 'Polling',
}

export function LegacyAmsTenantConfigCard({
  config,
  errors = {},
  onChange,
  onSave,
  isSaving = false,
}: LegacyAmsTenantConfigCardProps) {
  const deliveryModes = supportedDeliveryModes(config.provider)
  const authSchemes = supportedAuthSchemes(config.provider)
  const showSsoRealm = requiresTenantSso(config)
  const ssoMissing = showSsoRealm && !isTenantSsoConfigured(config)
  const cadenceCopy = pollIntervalLabel(config.pollIntervalMinutes)

  const hasErrors = Object.values(errors).some(Boolean)
  const canSave = !isSaving && !hasErrors

  return (
    <section
      aria-labelledby={`legacy-ams-${config.connectionId}-heading`}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="mb-4 flex items-start gap-3">
        <Server className="mt-1 h-5 w-5 text-slate-500" aria-hidden />
        <div className="flex-1">
          <h3
            id={`legacy-ams-${config.connectionId}-heading`}
            className="text-base font-semibold text-slate-900"
          >
            {config.tenantLabel}
          </h3>
          <p className="text-sm text-slate-600">
            {config.provider === 'AMS360' ? 'Vertafore AMS360' : 'Applied Epic'} Â·
            tenant <code className="font-mono text-xs">{config.tenantId}</code>
          </p>
        </div>
        <DeliveryBadge mode={config.deliveryMode} cadence={cadenceCopy} />
      </header>

      <div className="space-y-5">
        {/* Delivery mode */}
        <Field
          label="Delivery mode"
          hint={
            deliveryModes.length === 1
              ? `${config.provider} only supports polling.`
              : 'Real-time uses webhooks; polling syncs on a fixed cadence.'
          }
          error={errors.deliveryMode}
        >
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={config.deliveryMode}
            disabled={deliveryModes.length === 1 || isSaving}
            onChange={(e) =>
              onChange({ deliveryMode: e.target.value as LegacyAmsDeliveryMode })
            }
          >
            {deliveryModes.map((mode) => (
              <option key={mode} value={mode}>
                {DELIVERY_LABEL[mode]}
              </option>
            ))}
          </select>
        </Field>

        {/* Poll cadence â only when polling */}
        {config.deliveryMode === 'POLLING' && (
          <Field
            label="Poll every"
            hint={`Between ${MIN_LEGACY_AMS_POLL_INTERVAL_MIN} and ${MAX_LEGACY_AMS_POLL_INTERVAL_MIN} minutes. Default: ${DEFAULT_LEGACY_AMS_POLL_INTERVAL_MIN}.`}
            error={errors.pollIntervalMinutes}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={MIN_LEGACY_AMS_POLL_INTERVAL_MIN}
                max={MAX_LEGACY_AMS_POLL_INTERVAL_MIN}
                value={config.pollIntervalMinutes}
                disabled={isSaving}
                onChange={(e) =>
                  onChange({ pollIntervalMinutes: Number(e.target.value) })
                }
                className="block w-24 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Polling interval in minutes"
              />
              <span className="text-sm text-slate-600">minutes</span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {cadenceCopy}
              </span>
            </div>
          </Field>
        )}

        {/* Auth scheme */}
        <Field
          label="Authentication"
          hint="Tenant SSO is required for upmarket agencies."
          error={errors.authScheme}
        >
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={config.authScheme}
            disabled={isSaving}
            onChange={(e) =>
              onChange({ authScheme: e.target.value as LegacyAmsAuthScheme })
            }
          >
            {authSchemes.map((scheme) => (
              <option key={scheme} value={scheme}>
                {authSchemeLabel(scheme)}
              </option>
            ))}
          </select>
        </Field>

        {/* SSO realm â only when tenant SSO selected */}
        {showSsoRealm && (
          <Field
            label="Tenant SSO realm"
            hint="Issuer URL or realm name from the agency's IdP."
            error={errors.ssoRealm}
          >
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="text"
                value={config.ssoRealm ?? ''}
                disabled={isSaving}
                placeholder="https://acme.example.com/realms/agency"
                onChange={(e) =>
                  onChange({ ssoRealm: e.target.value === '' ? null : e.target.value })
                }
                className="block w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {ssoMissing && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Tenant SSO realm missing â connection will fall back to per-user OAuth.
              </p>
            )}
          </Field>
        )}

        {/* Attachments toggle */}
        <Field label="Attachments" hint="Push report PDFs into this AMS automatically.">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={config.attachmentsEnabled}
              disabled={isSaving}
              onChange={(e) =>
                onChange({ attachmentsEnabled: e.target.checked })
              }
            />
            <span className="text-sm text-slate-700">
              Enable direct attachments
            </span>
          </label>
        </Field>

        {/* Last sync */}
        <p className="text-xs text-slate-500">
          {config.lastSyncAt
            ? `Last sync: ${new Date(config.lastSyncAt).toLocaleString()}`
            : 'No successful sync yet.'}
        </p>
      </div>

      <footer className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        {!hasErrors && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Configuration looks good
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {isSaving ? 'Savingâ¦' : 'Save changes'}
        </button>
      </footer>
    </section>
  )
}

interface FieldProps {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

interface DeliveryBadgeProps {
  mode: LegacyAmsDeliveryMode
  cadence: string
}

function DeliveryBadge({ mode, cadence }: DeliveryBadgeProps) {
  if (mode === 'REALTIME') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
        Real-time
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
      <Clock className="h-3 w-3" aria-hidden />
      Polling Â· {cadence}
    </span>
  )
}
