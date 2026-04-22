# 03 — Predictive Intelligence

**Theme addressed:** "Reactive, not predictive."
**Horizon:** 3–4 quarters (Q1–Q4 2027)
**Executive sponsor:** Chief Product Officer
**Lead owner:** Director, Data Science + Head of Risk Intelligence

---

## 1. Thesis

CoverGuard tells users what is true today. The greater commercial lever is telling them what is *about to be true*. Insurance is a renewal business and a risk-drift business; the agents, lenders, carriers, and homeowners who know sooner win more. Predictive Intelligence transitions CoverGuard from a point-in-time diagnostic into a forward-looking signal source.

Four predictive surfaces, each anchored in a real user decision:

1. **Carrier appetite forecasts** — which carriers are likely to tighten / exit / expand in which ZIPs over the next 30/90/180 days.
2. **Premium-spike alerts** — policies in the book most likely to see a material rate increase at next renewal.
3. **Non-renewal probability** — which policies carriers are most likely to decline to renew.
4. **Climate-adjusted long-term risk** — 5/10/30-year peril scores to complement the current snapshot.

Each is a separately modeled product but they share infrastructure, labels, and a common evaluation rubric.

## 2. Why This Is Cross-Cutting

Predictive signals only earn value if they are delivered at the right moment, to the right persona, with an obvious next action. That means the predictive workstreams only succeed when they are composed with the Workflow Fabric (alerting + integrations) and Role-Based Surfaces (persona-specific delivery). Predictive Intelligence is therefore deliberately scheduled after the other two cross-cutting initiatives have shipped.

Every persona benefits:

- **Agent** — proactive re-shop list instead of reactive scramble after non-renewal.
- **Realtor** — listing-level forecast of insurability risk before the offer window.
- **Loan Officer** — policy-in-force forecast for portfolio risk.
- **Buyer** — 10-year view on what the property's insurance will look like.
- **Carrier** — appetite decisions informed by competitive-market forecasts.

## 3. Scope and Workstreams

### 3.1 Carrier Appetite Forecast

Model the probability a given carrier will open, restrict, or exit a given ZIP over the next 30/90/180 days.

Approach:

