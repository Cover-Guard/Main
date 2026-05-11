# Mock-Data Registry

**Status:** Living document. Append a row to the inventory and check it into git whenever a new mock-data module is introduced.
**Effort ID:** P-B2 (initial), recurring.
**Policy lever:** `apps/web/__tests__/mock-imports.test.ts` (added in this PR) enforces the rules below.

---

## Why this exists

CoverGuard already has a demo-mode toggle at `apps/web/src/lib/mockData.ts` (`isDemoMode()` reads `localStorage.coverguard-demo-mode`). But it is not consistently enforced — there are mock-data modules imported unconditionally by production components. The most visible case: 7 panels under `apps/web/src/components/dashboard/enhanced/` import from `./mockData.ts` without checking demo mode, so agents see fabricated KPIs, clients, carriers, and forecasts on the new dashboard regardless of environment.

This registry is the single source of truth for what's mocked, where it's imported, and whether each import is guarded. A small CI test enforces the policy so the next mock import has to either pass through the gate or get added here.

---

## Inventory (as of 2026-05-11)

### Mock-data modules

| Path | What it exports | Status |
|---|---|---|
| `apps/web/src/lib/mockData.ts` | Demo-mode helpers (`isDemoMode`, `setDemoMode`), seeded property / client / analytics fixtures anchored to real high-risk markets | OK — gated by `isDemoMode()` consumers are supposed to check |
| `apps/web/src/components/dashboard/enhanced/mockData.ts` | `ACTIVE_CARRIERS`, `CLIENTS`, `FORECAST_DATA`, `FORECAST_EXTENDED`, `INSIGHTS`, `KPI_DETAILS`, `KPI_HISTORY`, `PORTFOLIO_DETAILS`, `PORTFOLIO_MIX`, `RISK_ANNOTATIONS`, `RISK_EXTENDED`, `RISK_TREND_DATA`, plus a `MESSAGES` thread for the AgentChatPanel preview | **BLOCKING** — exported and imported unconditionally; 7 panels render fabricated data without a demo-mode check |
| `packages/shared/src/utils/StubLlmAdapter.ts` | `StubLlmAdapter` implementing the `LlmAdapter` contract with deterministic templated text | **BLOCKING** — the AI Advisor uses this in lieu of a real Anthropic call; covered by effort P-B3 |

### Importers — full crawl

| Importer | Imports from | Gated by `isDemoMode()`? |
|---|---|---|
| `apps/web/src/components/dashboard/AgentDashboard.tsx` | `apps/web/src/lib/mockData.ts` | Verify — should be gated |
| `apps/web/src/components/toolkit/ToolkitContent.tsx` | `apps/web/src/lib/mockData.ts` | Verify — should be gated |
| `apps/web/src/components/dashboard/enhanced/ActiveCarriersPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `apps/web/src/components/dashboard/enhanced/ClientManagementPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `apps/web/src/components/dashboard/enhanced/ForecastPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `apps/web/src/components/dashboard/enhanced/InsightsPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `apps/web/src/components/dashboard/enhanced/KPIPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `apps/web/src/components/dashboard/enhanced/PortfolioMixPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `apps/web/src/components/dashboard/enhanced/RiskTrendPanel.tsx` | `./mockData` (enhanced) | **No** — must be gated in PR-B2.b |
| `packages/shared/src/index.ts` | Re-exports `StubLlmAdapter` from `./utils/StubLlmAdapter` | Used by production code path; covered by P-B3 |
| `packages/shared/src/__tests__/utils/llmAdapter.test.ts` | `StubLlmAdapter` | OK — test file |
| `packages/shared/src/__tests__/utils/narrativeEvalRunner.test.ts` | `StubLlmAdapter` | OK — test file |

---

## Policy

1. **Every mock-data module must be registered above.** Add a row before importing it from any non-test code.
2. **Production code that imports a registered mock module must gate the usage behind `isDemoMode()`** (or an equivalent demo flag).
3. **Tests are exempt** — files under `__tests__/`, `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` may import mock modules freely.
4. **`isDemoMode()` is the only source of truth.** Don't introduce parallel demo flags. If the helper needs to read an env var instead of localStorage in some context, extend the existing function rather than forking it.
5. **Stub adapters in `packages/shared/`** are treated the same as mock data. `StubLlmAdapter` stays in the registry until P-B3 ships the real adapter.

## CI guard

`apps/web/__tests__/mock-imports.test.ts` (added in this PR) does a static scan: it greps the web src tree for imports of `mockData` or files matching `Stub*Adapter`, and fails if any importer in a non-test path doesn't also reference `isDemoMode` somewhere in the same file. The check is intentionally lo-fi (regex, not AST) so it stays fast and obvious. False positives are easy to suppress by either:

- Adding the importer to the test's `ALLOWLIST` (and writing a one-line justification),
- Or wrapping the usage in `if (isDemoMode())`.

The point is to make "ship a new unguarded mock import" require a deliberate choice that shows up in code review, not a silent commit.

---

## Sequenced follow-ups

- **PR-B2.b** — Wrap every enhanced-dashboard panel import in an `isDemoMode()` gate. Where the gate is false, render a `PanelEmptyState` and start the real API fetch. Eight panels (the seven listed above plus the `SavedPropertiesPanel` variant under `enhanced/`).
- **PR-B2.c** — Tiny standalone PR adding `NEXT_PUBLIC_DEMO_MODE` to `.env.example` (env-var alternative to the localStorage toggle, for builds that need to bake demo mode in).
- **PR-B3** — Replaces `StubLlmAdapter` consumers with a real `AnthropicLlmAdapter`. After that PR, `StubLlmAdapter` drops from the BLOCKING list and stays only in test fixtures.

---

## Verification

A reviewer can sanity-check this registry by running:

```bash
# Mock-data modules in the repo
find apps packages -type f -name "mockData*" -o -name "Stub*Adapter*" 2>/dev/null \
  | grep -v node_modules | grep -v __tests__

# Production importers of the enhanced dashboard mock
grep -rln "from ['\"]\./mockData" apps/web/src/components/dashboard/enhanced/
```

Numbers should match the inventory above (2 mock-data files + 1 stub adapter; 7 enhanced-panel importers).

---

*Last updated: 2026-05-11 (initial registry).*
