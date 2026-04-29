# Toolkit Redesign — Workflow Rail + Drawer

> Generated: 2026-04-29
> Branch: `feature/toolkit-redesign-workflow-rail`
> Closes: Toolkit UX gap — "tools open in bad places" + "tools don't help the user along their journey"

This spec covers the refactor of `apps/web/src/app/toolkit` from a flat
catalog grid to a numbered workflow rail with a consistent drawer pattern.

---

## What was wrong

A heuristic review of the existing Toolkit (`ToolkitContent.tsx` +
`ToolkitFeaturedRail.tsx`) surfaced 14 issues across three severity tiers.

### P0 — Critical

| # | Issue | Symptom |
|---|---|---|
| P0-1 | **Inconsistent open behavior** | `ToolkitFeaturedRail` opened tools via "Open tool →" links; the lower grid cards expanded inline via a chevron and `col-span-3`, pushing other tools off-screen. Two patterns for one action. |
| P0-2 | **Tool duplication** | Three of seven tools (`Cost Estimator`, `Hard Market Lookup`, `Email Templates`) appeared in both the featured rail and the lower grid, with names that drifted (`Cost Estimator` vs `Insurance Cost Estimator`). |
| P0-3 | **No journey** | The seven tools represent an agent's actual workflow (qualify → match → estimate → disclose → send) but were rendered as a random flat grid. |

### P1 — High

| # | Issue | Symptom |
|---|---|---|
| P1-1 | **Double headers** | Every lower-grid card had a small header (with `GripVertical` + icon + title) above a larger `iconBg` block that repeated the title. Looked like leftover scaffolding. |
| P1-2 | **Information-starved cards** | Featured cards had rich preview rows; lower-grid cards only had title + one-line description for the same tool. |
| P1-3 | **Inconsistent CTAs** | Featured: `Open tool →` link with arrow. Lower grid: chevron-only. User couldn't predict what each click would do. |
| P1-4 | **No tool chaining** | Finishing one tool didn't suggest the next. The agent had to manually open each tool and re-enter inputs. |
| P1-5 | **No grouping** | Estimators, lookups, templates, and references were all mixed in one grid. |

### P2 — Polish

| # | Issue | Symptom |
|---|---|---|
| P2-1 | **Wasted whitespace** | 7 tools in a 3-column grid left the bottom row sparse. |
| P2-2 | **"Customize" scope unclear** | Top-right Settings button — what does it customize? |
| P2-3 | **Naming collision** | Sidebar `Your Agent` (= AI assistant) collided with `Agent Toolkit` (= tools for human agents). |
| P2-4 | **Footer freshness ambiguous** | "Last synced: 4/28/2026..." in the footer — what's syncing? Tool definitions? Market data? |
| P2-5 | **No in-toolkit search** | Fine for 7 tools today, becomes essential past ~12. |
| P2-6 | **No when-to-use guidance** | One-line description per card. Not enough for a new agent to pick the right tool. |
| P2-7 | **No first-time orientation** | New agents saw the same screen as 5-year veterans. |
| P2-8 | **No personalization** | No usage tracking, no recents, no pin-favorites. |

---

## What changed

### Architecture

- **Single source of truth.** The previous `TOOLS` array (in `ToolkitContent.tsx`)
  and `FeatureCard` definitions (in `ToolkitFeaturedRail.tsx`) are merged into
  one canonical `TOOLS: ToolDefinition[]` array on `ToolkitContent.tsx`. Each
  tool now declares: `section`, `stage`, `label`, `whenToUse`, `freshness`,
  `preview[]`, `nextSteps[]`, `content`. Featured behavior is now a property
  (`pinned`, surfacing as a badge) rather than a duplicated component.
- **`ToolkitFeaturedRail.tsx` deleted.** Its responsibility moves into the
  canonical card preview rendering.
- **Drawer pattern via shadcn `Dialog`.** Custom-positioned `DialogContent`
  slides in from the right (`max-w-[680px]`) instead of the existing
  centered-modal default. The toolkit grid stays visible on the left so the
  agent never loses context.

### UX