- Features: historical appetite-delta patterns, carrier's recent filings (SERFF), catastrophe-event exposure, macro-level reinsurance signals, public earnings commentary.
- Labels: the actual open/closed/restricted status we observe in subsequent weeks.
- Baseline: persistence (today's state predicts future state). Beat it by target margin before shipping.

Delivery surfaces: agent carrier-exit alerts (VA-01), insurability heat map (VA-03), carrier partner console.

### 3.2 Premium-Spike Forecast

Model the probability and magnitude of a premium increase at the policy's next renewal.

Approach:

- Features: carrier-level filed rate changes (SERFF), ZIP-level loss experience, peril-score drift since policy inception, property-attribute changes (roof age advancing, etc.).
- Labels: realized premium change at renewal (requires AMS sync for ground truth).
- Output: probability × expected magnitude, fed into re-shop opportunity feed (VA-07).

Ethical and compliance note: premium prediction is sensitive; outputs must be framed as "expected range" not "confirmed price."

### 3.3 Non-Renewal Probability

Model the probability a carrier will non-renew a specific policy at its next renewal date.

Approach:

- Features: carrier-wide appetite tightening, individual policy claim history (where available), peril-score drift, property-attribute risk factors, geographic clustering of recent non-renewals.
- Labels: observed non-renewal outcomes.
- Output: a per-policy probability band, surfaced in the re-shop opportunity feed and agent workbench.

### 3.4 Climate-Adjusted Long-Term Risk

5/10/30-year forward projections of flood, fire, wind, and (where possible) hail exposure, property-specific.

Approach:

- License third-party climate models (competitive option: ClimateCheck, First Street Foundation, Cape Analytics Forecast) rather than building from scratch.
- Blend with CoverGuard's current peril stack into a "today + horizon" presentation.
- Expose in buyer surface, lender surface, and long-horizon investor surface.

Partnership vs. build decision: default is partner. Revisit build economics only if licensing cost exceeds modeled revenue at the 1M-property scale.

### 3.5 Shared Model Platform

The above four surfaces do not each need their own infrastructure. A shared model platform underpins them all.

Components:

- Feature store (offline + online)
- Experiment and evaluation framework (backtesting is non-negotiable in this space)
- Model-monitoring and drift-detection
- Explainability layer (every prediction must be accompanied by the top drivers, for trust and compliance)

## 4. Integration with Existing Roadmap

| Existing item | Model that powers it |
|---|---|
| Carrier-exit alert (VA-01) | Carrier Appetite Forecast |
| Re-shop opportunity feed (VA-07) | Premium-Spike + Non-Renewal models |
| Insurability heat map (VA-03) | Carrier Appetite Forecast (trend component) |
| Bind-path indicator (VA-04) | Carrier Appetite Forecast (real-time component) |
| 30-year forward-looking peril forecast (T3 #16) | Climate-Adjusted Long-Term Risk |
| Sales coaching AI (T3 #18) | Downstream consumer of deal-outcome data the models produce |

## 5. Milestones

| M# | Milestone | Target | Exit criteria |
|---|---|---|---|
| M1 | Shared Model Platform v1 (feature store + eval) | Q1 2027 W6 | First model goes through platform gate |
| M2 | Carrier Appetite Forecast v1 in shadow mode | Q1 2027 W10 | Beats persistence baseline by target margin on backtest |
| M3 | Carrier Appetite Forecast in production | Q2 2027 W4 | Powers VA-01 with measurable improvement over reactive alerts |
| M4 | Non-Renewal Probability in production | Q2 2027 W10 | Recall ≥ target in top-decile precision at a set threshold |
| M5 | Premium-Spike Forecast in production | Q3 2027 W6 | Agent feedback cycle — false-positive rate within tolerance |
| M6 | Climate-Adjusted Long-Term Risk (partner integration) | Q3 2027 W10 | Live in buyer surface |
| M7 | Model-monitoring + drift-detection in prod | Q4 2027 W4 | All four models monitored; alerting in place |

## 6. Success Metrics

- **Carrier Appetite model:** lead-time improvement on VA-01 alerts (days of warning before exit is otherwise visible). Target ≥ 14 days median.
- **Non-Renewal model:** top-decile precision ≥ target set by retention team, measured against observed non-renewal labels.
- **Premium-Spike model:** calibration error on expected magnitude within acceptable band; agent trust scores ≥ target.
- **Climate model:** buyer engagement lift on homes with material long-term risk changes.
- **Platform:** time from model idea → shadow deployment ≤ 4 weeks once platform is live.

## 7. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Model predictions are wrong and erode trust | High | Always ship with confidence bands and explainers; always provide an opt-out of the predictive surface |
| Regulatory exposure on premium / non-renewal predictions | High | Legal review pre-launch; clear disclaimers ("estimates, not commitments"); per-state compliance where required |
| Label scarcity (we don't have ground-truth renewal outcomes without AMS sync) | High | Gate model rollout on Integration Hub AMS coverage milestones |
| Partner climate models may have their own inaccuracies | Medium | Vendor evaluation with side-by-side backtests; no single-vendor lock-in |
| Building the platform becomes the work instead of shipping the models | Medium | Platform v1 is minimum viable: a feature store and an evaluator, not a reinvention of MLOps |

## 8. Dependencies

- Workflow Fabric complete (alerting, integrations, hand-offs) — blocker for delivering predictions.
- Role-Based Surfaces shipping — blocker for rendering predictions in persona-appropriate ways.
- AMS sync coverage at ≥50 agencies — blocker for ground-truth labels.
- Legal review of predictive disclaimers and state-specific compliance.
- Budget for climate-model licensing.

## 9. Open Questions

- Do we publish model cards for transparency, or keep internal only?
- Is there a revenue line specifically around predictive feeds to carriers / reinsurers?
- How do we handle the case where the model predicts a non-renewal but the agent's relationship with the carrier overrides it?
- Where does "personalization" cross over into "discrimination" for premium-spike predictions — what audit is required?
