# 08 — Realtor Leaderboard

**Priority:** P2
**Owner:** Agent Platform
**Effort:** S (2 weeks)

## 1. Summary

A per-agent leaderboard showing which realtors send the most inbound CoverGuard report requests — and, inversely, which realtors were engaged once and have gone quiet. Drives deliberate partner cultivation: the agent knows who to thank, who to re-engage, and where to invest follow-up energy.

## 2. Trigger

- Agent opens the dashboard.
- Weekly digest email.

## 3. Audience

- Primary: Sales Agents who have a referral funnel from realtors.
- Secondary: Agency principals managing a team of agents.

## 4. Data Sources

- Report-delivery log (already captured) with realtor ID, report timestamp, agent-attribution
- Realtor identity — derived from the realtor who triggered the report (read-only portal login) or tagged by agent on manual report sends

## 5. UX Surface

- Leaderboard table on agent dashboard: realtor name, reports last 30/90 days, reports last year, last activity date.
- Quiet-list section: realtors who sent 3+ reports in the last 12 months but 0 in the last 60 days.
- One-click actions: email template "I haven't heard from you in a while — here's a new ZIP-level insurability trend for your listings."

## 6. Notification / Delivery Rules

- Weekly digest summarizing top 3 realtors and top 3 quiet-list realtors.
- Immediate in-app highlight when a new realtor crosses a milestone (first report, 10th report).

## 7. Success Metrics

- **Engagement:** ≥50% of agents visit the leaderboard weekly.
- **Partner activation:** "quiet list" re-engagement click-through results in a new report within 14 days at ≥20% rate.
- **Referral volume:** overall realtor-sourced reports per agent trend up quarter over quarter.

## 8. Dependencies

- Realtor read-only portal (Tier-2 roadmap) — without it, realtor identity is patchy.
- Report-delivery log must be enriched with attribution metadata.

## 9. Out of Scope

- Public realtor rankings or league tables — this is an agent-private view.
- Realtor gamification rewards — out of remit.

## 10. Open Questions

- Do we allow agents to manually annotate a realtor's status ("warm," "cold," "partner")?
- Should this integrate with the agent's CRM module once built?