| Fix | Implementation |
|---|---|
| **P0-3 Workflow rail** | `<section aria-labelledby="workflow-heading">` renders an `<ol>` of 5 numbered cards (Qualify → Match → Estimate → Disclose → Send) with `ChevronRight` connectors between them. |
| **P0-1 Single open pattern** | Every card opens the same `ToolDrawer`. Inline column-span expansion is removed entirely. |
| **P0-2 No duplication** | One canonical `TOOLS` array; `ToolkitFeaturedRail` deleted. |
| **P1-1 Single card design** | New `ToolCard` (workflow) and `ReferenceCard` (reference). No more inner `GripVertical` header above an `iconBg` block. |
| **P1-4 Next-steps handoff** | `ToolDrawer` footer renders chips for each `tool.nextSteps[]` entry; clicking opens the next tool with `prefillFromId`, surfacing a "Continued from X" banner. |
| **P1-5 Grouping** | `workflow` vs `reference` partitioned by `section`. |
| **P2-2 Customize scope** | `CustomizeDrawer` (separate Dialog) with grouped tool list, pin/visibility toggles. State persists to localStorage. |
| **P2-3 Naming collision** | `SidebarLayout.tsx`: `Your Agent` → `AI Assistant` (4 occurrences). |
| **P2-4 Per-tool freshness** | Drawer header shows a green `Info` banner with the tool's own freshness string. |
| **P2-5 Search** | Search input in toolkit header, cmd-K / ctrl-K shortcut. Filters `workflow` and `reference` independently. |
| **P2-6 When-to-use** | Each `ToolCard` has a "When to use" affordance backed by Radix `Tooltip`. |
| **P2-7 Onboarding** | First-time visitors see `OnboardingOverlay`, dismissible with "Don't show again" persisted to localStorage (`coverguard-toolkit-onboarding-done`). |
| **P2-8 Recents/Pinned** | Pinned tools (`coverguard-toolkit-pinned`) get a `📌 PINNED` badge; the most recently opened tool gets a `★ RECENT` badge. |

### Persistence keys (localStorage)

- `coverguard-toolkit-pinned` — JSON array of tool ids
- `coverguard-toolkit-hidden` — JSON array of tool ids
- `coverguard-toolkit-recents` — JSON array of tool ids (most recent first, capped at 8)
- `coverguard-toolkit-onboarding-done` — `"1"` once dismissed

All reads/writes are guarded with `try/catch` and SSR checks
(`typeof window === 'undefined'`) so the component is safe in App Router
and degrades gracefully when storage is blocked.

### Files touched

| File | Change |
|---|---|
| `apps/web/src/components/toolkit/ToolkitContent.tsx` | Refactor: kept all per-tool implementations (`CostEstimatorTool`, `ChecklistTool`, `DisclosureTool`, `HardMarketTool`, `CarrierLookupTool`, `ClientEmailTemplatesTool`, `PolicyTypeGuideTool`); replaced the `TOOLS` registry, `DEFAULT_LAYOUT`, and main `ToolkitContent` export. Added `ToolCard`, `ReferenceCard`, `EmptyResults`, `ToolDrawer`, `CustomizeDrawer`, `OnboardingOverlay`. |
| `apps/web/src/components/toolkit/ToolkitFeaturedRail.tsx` | Deleted (responsibility absorbed into `ToolkitContent`). |
| `apps/web/src/components/layout/SidebarLayout.tsx` | Renamed `Your Agent` → `AI Assistant` (4 occurrences) to fix the P2-3 collision with `Agent Toolkit`. |
| `docs/enhancements/toolkit-redesign.md` | This file. |

`apps/web/src/app/toolkit/page.tsx` is unchanged — it still imports
`ToolkitContent` and renders it inside `SidebarLayout`.

---

## Out of scope for this PR

These are intentionally deferred:

- **Backend prefill.** The `Prefilled` banner is currently visual; wiring
  actual cross-tool input prefilling will require a small shared `useToolState`
  hook (or Redux slice) and is best done as a follow-up so the visual + state
  work can be reviewed independently.
- **Drag-to-reorder customize.** The previous version had drag-to-reorder
  in the customize panel; the new version offers visibility/pin only. Stage
  ordering is now a fixed property of the workflow rail (you reorder by
  changing `tool.stage`). Re-add drag-to-reorder if Customer Success says
  agents miss it.
- **URL deep-linking** to a specific open tool (`?tool=cost-estimator`).
  Worth adding once the drawer ships.
- **Analytics events** for `tool_opened`, `next_step_clicked`,
  `pinned`, etc. Add when amplitude/segment is wired into the new code path.

---

## Test plan

Manual:
1. Open `/toolkit` — see 5-card workflow rail and 2-card reference section.
2. Click any workflow tool → drawer slides in from the right.
3. Inside the drawer, click a "Next steps" chip → next tool opens with
   "Continued from X" banner; first tool's drawer closes.
4. Reload — onboarding overlay shows on first visit only.
5. Search "carrier" → only Carrier Quick Lookup remains visible.
6. Open Customize → toggle Hidden on a tool → it disappears from rail
   without page reload.
7. Pin Cost Estimator → it shows `📌 PINNED` badge after closing customize.
8. Press `⌘K` / `Ctrl K` → search input gains focus.
9. `Esc` closes drawer → onboarding → customize, in that order of priority.

Automated tests live in `apps/web/src/__tests__/components/toolkit/` —
add coverage for: workflow vs reference partitioning, search filter,
pin/hide persistence, and prefill banner rendering.
