#!/usr/bin/env node
/**
 * web-syntax-check.mjs — fast syntax/parse gate for the @coverguard/web app.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-05-13 the `competitive-scrub` commit (ee5b06c) shipped FOUR truncated
 * .tsx files (WhyCoverGuard.tsx, agents/page.tsx, carrier-availability/page.tsx,
 * InvestorsSection.tsx). Every one had unterminated JSX / string literals, so
 * `@coverguard/web` did not compile and `next build` would have failed. The
 * daily smoke + QA suite never caught it because that suite only does a static
 * review of `scripts/qa/smoke-test.ts` — it never parses or compiles the web app.
 *
 * This script closes that gap. It parses every .ts/.tsx/.js/.jsx file under
 * apps/web/src with the TypeScript compiler's PARSER (no type-checking, no
 * full dependency graph needed) and fails on any syntax/parse diagnostic —
 * exactly the TS17008 / TS1002 / TS1005 / TS1003 class of error that a
 * truncation produces.
 *
 * It is intentionally cheap: it needs only the `typescript` package (already a
 * devDependency of apps/web) and runs in well under a second. Add it to the
 * daily QA suite and to CI as a pre-build gate.
 *
 * USAGE
 *   node scripts/qa/web-syntax-check.mjs            # check apps/web/src
 *   node scripts/qa/web-syntax-check.mjs <dir...>   # check specific dirs
 *
 * EXIT CODES
 *   0  all files parsed clean
 *   1  one or more parse/syntax errors
 *   2  could not locate the `typescript` package
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

// Locate the `typescript` package from any of the usual monorepo locations.
function loadTypeScript() {
  const candidates = [
    path.join(repoRoot, 'node_modules', 'typescript'),
    path.join(repoRoot, 'apps', 'web', 'node_modules', 'typescript'),
    path.join(repoRoot, 'apps', 'api', 'node_modules', 'typescript'),
  ];
  for (const dir of candidates) {
    const entry = path.join(dir, 'lib', 'typescript.js');
    if (fs.existsSync(entry)) {
      const require = createRequire(import.meta.url);
      return require(entry);
    }
  }
  // Last resort: normal resolution.
  try {
    const require = createRequire(import.meta.url);
    return require('typescript');
  } catch {
    console.error(
      '[web-syntax-check] Could not find the `typescript` package. ' +
        'Run `npm install` first (typescript is a devDependency of apps/web).'
    );
    process.exit(2);
  }
}

const ts = loadTypeScript();

const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage']);

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(fp, acc);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(e.name)) {
      acc.push(fp);
    }
  }
  return acc;
}

const roots = process.argv.slice(2);
const targets = roots.length ? roots : [path.join(repoRoot, 'apps', 'web', 'src')];

let files = [];
for (const r of targets) {
  const abs = path.resolve(r);
  const stat = fs.existsSync(abs) ? fs.statSync(abs) : null;
  if (stat && stat.isDirectory()) files.push(...walk(abs, []));
  else if (stat) files.push(abs);
  else console.error(`[web-syntax-check] warning: path not found: ${r}`);
}

let errorCount = 0;
let checked = 0;

for (const file of files) {
  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  checked++;
  const kind = file.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : file.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : file.endsWith('.ts')
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const diags = sf.parseDiagnostics || [];
  for (const d of diags) {
    errorCount++;
    const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    const rel = path.relative(repoRoot, file);
    const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    console.error(`  ${rel}:${line + 1}:${character + 1}  TS${d.code}  ${msg}`);
  }
}

if (errorCount > 0) {
  console.error(
    `\n[web-syntax-check] FAIL — ${errorCount} parse error(s) across ${checked} file(s).`
  );
  process.exit(1);
}

console.log(`[web-syntax-check] OK — ${checked} file(s) parsed clean, 0 syntax errors.`);
process.exit(0);
