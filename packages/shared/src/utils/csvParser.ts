/**
 * CSV parser + validator for bulk-address uploads.
 *
 * Spec: docs/enhancements/p0/03-bulk-address-upload.md (PR #311 P0 #3).
 *
 * Deliberately tiny — the spec calls for a CSV schema with two columns
 * (`address` required, `external_ref` optional), and the only useful work
 * here is normalizing whitespace, stripping quotes, validating the address
 * looks like *something*, and surfacing per-row errors. Zod or a real CSV
 * library is overkill for the shape we accept.
 *
 * If we ever need to support quoted commas, multiline fields, or alternate
 * delimiters, swap to `papaparse` and keep the same return contract.
 */

import type { BulkUploadRow } from '../types/bulkUpload'

export interface ParseAddressCsvOptions {
  /**
   * Reject the upload if it has more than this many data rows. Defaults to
   * 100 (the Team-plan cap from the spec). The API enforces a smaller cap
   * for Self-Serve users; this is the absolute upper bound.
   */
  maxRows?: number
}

export interface ParseAddressCsvResult {
  /** Rows that pass shape validation and are ready to enqueue. */
  rows: BulkUploadRow[]
  /**
   * Rows that failed validation. Populated as `BulkUploadRow` objects with
   * `status === 'INVALID'` and a populated `errorMessage` so they can be
   * surfaced in the upload preview UI before the user submits.
   */
  invalidRows: BulkUploadRow[]
  /**
   * Header-level / file-level failures. Empty when the file is parseable.
   * Examples: "missing required column 'address'", "exceeded 100 row limit".
   */
  fileErrors: string[]
}

const DEFAULT_MAX_ROWS = 100

/**
 * Parse a raw CSV string into validated rows. Returns errors in-band rather
 * than throwing so the upload UI can render them as a preview.
 */
export function parseAddressCsv(
  csv: string,
  options: ParseAddressCsvOptions = {},
): ParseAddressCsvResult {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS
  const fileErrors: string[] = []
  const rows: BulkUploadRow[] = []
  const invalidRows: BulkUploadRow[] = []

  const lines = csv
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0)

  if (lines.length === 0) {
    fileErrors.push('CSV is empty.')
    return { rows, invalidRows, fileErrors }
  }

  // Header line: lowercase + trim. Required: 'address'. Optional: 'external_ref'.
  const headerLine = lines[0]
  const headers = splitCsvLine(headerLine).map((h) => h.trim().toLowerCase())
  const addressIdx = headers.indexOf('address')
  const externalRefIdx = headers.indexOf('external_ref')

  if (addressIdx === -1) {
    fileErrors.push("CSV is missing required column 'address'.")
    return { rows, invalidRows, fileErrors }
  }

  const dataLines = lines.slice(1)
  if (dataLines.length === 0) {
    fileErrors.push('CSV has a header but no data rows.')
    return { rows, invalidRows, fileErrors }
  }

  if (dataLines.length > maxRows) {
    fileErrors.push(
      `CSV has ${dataLines.length} rows; the per-upload cap is ${maxRows}.`,
    )
    return { rows, invalidRows, fileErrors }
  }

  for (let i = 0; i < dataLines.length; i++) {
    const rowNumber = i + 1 // 1-indexed *data* row number
    const cells = splitCsvLine(dataLines[i]).map((c) => c.trim())
    const rawAddress = cells[addressIdx] ?? ''
    const externalRef =
      externalRefIdx >= 0 ? cells[externalRefIdx]?.trim() || null : null

    const error = validateAddressShape(rawAddress)
    const base: BulkUploadRow = {
      rowNumber,
      rawAddress,
      externalRef,
      status: error ? 'INVALID' : 'PENDING',
    }

    if (error) {
      invalidRows.push({ ...base, errorMessage: error })
    } else {
      rows.push(base)
    }
  }

  return { rows, invalidRows, fileErrors }
}

/**
 * Cheap CSV-line splitter. Handles double-quoted cells with embedded
 * commas; treats `""` inside a quoted cell as a literal `"`. Doesn't
 * handle multiline cells — if you need that, swap in papaparse.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++ // skip the escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cell)
      cell = ''
    } else {
      cell += ch
    }
  }
  out.push(cell)
  return out
}

/**
 * Returns null when the address looks acceptable, otherwise a one-sentence
 * reason it doesn't. We're not geocoding here — that happens server-side.
 * We're just rejecting obvious junk before we waste a queue slot on it.
 */
function validateAddressShape(address: string): string | null {
  const trimmed = address.trim()
  if (trimmed.length === 0) return 'Address is empty.'
  if (trimmed.length < 5) return 'Address is too short to be a real address.'
  if (trimmed.length > 200) return 'Address exceeds 200 characters.'
  // Must contain at least one digit (street number, zip, etc.).
  if (!/\d/.test(trimmed)) {
    return 'Address has no numbers — it should include a street number or ZIP.'
  }
  return null
}
