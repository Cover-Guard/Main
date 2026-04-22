# CoverGuard — Enhancement Feature Roadmap

**Audience:** Product, Engineering, GTM
**Purpose:** Prioritized list of feature enhancements to close the gaps surfaced in `user-gaps-and-needs.md`.
**Method:** Each feature is sized (T-shirt), scored on impact (1–5) and effort (1–5), and assigned a tier.

---

## Tier 1 — Quick Wins (do in next 1–2 quarters)

| # | Feature | Pain solved | Impact | Effort | Notes |
|---|---|---|:-:|:-:|---|
| 1 | **Carrier-appetite alerts** — push when a carrier exits / reopens a ZIP in agent's book | Carrier exit surprise | 5 | 2 | Reuses existing carrier data; just a delta-detection job |
| 2 | **Co-branded PDF report** with agent's logo, photo, and contact CTA | Realtor & buyer trust | 4 | 2 | High pull from agent feedback |
| 3 | **Mitigation savings calculator** ("install storm shutters → save $X") | Premium objections | 4 | 3 | Requires carrier discount data; partner with FORTIFIED, IBHS |
| 4 | **Plain-English coverage explainer** in every report | Buyer confusion, agent talk track | 4 | 2 | LLM-generated, agent can edit |
| 5 | **Agent dashboard with KPIs** (reports, quote rate, bind rate, days-to-bind) | Performance visibility | 4 | 3 | Drives stickiness |
| 6 | **Realtor / LO read-only portal** | Sharing friction | 4 | 3 | Magic-link based, no full account needed |
| 7 | **Bind-path indicator (Green/Yellow/Red)** on every report | Setting expectations | 5 | 1 | Pure UI surface of data already computed |

## Tier 2 — Strategic Bets (next 2–4 quarters)

| # | Feature | Pain solved | Impact | Effort | Notes |
|---|---|---|:-:|:-:|---|
| 8 | **LOS integrations** — Encompass, Blend, ICE, Byte | Lender adoption | 5 | 4 | Distribution unlock; partnership-heavy |
| 9 | **Lightweight CRM module** (contacts, pipeline, tasks) | Agent has no system | 4 | 4 | Compete with AgencyZoom on convenience, not depth |
| 10 | **Re-shop opportunity feed** — flag book entries likely to non-renew | Renewal retention | 5 | 4 | Combines carrier-exit data + book of business upload |
| 11 | **State-aware compliance & disclaimer engine** | DOI compliance | 4 | 3 | Critical for multi-state agents |
| 12 | **Mobile app for agents** — pull a report from an open house | Time / location | 4 | 3 | Big retention multiplier |
| 13 | **Embedded insurability widget for MLS / Zillow / Redfin** | Top-of-funnel scale | 5 | 5 | Data partnership lift; biggest acquisition lever |
| 14 | **Bulk / portfolio analysis** for CRE and investors | Different segment | 4 | 4 | Opens commercial line of business |
| 15 | **Carrier appetite management dashboard** for carriers/MGAs | Adverse selection | 4 | 4 | Two-sided data play; new revenue line |

## Tier 3 — Defensible Long-Bets (4+ quarters)

| # | Feature | Pain solved | Impact | Effort | Notes |
|---|---|---|:-:|:-:|---|
| 16 | **30-year forward-looking peril forecast** | Climate uncertainty | 4 | 5 | Competes with ClimateCheck; consider partner license vs build |
| 17 | **Public "Carrier Open/Closed by ZIP" status page** | SEO / brand moat | 5 | 3 | Powerful organic acquisition driver; gates depth behind sign-up |
| 18 | **Sales coaching AI** — analyzes agent's win/loss by carrier and ZIP | Performance lift | 4 | 5 | Requires deal-outcome data |
| 19 | **Real-time policy-in-force monitoring** post-bind | Lender force-placed risk | 3 | 4 | Pulls from carrier policy systems via partner data |
| 20 | **Multi-language UX (Spanish first)** | FL / CA / TX markets | 3 | 3 | Disproportionate impact in Hispanic-majority ZIPs |

## Scoring Method

- **Impact 1–5:** projected effect on activation, retention, expansion, or differentiation.
- **Effort 1–5:** engineering + partnership + GTM lift to ship.
- **Tier rule:** Tier 1 must be Impact ≥ 4 and Effort ≤ 3. Tier 2 strategic bets are Impact ≥ 4. Tier 3 are long-horizon or moat plays.

## Recommended Sequencing

1. **Ship Tier 1 #7, #2, #1, #4** in the next 30 days — they reuse existing data and require only UI/notification surfaces. They make the platform demonstrably "agent-first" without engineering heavy lifts.
2. **Stand up Tier 1 #5 and #6** in 60 days. They drive habit formation and viral hand-offs.
3. **Tier 2 #8 (LOS) and #13 (MLS embed)** are partnership-led; sales should start outreach now even if engineering is 2 quarters out.
4. **Tier 3** items get a strategic review in Q4 2026 once the agent funnel is producing.

## Risks

- **Building a CRM (#9)** can become a tar pit. Keep it intentionally lightweight — bias toward "good enough to keep the agent in CoverGuard" rather than competing feature-for-feature with AgencyZoom or Salesforce.
- **MLS / Zillow embed (#13)** has high upside but they may build it themselves. Move first, lock in exclusivity windows.
- **Climate forecast (#16)** has Cape Analytics / ClimateCheck moats. Consider partner-and-relabel before building.
