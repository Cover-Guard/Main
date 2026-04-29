'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { parseAddressCsv } from '@coverguard/shared'
import type { BulkUploadRow } from '@coverguard/shared'

/**
 * Drop-or-pick CSV upload dropzone for the bulk-address upload page (P0 #3).
 *
 * Spec: docs/enhancements/p0/03-bulk-address-upload.md.
 *
 * This is the *client-side preview* step: the user drops a CSV, we parse it
 * in the browser with `parseAddressCsv()`, and we show them how many rows
 * are valid + which rows are invalid before they submit. Submission to the
 * API is wired up in a follow-up PR (the API route doesn't exist yet).
 *
 * Why preview client-side? Because most upload mistakes are obvious (wrong
 * column names, garbage rows, way too many rows). Catching them before a
 * round-trip saves a queue slot and gives the user a better feedback loop.
 */
export interface UploadDropzoneProps {
  /**
   * Per-tier row cap. Defaults to 100 (Team plan ceiling). Self-Serve uses
   * 25; Enterprise is custom. Whatever the page knows about the user's
   * subscription, pass it in.
   */
  maxRows?: number
  /**
   * Fired when the user clicks "Submit" with a non-empty list of valid rows.
   * The page wires this up to the API call. Until the API exists, the
   * dropzone is preview-only.
   */
  onSubmit?: (params: { filename: string; rows: BulkUploadRow[] }) => void
}

interface ParsedFile {
  filename: string
  validRows: BulkUploadRow[]
  invalidRows: BulkUploadRow[]
  fileErrors: string[]
}

export function UploadDropzone({ maxRows = 100, onSubmit }: UploadDropzoneProps) {
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      setIsReading(true)
      try {
        const text = await file.text()
        const result = parseAddressCsv(text, { maxRows })
        setParsed({
          filename: file.name,
          validRows: result.rows,
          invalidRows: result.invalidRows,
          fileErrors: result.fileErrors,
        })
      } finally {
        setIsReading(false)
      }
    },
    [maxRows],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const reset = useCallback(() => {
    setParsed(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const submit = useCallback(() => {
    if (!parsed || parsed.validRows.length === 0) return
    onSubmit?.({ filename: parsed.filename, rows: parsed.validRows })
  }, [parsed, onSubmit])

  return (
    <div className="space-y-4">
      <label
        htmlFor="bulk-upload-input"
        onDragEnter={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-gray-300 bg-gray-50 hover:border-emerald-300 hover:bg-emerald-50/50'
        }`}
      >
        <Upload className="h-8 w-8 text-gray-400" aria-hidden />
        <p className="mt-3 text-sm font-medium text-gray-900">
          Drop your CSV here, or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Required column: <code className="rounded bg-white px-1">address</code>.
          Optional: <code className="rounded bg-white px-1">external_ref</code>.
          Up to {maxRows} addresses per upload.
        </p>
        <input
          ref={inputRef}
          id="bulk-upload-input"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onPick}
          disabled={isReading}
        />
      </label>

      {parsed && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <span className="truncate text-sm font-medium text-gray-900">
                {parsed.filename}
              </span>
            </div>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Remove
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <Stat
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />}
              label="Valid rows"
              value={parsed.validRows.length}
              tone="ok"
            />
            <Stat
              icon={<AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />}
              label="Invalid rows"
              value={parsed.invalidRows.length}
              tone={parsed.invalidRows.length > 0 ? 'warn' : 'ok'}
            />
          </div>

          {parsed.fileErrors.length > 0 && (
            <ul className="space-y-1 border-t border-gray-100 bg-red-50 px-4 py-3 text-xs text-red-700">
              {parsed.fileErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}

          {parsed.invalidRows.length > 0 && (
            <details className="border-t border-gray-100 px-4 py-3 text-xs">
              <summary className="cursor-pointer font-medium text-gray-700">
                Show invalid rows ({parsed.invalidRows.length})
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                {parsed.invalidRows.map((row) => (
                  <li key={row.rowNumber} className="text-gray-600">
                    <span className="font-mono text-gray-400">
                      Row {row.rowNumber}:
                    </span>{' '}
                    <span className="font-medium text-gray-900">
                      {row.rawAddress || '(empty)'}
                    </span>{' '}
                    — {row.errorMessage}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={submit}
              disabled={
                parsed.validRows.length === 0 || parsed.fileErrors.length > 0
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Process {parsed.validRows.length} address
              {parsed.validRows.length === 1 ? '' : 'es'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'ok' | 'warn'
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p
          className={`text-lg font-semibold ${
            tone === 'warn' ? 'text-amber-700' : 'text-gray-900'
          }`}
        >
          {value}
        </p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
