# 02 — Role-Based Surfaces

**Theme addressed:** "Multi-stakeholder, single-tenant UX."
**Horizon:** 2–3 quarters (Q4 2026 – Q1 2027)
**Executive sponsor:** Head of Product
**Lead owner:** Design + Web Platform

---

## 1. Thesis

Buyer, Sales Agent, Realtor, Loan Officer, and Carrier all need access to the same underlying CoverGuard data — but each needs a fundamentally different surface. Today the product exposes effectively one surface (the report) and forces every persona to conform to it. Role-Based Surfaces splits the product into persona-tailored entry points so each user gets the tool that fits their job without changing the underlying data model.

This is not a re-skin. It is a rethink of where each persona *enters* the product, what they see *first*, and what actions they can *finish* without leaving that surface.

## 2. Why This Is Cross-Cutting

The single-surface problem shows up in every part of the product:

- The buyer sees an agent-style dashboard with no guidance.
- The agent sees a buyer-style single-report view with no pipeline.
- The realtor has to create an account they will never reuse to see a report.
- The loan officer gets a link that does not fit into their loan-file workflow.
- The carrier data partner has no admin surface at all.

Each of these frictions bleeds conversion at a different point in the funnel. Role-Based Surfaces fixes all of them.

## 3. Scope and Workstreams

Five parallel (and partially independent) surfaces:

### 3.1 Agent Workbench

The primary retention surface for paying Sales Agents.

First-screen content:

- Daily "what needs your attention" digest
- Bind-path indicator rollup across active deals
- Re-shop opportunity feed (VA-07)
- Realtor leaderboard (VA-08)
- Quick-run report from the top nav

Design principle: the agent should never need more than two clicks to get from "I have an address" to "I have a quote."

### 3.2 Realtor Portal (Read-Only)

Magic-link, no password, no long-form signup.

First-screen content:

- Reports the realtor has seen, grouped by MLS listing
- Insurability heat map for their listing footprint
- One-click "forward to my preferred agent" action
- Agent attribution (which agent invited them)

Design principle: low-friction, agent-attribution-preserving, share-friendly.

### 3.3 Loan Officer Workbench

Tight fit to the loan-file workflow. Designed to co-exist with the LO's LOS (Encompass / Blend), not replace it.

First-screen content:

- Borrowers by stage (pre-approval, processing, closing)
- Flag: uninsurable or at-risk properties in the pipeline
- Pre-approval gate PDF generator (VA-05)
- Escalation path to CoverGuard-enrolled agents

Design principle: the LO should never have to leave their LOS for more than 30 seconds.

### 3.4 Buyer Guided View

The freemium buyer surface. A wizard, not a dashboard.

First-screen content:

- Address entry with autocomplete
- Clear plain-English explainer of what each peril means
- Bind-path indicator (VA-04) front and center
- Clear hand-off to a local CoverGuard-enrolled agent when the buyer wants to move forward

Design principle: the buyer should feel informed, not overwhelmed.

### 3.5 Carrier Partner Console

A new surface for carrier / MGA partners who buy CoverGuard data.

First-screen content:

- Appetite-management UI (update ZIPs, perils, premium bands)
- Inbound quote-request volume and conversion
- Competitive-appetite intelligence (anonymized)
- Data-product usage reporting

Design principle: carriers are a revenue line, not a user; treat their console with the same product rigor as agent surfaces.

## 4. Integration with Existing Roadmap

| Existing item | Surface home |
|---|---|
| Agent KPI dashboard (T1 #5) | Agent Workbench |
| Realtor / LO read-only portal (T1 #6) | Realtor Portal + LO Workbench |
| Realtor leaderboard (VA-08) | Agent Workbench |
| Pre-approval gate PDF (VA-05) | LO Workbench |
| Mitigation savings calculator (VA-06) | Buyer Guided View (primary), Agent Workbench (secondary) |
| Carrier appetite management dashboard (T2 #15) | Carrier Partner Console |
| Bind-path indicator (VA-04) | Everywhere, but primary in Buyer Guided View |

## 5. Design Principles

- **One tenant, many surfaces.** Data access is governed by role, not by product.
- **Role is explicit at sign-in.** No "which are you today?" ambiguity.
- **Every surface has a signature first-run.** No blank dashboards; the first screen produces value in under 10 seconds.
- **Hand-offs preserve attribution.** When a buyer becomes an agent referral, when a realtor forwards to an agent, when an LO escalates — the origin is tracked.

## 6. Milestones

| M# | Milestone | Target | Exit criteria |
|---|---|---|---|
| M1 | Role model + permissions refactor | Q4 W2 | Multi-role user can switch surfaces |
| M2 | Agent Workbench GA | Q4 W8 | 80% of paid agents default-land on Workbench |
| M3 | Buyer Guided View GA | Q4 W10 | Free-tier activation rate ≥ 2x baseline |
| M4 | Realtor Portal GA | Q1 W4 | ≥ 5k realtors active, ≥ 30% repeat-visit rate |
| M5 | LO Workbench GA | Q1 W8 | First 10 lender partners using it daily |
| M6 | Carrier Partner Console GA | Q1 W12 | First paid carrier tenant live |

## 7. Success Metrics

- **Activation rate per persona** measured separately (buyer, agent, realtor, LO, carrier).
- **Time-to-first-value** per persona under target:
  - Buyer < 60 seconds
  - Agent < 2 minutes
  - Realtor < 30 seconds (magic-link)
  - LO < 90 seconds
- **Hand-off conversion** (buyer → agent, realtor → agent, LO → agent) — net positive lift over current flow.
- **Surface-specific NPS** above 40 for each persona within two quarters of GA.

## 8. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Role proliferation creates permission complexity | High | Start with 5 hard-coded roles; no custom roles in v1 |
| Surface fragmentation dilutes brand | Medium | Shared design system, single design language across surfaces |
| Carrier Console takes on enterprise-sales drag | Medium | Productize to a tier with strict scope; avoid bespoke carrier builds |
| Buyer Guided View cannibalizes agent lead flow | Medium | Every buyer session has a local-agent hand-off; buyer surface is top-of-funnel, not bottom |

## 9. Dependencies

- Workflow Fabric (PR-3 §01) for Branded Artifact Engine, Hand-Off Surface, Alerting Platform.
- Shared design system extension for multi-surface consistency.
- Integration Hub coverage for LOS and AMS so the LO and Agent Workbenches can pull live data.

## 10. Open Questions

- Do we require separate login per role, or support role-switching within a single account?
- Does the Buyer Guided View need a white-label mode for realtor / LO embeds?
- What is the data-governance model between carrier console and agent data?
