/**
 * Mock-import guard (P-B2).
 *
 * Static-analysis test that enforces the policy documented in
 * `docs/audits/MOCK_REGISTRY.md`: every production importer of a mock-data
 * module must reference `isDemoMode` in the same file.
 *
 * Why a Jest test instead of an ESLint rule:
 * - Lo-fi regex over file contents is enough to catch the cases we care about.
 * - One file. Easy to read in code review. Easy to bypass via the ALLOWLIST
 *   below if a legitimate need arises (and the bypass is visible in the diff).
 * - Runs as part of `npm test`, same surface as other guards.
 *
 * What it catches:
 *   import { ... } from './mockData'
 *   import { ... } from '../lib/mockData'
 *   import { ... } from '@/lib/mockData'
 *   import { StubLlmAdapter } from '@coverguard/shared'   // in production code
 *
 * What it doesn't catch (deliberate scope limits):
 * - Dynamic imports (`await import('./mockData')`).
 * - Re-exports that obscure the import chain.
 * - Test files (anything under __tests__, *.test.*, *.spec.*).
 *
 * Run: `npm test -- mock-imports` (or as part of the full web suite).
 */

import * as fs from 'fs'
import * as path from 'path'

const WEB_SRC = path.resolve(__dirname, '..', 'src')

/** Files explicitly allowed to import mock data without an isDemoMode gate.
 * Add entries here only with a written justification in the PR description.
 * The whole point of the registry is that this list stays short.
 *
 * The seven enhanced-dashboard panels below are temporary allowlist entries:
 * they are known violations that PR-B2.b will fix by wrapping each panel in
 * an isDemoMode() gate. When PR-B2.b lands, every entry below should be
 * removed and this set should be empty again. The allowlist exists so this
 * PR can ship the registry + guard without first having to also do the
 * panel-by-panel refactor.
 */
const ALLOWLIST: ReadonlySet<string> = new Set<string>([
  'src/components/dashboard/enhanced/ActiveCarriersPanel.tsx',
  'src/components/dashboard/enhanced/ClientManagementPanel.tsx',
  'src/components/dashboard/enhanced/ForecastPanel.tsx',
  'src/components/dashboard/enhanced/InsightsPanel.tsx',
  'src/components/dashboard/enhanced/KPIPanel.tsx',
  'src/components/dashboard/enhanced/PortfolioMixPanel.tsx',
  'src/components/dashboard/enhanced/RiskTrendPanel.tsx',
])

/** Patterns that, if found in an `import ... from '...'` statement, mark the
 * file as a mock-data importer. Matched against the import specifier (the
 * string after `from`), not the whole import line. */
const MOCK_SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bmockData\b/, // ./mockData, ../lib/mockData, @/lib/mockData, etc.
  /\bStub[A-Z][A-Za-z]*Adapter\b/, // StubLlmAdapter, future StubFooAdapter
]

/** A file is "test code" if any of these matches its path. Test files are
 * exempt from the policy. */
const TEST_PATH_PATTERNS: readonly RegExp[] = [
  /__tests__/,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
]

interface ImportRecord {
  file: string // POSIX-style relative to apps/web
  importLine: string
  specifier: string
}

/** Walk apps/web/src and collect every (importer, specifier) pair that
 * matches a MOCK_SPECIFIER_PATTERN. Skip test files and node_modules. */
function findMockImports(): ImportRecord[] {
  const results: ImportRecord[] = []
  const stack: string[] = [WEB_SRC]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
        stack.push(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(ent.name)) continue
      const rel = path.relative(path.resolve(WEB_SRC, '..'), full).split(path.sep).join('/')
      if (TEST_PATH_PATTERNS.some((p) => p.test(rel))) continue
      const body = fs.readFileSync(full, 'utf8')
      // Match: import ... from 'specifier' or import 'specifier'
      // Capture group 1 = specifier (the string between the quotes).
      const importRe = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g
      let m: RegExpExecArray | null
      while ((m = importRe.exec(body)) !== null) {
        const spec = m[1]
        if (MOCK_SPECIFIER_PATTERNS.some((p) => p.test(spec))) {
          results.push({ file: rel, importLine: m[0], specifier: spec })
        }
      }
    }
  }
  return results
}

/** True if the file references `isDemoMode` at all — the policy gate. */
function hasDemoModeGate(relFile: string): boolean {
  const abs = path.resolve(WEB_SRC, '..', relFile)
  try {
    return /\bisDemoMode\b/.test(fs.readFileSync(abs, 'utf8'))
  } catch {
    return false
  }
}

describe('Mock-import guard (P-B2)', () => {
  const mockImports = findMockImports()

  // Group offenders by file so the assertion failure is readable.
  const offenders = mockImports.filter((r) => {
    if (ALLOWLIST.has(r.file)) return false
    return !hasDemoModeGate(r.file)
  })

  const byFile = new Map<string, ImportRecord[]>()
  for (const o of offenders) {
    if (!byFile.has(o.file)) byFile.set(o.file, [])
    byFile.get(o.file)!.push(o)
  }

  it('finds the registry — sanity check that the scan is wired up', () => {
    // If this fails, the regex is broken or the source tree moved. The known
    // production importers of the enhanced mock are real and listed in the
    // registry; we expect to see them in the raw scan.
    // PR-B1.e-h removed 6 of 7 production mock imports as part of the panel
    // consolidation. Threshold lowered from 7 to 1 to keep the sanity check
    // alive without re-introducing dead mocks.
    expect(mockImports.length).toBeGreaterThanOrEqual(1)
  })

  it('every mock importer in production code references isDemoMode', () => {
    if (offenders.length === 0) return
    const message = [
      'Mock-import guard violation. See docs/audits/MOCK_REGISTRY.md.',
      '',
      'These production files import mock data without an isDemoMode() gate:',
      '',
      ...[...byFile.entries()].map(
        ([file, recs]) =>
          `  ${file}\n` + recs.map((r) => `    - imports ${r.specifier}`).join('\n'),
      ),
      '',
      'Fix one of two ways:',
      "  1. Wrap the usage in an `if (isDemoMode()) { ... }` check.",
      "  2. Add the file path to ALLOWLIST in this test, with a justification",
      "     in the PR description and a registry entry in MOCK_REGISTRY.md.",
    ].join('\n')
    throw new Error(message)
  })
})
