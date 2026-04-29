'use client'

import {
  renderDisclosureText,
  validateDisclosureSubmit,
  type DisclosureRecord,
} from '@coverguard/shared'
import { CheckCircle2, FileSignature, Loader2 } from 'lucide-react'
import { useState } from 'react'

/**
 * Buyer-facing signing card for the disclosure-trail compliance flow
 * (P2 #17).
 *
 * Spec: docs/enhancements/P2-enhancements.md.
 *
 * Renders inside the share-link UX (P0 #2 dependency). The buyer sees:
 *   - the property address + acknowledgment text;
 *   - typed-name + initials inputs;
 *   - a Submit button gated on `validateDisclosureSubmit`.
 *
 * The 30-second target time-to-sign is the spec acceptance criterion.
 * Rendering this card without server round-trips after the share-link
 * loads is what keeps us inside that budget â the component itself
 * does no fetches.
 *
 * Stateless w.r.t. the parent: parent passes the `record` and an
 * `onSubmit` handler that POSTs to the API. The component owns the
 * input state locally (typed name + initials).
 */
export interface DisclosureSignerCardProps {
  /** Disclosure record loaded from the share-link. */
  record: DisclosureRecord
  /** Property address line shown to the buyer. */
  propertyAddress: string
  /** Optional brokerage-supplied template override. */
  textTemplate?: string
  /** Fired when the buyer submits a valid signature. */
  onSubmit: (input: { typedName: string; typedInitials: string }) => Promise<void>
  /** Whether the parent is currently submitting. */
  isSubmitting?: boolean
  /** True after the parent confirmed the signature was persisted. */
  isSigned?: boolean
}

export function DisclosureSignerCard({
  record,
  propertyAddress,
  textTemplate,
  onSubmit,
  isSubmitting = false,
  isSigned = false,
}: DisclosureSignerCardProps) {
  const [typedName, setTypedName] = useState('')
  const [typedInitials, setTypedInitials] = useState('')
  const [error, setError] = useState<string | null>(null)

  const text = renderDisclosureText({
    address: propertyAddress,
    template: textTemplate,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateDisclosureSubmit({ typedName, typedInitials })
    if (!validation.ok) {
      setError(reasonToCopy(validation.reason))
      return
    }
    setError(null)
    await onSubmit({ typedName, typedInitials })
  }

  if (isSigned) {
    return (
      <SignedConfirmation
        propertyAddress={propertyAddress}
        signedAt={record.signedAt ?? new Date().toISOString()}
      />
    )
  }

  const canSubmit =
    !isSubmitting && typedName.trim().length > 0 && typedInitials.trim().length > 0

  return (
    <section
      aria-labelledby="disclosure-signer-heading"
      className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="flex items-start gap-3">
        <FileSignature
          className="mt-1 h-5 w-5 text-blue-500"
          aria-hidden
        />
        <div>
          <h3
            id="disclosure-signer-heading"
            className="text-base font-semibold text-slate-900"
          >
            Insurability disclosure
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Please confirm you&apos;ve read the report so your realtor can keep an
            audit-ready record.
          </p>
        </div>
      </header>

      <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-800">
        {text}
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <Field label="Typed full name" htmlFor="disclosure-name">
          <input
            id="disclosure-name"
            type="text"
            autoComplete="name"
            disabled={isSubmitting}
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="e.g. Alice Buyer"
            required
          />
        </Field>

        <Field label="Initials" htmlFor="disclosure-initials">
          <input
            id="disclosure-initials"
            type="text"
            maxLength={5}
            disabled={isSubmitting}
            value={typedInitials}
            onChange={(e) => setTypedInitials(e.target.value.toUpperCase())}
            className="block w-32 rounded-md border border-slate-300 px-3 py-2 text-sm uppercase tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="AB"
            required
          />
        </Field>

        {error ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {isSubmitting ? 'Submittingâ¦' : 'Sign disclosure'}
        </button>

        <p className="text-xs text-slate-500">
          By signing, you agree to the acknowledgment above. This signature is
          recorded with your IP address and timestamp for audit purposes.
        </p>
      </form>
    </section>
  )
}

// =============================================================================
// Internal pieces
// =============================================================================

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function SignedConfirmation({
  propertyAddress,
  signedAt,
}: {
  propertyAddress: string
  signedAt: string
}) {
  return (
    <section
      aria-labelledby="disclosure-signed-heading"
      className="mx-auto max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm"
    >
      <header className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" aria-hidden />
        <div>
          <h3
            id="disclosure-signed-heading"
            className="text-base font-semibold text-emerald-900"
          >
            Disclosure signed
          </h3>
          <p className="mt-1 text-sm text-emerald-800">
            Your acknowledgment for{' '}
            <span className="font-medium">{propertyAddress}</span> was recorded on{' '}
            <time dateTime={signedAt}>
              {new Date(signedAt).toLocaleString()}
            </time>
            . A copy is now in your realtor&apos;s compliance file.
          </p>
        </div>
      </header>
    </section>
  )
}

function reasonToCopy(reason: string): string {
  switch (reason) {
    case 'EMPTY_NAME':
      return 'Please type your full name to continue.'
    case 'EMPTY_INITIALS':
      return 'Please type your initials to continue.'
    case 'NAME_TOO_SHORT':
      return 'Please type your full name (at least 2 characters).'
    case 'NAME_DOES_NOT_MATCH_INITIALS':
      return 'The initials you typed do not appear in your name. Please double-check.'
    default:
      return 'Please double-check your inputs.'
  }
}
