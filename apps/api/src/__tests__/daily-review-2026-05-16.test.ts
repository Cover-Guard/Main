// Daily QA regression guard — 2026-05-16
//
// Scheduled task: `daily-smokeqa-testing`. Automated run.
//
// WHY THIS FILE EXISTS
// --------------------
// Today's run found that THREE .tsx/.ts files under apps/web/src had been
// truncated mid-token on disk — exactly the same bug class as the
// 2026-05-13 `competitive-scrub` regression. The files were:
//
//   apps/web/src/components/dashboard/EnhancedDashboard.tsx
//     truncated mid-string at line 205 ("{(panel.id === 'kpis")
//     no closing quote, paren, JSX, or closing braces
//   apps/web/src/components/search/SearchBar.tsx
//     truncated mid-tag at line 317 (open <input ... without /> or
//     closing JSX siblings)
//   apps/web/src/lib/useGooglePlacesAutocomplete.ts
//     truncated mid-block at line 82 (open useCallback without closing })
//
// Each one produces a TS1002 / TS1005 / TS17008 parse error and breaks
// `next build`. The 2026-05-14 fix (`scripts/qa/web-syntax-check.mjs`) is
// the cheap parse gate for this bug class — it walks `apps/web/src` and
// parses every file with the TypeScript parser. But that script is NOT
// wired into npm scripts or CI yet, so today's truncation slipped past
// CI. This run recovers the files from `git HEAD` and adds the cheap
// parse-gate as a Jest test so the gate runs on every `npm test` and in
// CI's `test` job.
//
// The test does not need `next` or the apps/web dependency tree — it uses
// only the `typescript` parser, which is already a devDependency of
// apps/api (where this test lives) and of the monorepo root. It runs in
// well under a second.
//
// Negative-tested: reintroducing any of the three truncations (e.g. by
// deleting the last 30 lines of EnhancedDashboard.tsx) makes this test
// fail with the exact filename and TS error code at the truncation point.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// apps/api/src/__tests__/  -> monorepo root
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')

const WEB_SRC = join(REPO_ROOT, 'apps', 'web', 'src')
const API_SRC = join(REPO_ROOT, 'apps', 'api', 'src')
const SHARED_SRC = join(REPO_ROOT, 'packages', 'shared', 'src')

const PARSE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '__snapshots__',
])

function walkSource(dir: string, out: string[]): void {
  try {
    statSync(dir)
  } catch {
    return
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    if (SKIP_DIR_NAMES.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSource(full, out)
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf('.')
      if (dot < 0) continue
      const ext = entry.name.slice(dot)
      if (PARSE_EXTENSIONS.has(ext)) out.push(full)
    }
  }
}

// Load the TypeScript parser. `typescript` is a devDependency of apps/api,
// so under `npm test` it is always resolvable.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ts: typeof import('typescript') = require('typescript')

function parseDiagnostics(file: string): Array<{
  code: number
  line: number
  character: number
  message: string
}> {
  const src = readFileSync(file, 'utf8')
  const isTsx = file.endsWith('.tsx') || file.endsWith('.jsx')
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    false,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  // `parseDiagnostics` is populated by createSourceFile; parse-time only
  // (no type checking, no full dependency graph needed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diags = (sf as any).parseDiagnostics as ts.DiagnosticWithLocation[]
  return (diags ?? []).map((d) => {
    const pos =
      d.start != null
        ? sf.getLineAndCharacterOfPosition(d.start)
        : { line: 0, character: 0 }
    return {
      code: d.code,
      line: pos.line + 1,
      character: pos.character + 1,
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    }
  })
}

describe('daily QA 2026-05-16 — workspace source files parse cleanly', () => {
  // Discover up front so we get one named test per file.
  const webFiles: string[] = []
  walkSource(WEB_SRC, webFiles)
  const apiFiles: string[] = []
  walkSource(API_SRC, apiFiles)
  const sharedFiles: string[] = []
  walkSource(SHARED_SRC, sharedFiles)

  it('the parser self-test detects a truncated TSX file', () => {
    // Synthesize a buffer that mirrors today's EnhancedDashboard.tsx
    // truncation: open JSX expression with an unterminated string literal.
    const broken =
      'export default function X() {\n' +
      '  return (\n' +
      '    <div>\n' +
      "      {x === 'kpis"
    const sf = ts.createSourceFile(
      'broken.tsx',
      broken,
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TSX,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diags = (sf as any).parseDiagnostics as ts.DiagnosticWithLocation[]
    expect(diags.length).toBeGreaterThan(0)
    // TS1002 = Unterminated string literal — the exact code today's
    // EnhancedDashboard.tsx produced.
    expect(diags.some((d) => d.code === 1002)).toBe(true)
  })

  it('finds the apps/web source tree', () => {
    expect(webFiles.length).toBeGreaterThan(100)
  })

  it('finds the apps/api source tree', () => {
    expect(apiFiles.length).toBeGreaterThan(50)
  })

  it('finds the packages/shared source tree', () => {
    expect(sharedFiles.length).toBeGreaterThan(0)
  })

  // Per-file parse assertions. `it.each` produces one named test per file
  // so a failure points at the offending file directly in the jest report.
  describe('apps/web/src — every file parses without TS1002/TS1005/TS17008', () => {
    it.each(webFiles)('%s', (file) => {
      const diags = parseDiagnostics(file)
      if (diags.length > 0) {
        const first = diags[0]
        throw new Error(
          `${file}: TS${first.code} at line ${first.line} col ${first.character}: ${first.message}`,
        )
      }
    })
  })

  describe('apps/api/src — every file parses without TS1002/TS1005/TS17008', () => {
    it.each(apiFiles)('%s', (file) => {
      const diags = parseDiagnostics(file)
      if (diags.length > 0) {
        const first = diags[0]
        throw new Error(
          `${file}: TS${first.code} at line ${first.line} col ${first.character}: ${first.message}`,
        )
      }
    })
  })

  describe('packages/shared/src — every file parses without TS1002/TS1005/TS17008', () => {
    it.each(sharedFiles)('%s', (file) => {
      const diags = parseDiagnostics(file)
      if (diags.length > 0) {
        const first = diags[0]
        throw new Error(
          `${file}: TS${first.code} at line ${first.line} col ${first.character}: ${first.message}`,
        )
      }
    })
  })

  it('the three files that were truncated today are now complete and parseable', () => {
    // Pin the specific filenames so the recovery cannot regress silently.
    const recovered = [
      join(WEB_SRC, 'components', 'dashboard', 'EnhancedDashboard.tsx'),
      join(WEB_SRC, 'components', 'search', 'SearchBar.tsx'),
      join(WEB_SRC, 'lib', 'useGooglePlacesAutocomplete.ts'),
    ]
    for (const file of recovered) {
      // File must exist and be non-trivial in length.
      const src = readFileSync(file, 'utf8')
      expect(src.length).toBeGreaterThan(500)
      // File must parse without any diagnostic.
      const diags = parseDiagnostics(file)
      expect(diags).toEqual([])
    }
  })
})
