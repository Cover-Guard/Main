# 01 — Workflow Fabric

**Theme addressed:** "The data is good; the workflow is thin."
**Horizon:** 2 quarters (Q3–Q4 2026)
**Executive sponsor:** Head of Product
**Lead owner:** VP Engineering, Agent Platform

---

## 1. Thesis

CoverGuard's diagnostic is best-in-class and defensible. What's missing is the *connective tissue* around it — the alerts that push insights to users instead of waiting to be pulled, the CRM surfaces that keep an agent inside the product between reports, the integrations that let CoverGuard write into the systems users already live in, and the branded artifacts that make the data shareable.

Every user interview reaches the same conclusion: "The data is right. But then what?" The Workflow Fabric initiative builds the "then what."

## 2. Why This Is Cross-Cutting

Every persona hits the same wall at a different angle:

- The Sales Agent gets a perfect report, then re-enters the data into their AMS and their CRM by hand.
- The Loan Officer gets a link and has to manually attach it to the loan file.
- The Realtor gets a PDF that does not carry their brand, has no call-to-action back to CoverGuard, and cannot be tracked.
- The Buyer gets the report, cannot act on it, and churns before the agent can intervene.

No single feature fixes this. It is a cross-cutting workflow problem.

## 3. Scope and Workstreams

The initiative is organized into five parallel workstreams:

### 3.1 Alerting Platform

A unified notification bus that any feature can publish to. v1 channels: in-app, email, mobile push (when app ships), weekly digest.
Deliverables: event schema, subscription-preference UI, delivery SLAs, bounce / unsubscribe handling.

### 3.2 Lightweight CRM Module

Contacts, pipeline stages, tasks, notes — intentionally *not* a full CRM. The goal is to keep an agent inside CoverGuard between reports, not to compete feature-for-feature with AgencyZoom or Salesforce.
Deliverables: contact model, pipeline kanban, task / reminder system, bulk CSV import, two-way sync hook for AgencyZoom.

### 3.3 Integration Hub

Outbound + inbound connectors to the systems agents and lenders already live in.
v1 connectors, in priority order: AMS360, QQCatalyst, Encompass (LOS), Blend (LOS), HubSpot, Salesforce Financial Services Cloud. Each is a scoped mini-project.
Deliverables: connector framework, OAuth flows, data-mapping UI, sync-health dashboard, retry / replay logic.

### 3.4 Branded Artifact Engine

A rendering pipeline that produces the report — and, eventually, all other shareable artifacts (pre-approval PDF, carrier-exit alert PDF, mitigation plan PDF) — in a user's brand.
Deliverables: brand-upload flow, template engine, tenancy model (agent, agency, lender brands), stateful artifact history for tracking.

### 3.5 Hand-Off Surface

When a buyer hits the paywall, when a realtor wants to forward a listing, when an LO wants to bring an agent in — there is a structured hand-off with attribution.
Deliverables: magic-link hand-off routing, attribution tagging, referral-reporting surface, email templates library.

## 4. Integration with Existing Roadmap

Every enhancement-roadmap Tier-1 item and every value-add activity benefits from this initiative:

| Roadmap / VA item | How Workflow Fabric enables it |
|---|---|
| Carrier-exit alert (VA-01) | Runs on the unified Alerting Platform |
| Co-branded PDF (T1 #2) | Rendered by the Branded Artifact Engine |
| Agent KPI dashboard (T1 #5) | Pipeline data comes from the Lightweight CRM Module |
| Realtor/LO read-only portal (T1 #6) | Hand-Off Surface provides attribution and magic-link flow |
| LOS integrations (T2 #8) | Ships inside the Integration Hub |
| Pre-approval gate PDF (VA-05) | Branded Artifact Engine + Integration Hub for auto-attach |
| Re-shop opportunity feed (VA-07) | Data via Integration Hub; alerts via Alerting Platform |

## 5. Milestones

| M# | Milestone | Target | Exit criteria |
|---|---|---|---|
| M1 | Alerting Platform v1 in production | End of Q3 W4 | VA-01 carrier-exit alert ships on top of it |
| M2 | Branded Artifact Engine v1 | End of Q3 W8 | Co-branded PDF (T1 #2) ships on top of it |
| M3 | CRM Module v1 | End of Q3 W12 | 100 agents actively use pipeline |
| M4 | Integration Hub — AMS360 connector GA | End of Q4 W4 | 20 agencies live-synced |
| M5 | Integration Hub — Encompass + Blend GA | End of Q4 W8 | 5 lenders live |
| M6 | Hand-Off Surface v1 | End of Q4 W12 | Attribution measurable across buyer → agent flow |

## 6. Success Metrics

- **Time between reports per agent** drops from baseline → ≥2x frequency (agent stays engaged between reports).
- **% of reports shared via branded artifact** ≥ 60%.
- **Alerts opened ≥ 40%**, alerts that produce a follow-on action ≥ 15%.
- **Agents with CRM data** → 70% of active agents log ≥ 5 contacts in the first 30 days post-activation.
- **AMS-synced agencies** ≥ 50 by end of Q4.
- **Net revenue retention lift** attributable to Workflow Fabric vs. control → measurable in quarterly cohort analysis.

## 7. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| CRM scope creep turns into a second product | High | Strict "good enough to keep agent in CoverGuard" charter; re-review scope monthly |
| Integration Hub becomes perpetual-connector factory | Medium | Ship a connector framework first; each connector is a time-boxed mini-project |
| Alert fatigue | Medium | Digest mode, explicit opt-in per category, default to conservative frequencies |
| Branded artifacts blur compliance lines (agent claiming carrier endorsement) | Medium | Hard guardrails in template engine; legal review before brand-upload flow ships |
| Partner resistance to AMS / LOS integration | Medium | Lead with AMS360 (dominant share) and Encompass (dominant LOS); prove ROI before expanding |

## 8. Dependencies

- Mobile app shell (needed for push channel of Alerting Platform)
- Legal sign-off on branded artifact compliance
- Partnership deals signed with AMS and LOS vendors
- Data infrastructure headroom for event-stream volume (alerts)

## 9. Open Questions

- Do we productize the Integration Hub as a paid tier, or bundle?
- Should CRM data live in CoverGuard's own database or sync-only from agency CRMs?
- What is the right brand-hierarchy model when an agent works under multiple agencies?
