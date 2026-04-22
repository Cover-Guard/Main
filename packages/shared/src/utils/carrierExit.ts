import type {
  AlertSeverity,
  CarrierAvailabilityEntry,
  CarrierAvailabilitySnapshot,
  CarrierExitAlert,
  CarrierExitEvent,
  CarrierExitEventKind,
  CarrierWritingStatus,
} from '../types/insurance'

/**
 * Classify the transition between two writing statuses for the same carrier.
 * Returns null when the transition is not alert-worthy (e.g. NOT_WRITING →
 * NOT_WRITING or a move into / out of SURPLUS_LINES without crossing the
 * open / closed boundary).
 *
 * Spec: docs/gtm/value-add-activities/01-carrier-exit-alert.md §2
 */
export function classifyTransition(
  prev: CarrierWritingStatus,
  curr: CarrierWritingStatus,
): CarrierExitEventKind | null {
  if (prev === curr) return null

  // Exits: was ACTIVELY_WRITING, now anything weaker.
  if (prev === 'ACTIVELY_WRITING' && curr === 'LIMITED') return 'RESTRICT'
  if (prev === 'ACTIVELY_WRITING' && (curr === 'NOT_WRITING' || curr === 'SURPLUS_LINES')) {
    return 'EXIT'
  }

  // Restoration paths.
  if (prev === 'LIMITED' && curr === 'ACTIVELY_WRITING') return 'LIFT_RESTRICTION'
  if ((prev === 'NOT_WRITING' || prev === 'SURPLUS_LINES') && curr === 'ACTIVELY_WRITING') {
    return 'REOPEN'
  }

  // Everything else (LIMITED ↔ NOT_WRITING, etc.) is too noisy for v1.
  return null
}

/**
 * Diff two carrier-availability snapshots for the same ZIP and return the list
 * of events. Missing carriers are treated conservatively — a carrier that was
 * present yesterday but absent today is considered an EXIT.
 */
export function detectCarrierExits(
  previous: CarrierAvailabilitySnapshot,
  current: CarrierAvailabilitySnapshot,
): CarrierExitEvent[] {
  if (previous.zip !== current.zip) {
    throw new Error(
      `detectCarrierExits: snapshots must be for the same ZIP (got "${previous.zip}" and "${current.zip}")`,
    )
  }

  const prevByCarrier = new Map<string, CarrierAvailabilityEntry>()
  for (const entry of previous.entries) {
    prevByCarrier.set(entry.carrierId, entry)
  }

  const events: CarrierExitEvent[] = []

  for (const currEntry of current.entries) {
    const prevEntry = prevByCarrier.get(currEntry.carrierId)
    prevByCarrier.delete(currEntry.carrierId)
    if (!prevEntry) continue // brand-new carrier, not an exit/reopen
    const kind = classifyTransition(prevEntry.status, currEntry.status)
    if (!kind) continue
    events.push({
      zip: current.zip,
      carrierId: currEntry.carrierId,
      carrierName: currEntry.carrierName,
      kind,
      previousStatus: prevEntry.status,
      currentStatus: currEntry.status,
      detectedAt: current.capturedAt,
    })
  }

  // Carriers that disappeared entirely between snapshots — treat as exits if
  // they were actively writing.
  for (const orphan of prevByCarrier.values()) {
    if (orphan.status === 'ACTIVELY_WRITING') {
      events.push({
        zip: current.zip,
        carrierId: orphan.carrierId,
        carrierName: orphan.carrierName,
        kind: 'EXIT',
        previousStatus: orphan.status,
        currentStatus: 'NOT_WRITING',
        detectedAt: current.capturedAt,
      })
    }
  }

  return events
}

export interface BuildAlertOptions {
  affectedPolicyCount?: number
  id?: string
  now?: string
}

/**
 * Wrap a detected event into a user-facing alert, with severity, a headline,
 * and a suggested next action.
 */
export function buildAlert(event: CarrierExitEvent, options: BuildAlertOptions = {}): CarrierExitAlert {
  const { affectedPolicyCount = 0, id, now = new Date().toISOString() } = options
  const severity = computeSeverity(event.kind, affectedPolicyCount)

  return {
    id: id ?? `${event.carrierId}-${event.zip}-${event.detectedAt}`,
    zip: event.zip,
    event,
    affectedPolicyCount,
    headline: headlineFor(event),
    callToAction: ctaFor(event, affectedPolicyCount),
    severity,
    createdAt: now,
    acknowledged: false,
  }
}

function computeSeverity(
  kind: CarrierExitEventKind,
  affectedPolicyCount: number,
): AlertSeverity {
  if (kind === 'EXIT' && affectedPolicyCount > 0) return 'CRITICAL'
  if (kind === 'EXIT' || kind === 'RESTRICT') return 'WARNING'
  return 'INFO'
}

function headlineFor(event: CarrierExitEvent): string {
  const carrier = event.carrierName
  const zip = event.zip
  switch (event.kind) {
    case 'EXIT':
      return `${carrier} closed ${zip}`
    case 'RESTRICT':
      return `${carrier} restricted writing in ${zip}`
    case 'REOPEN':
      return `${carrier} reopened ${zip}`
    case 'LIFT_RESTRICTION':
      return `${carrier} lifted writing restrictions in ${zip}`
  }
}

function ctaFor(event: CarrierExitEvent, affectedPolicyCount: number): string {
  if (event.kind === 'EXIT' || event.kind === 'RESTRICT') {
    if (affectedPolicyCount > 0) {
      return `Review ${affectedPolicyCount} affected polic${affectedPolicyCount === 1 ? 'y' : 'ies'} and run replacement quotes.`
    }
    return 'Watch for renewal risk in this ZIP.'
  }
  return 'Consider re-shopping existing policies in this ZIP.'
}
