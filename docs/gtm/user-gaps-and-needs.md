# CoverGuard — User Gaps, Needs & Value-Add Map

**Audience:** Product, Marketing, GTM
**Purpose:** Synthesize the most acute pain points across CoverGuard's user types, and map each pain to a value-added activity the platform already does — or should do.

---

## 1. Stakeholders & Their Top Pains

### Insurance Sales Agent (primary GTM target)

| Pain | Evidence in market | Where CoverGuard helps today | Where it falls short |
|---|---|---|---|
| 50%+ aggregator leads are bogus | Independent agent surveys 2025–26 | Replaces aggregator funnel with realtor / LO referral funnel | No native lead-capture or CRM |
| Carrier exits leaving books unrenewed | State Farm CA, Allstate, Farmers FL, Citizens FL | Carrier-availability map identifies replacements | No proactive renewal monitoring or alerting |
| 82% client churn on slow first response | J.D. Power digital insurance studies | 90-second binding-ready quote | Not surfaced as an SLA tracker for the agent |
| Coverage transparency gaps in online quotes | NAIC and J.D. Power complaints | Multi-peril risk score gives agents a coverage-conversation hook | No plain-English coverage explainer |
| Compliance / disclaimer burden | State DOI rules, varying carrier appointment terms | n/a | No state-aware compliance layer |

### Real Estate Agent (channel partner)

| Pain | Where CoverGuard helps today | Where it falls short |
|---|---|---|
| Deals collapsing at closing due to insurability | Pre-offer report stops this | Realtor sees the report only if agent shares; no native realtor login |
| Hard markets making listings unsellable | Carrier-availability map | No "comp" view of insurability across similar listings |
| Buyers walking after seeing premium quotes | Quick quote sets expectations | No premium-mitigation guidance ("install storm shutters → save $X") |

### Loan Officer / Mortgage Lender

| Pain | Where CoverGuard helps today | Where it falls short |
|---|---|---|
| Underwriting wasted on uninsurable properties | API can be integrated | No off-the-shelf LOS integration (Encompass, Blend, Byte) |
| Force-placed insurance complaints | Pre-bind verification | No active monitoring of policy-in-force status post-close |

### Home Buyer (acquisition top of funnel)

| Pain | Where CoverGuard helps today | Where it falls short |
|---|---|---|
| Doesn't know if a home is insurable until escrow | Free report (3 complimentary) | After 3 reports, paywall pushes buyer to agent — but the handoff is informal |
| Doesn't understand peril scores | Score is shown | No plain-language explainer or recommended actions |
| Surprised by premium amount | Quote is shown | No "how to lower this" guidance |

### Carrier / MGA (data buyer)

| Pain | Where CoverGuard helps today | Where it falls short |
|---|---|---|
| Adverse selection in hardening markets | Anonymized signal that carrier is "open" can be flipped into appetite tuning | No appetite-management tooling for carriers |

## 2. Cross-Cutting Themes

Three patterns emerge across personas:

1. **The data is good; the workflow is thin.** CoverGuard's diagnostic is best-in-class. What's missing is the connective tissue around it — CRM, alerting, hand-offs, integrations, branded artifacts.
2. **Multi-stakeholder, single-tenant UX.** Buyer, agent, realtor, and LO all need the same data, but each needs a different surface. Today the surface is essentially one — the report.
3. **Reactive, not predictive.** The platform tells you what is true today. Insurance is a renewal business; the bigger value lever is telling agents what is *about to be true* (carrier withdrawing, premium spike likely, mitigation could lower rate).

## 3. Value-Add Activities to Surface in the Platform UI

The activities below already provide value but are under-merchandised. These should be elevated in onboarding, dashboards, and weekly digests:

- **"Carrier just exited your ZIP" alert** — push notification to every agent whose book overlaps that ZIP.
- **"Property comparable" insurability score** — for realtors comparing two listings.
- **"Insurability heat map"** — neighborhood-level overview, used by agents to prospect realtors.
- **"Bind path" indicator** — green/yellow/red on every report telling the agent how easy the bind will be.
- **"Pre-approval gate"** — branded CoverGuard PDF a loan officer can drop into a borrower file.
- **"Mitigation savings calculator"** — "install hurricane shutters → save $1,840/yr" — drives buyer engagement and gives the agent a re-quote reason.
- **"Re-shop opportunity" feed** — for an agent's existing book, who is most likely to non-renew next.
- **"Realtor leaderboard"** — show an agent which realtors send them the most reports → request more from those who don't.

## 4. The Gap Map (Pain → Feature)

Used as the input to the enhancement roadmap:

| Pain | Enhancement (see roadmap) |
|---|---|
| No agent CRM | Lightweight pipeline & contact module |
| Carrier exits surprise the book | Carrier-appetite monitoring & alerts |
| Premium objections | Mitigation savings calculator |
| LO has to manually pull a report | Encompass / Blend integration |
| Buyer drops off after free reports | Hand-off SMS to local CoverGuard-enrolled agent |
| Compliance | State-aware disclaimer engine |
| Realtor doesn't know who to call | Realtor self-serve portal (read-only) |
| Lookalike property selection | Bulk / portfolio analysis for investors and CRE |
| Climate uncertainty | 30-year forward-looking peril forecast |
| Carrier appetite changes weekly | Public "Carrier Open/Closed by ZIP" status page |
