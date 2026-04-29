/**
 * Bulk address upload — types shared between API and web.
 *
 * Spec: docs/enhancements/p0/03-bulk-address-upload.md (PR #311 P0 #3).
 *
 * The user uploads a CSV (one address per row), the API enqueues a
 * background job that runs each row through the standard property report
 * pipeline, and the result is downloadable as a CSV + bundled PDF when the
 * job finishes. The types in this file are the public contract the upload
 * flow agrees on.
 *
 * Per-tier row caps are enforced at the API boundary, not in this type:
 *   - Self-Serve: 25 rows per upload
 *   - Team:       100 rows per upload
 *   - Enterprise: configurable (TBD)
 */

/** Lifecycle of the *whole* job. Each job moves QUEUED → RUNNING → DONE/FAILED. */
export type BulkUploadStatus =
  | 'QUEUED'    // accepted, sitting in the queue
  | 'RUNNING'   // worker is processing rows
  | 'DONE'      // finished — every row has a terminal status
  | 'FAILED'    // job-level failure (e.g. queue infra dropped it)
  | 'CANCELLED' // user cancelled before completion

/** Lifecycle of a *single row* inside the job. */
export type BulkUploadRowStatus =
  | 'PENDING'   // not yet attempted
  | 'OK'        // report generated successfully
  | 'INVALID'   // row failed validation (bad address shape, missing zip, etc.)
  | 'GEOCODE_MISS' // address parses but couldn't be geocoded
  | 'ERROR'     // processed but report pipeline threw

/** A single row submitted in the upload, plus its eventual outcome. */
export interface BulkUploadRow {
  /**
   * 1-indexed input row number (preserves original CSV order so the output
   * CSV can be sorted to match).
   */
  rowNumber: number
  /** Raw input — what the user typed in the CSV. */
  rawAddress: string
  /** Optional client-supplied label, e.g. their internal lead-id. */
  externalRef?: string | null
  /** Current status. */
  status: BulkUploadRowStatus
  /** Populated when status === 'OK'. Slug or DB id of the resulting property. */
  propertyId?: string | null
  /** Populated for non-OK statuses. One human-readable sentence. */
  errorMessage?: string | null
}

/** A whole upload job — header + rows. */
export interface BulkUploadJob {
  id: string
  /** User who created the job. */
  userId: string
  /** Job-level status. */
  status: BulkUploadStatus
  /** Row count for quick UI rendering without loading all rows. */
  rowCount: number
  /** Number of rows in terminal status. Equals rowCount when DONE. */
  processedCount: number
  /** Number of rows that succeeded (status === 'OK'). */
  okCount: number
  /** Number of rows that failed (any non-OK terminal status). */
  failedCount: number
  /** Original filename for display (e.g. "leads-2026-04-27.csv"). */
  filename: string
  /** ISO timestamps. */
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  /**
   * The rows themselves. Optional on list endpoints (use the counts) — only
   * populated on the per-job detail endpoint.
   */
  rows?: BulkUploadRow[]
}

/**
 * What the API returns for the "create upload" endpoint. The server has
 * accepted the file and enqueued the job; the client should then poll
 * `/api/bulk-uploads/:id` for status.
 */
export interface BulkUploadCreateResponse {
  job: BulkUploadJob
}
