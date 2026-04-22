# 01 — "Carrier just exited your ZIP" Alert

**Priority:** P0
**Owner:** Notifications platform + Carrier Data team
**Effort:** S (2 weeks)

## 1. Summary

Push an alert to every CoverGuard agent whose book of business overlaps a ZIP when a carrier's appetite for that ZIP changes — exit, re-entry, or meaningful restriction change. This is the single most requested agent feature in hardening markets and leverages the carrier-availability dataset CoverGuard already maintains.

## 2. Trigger

A daily delta-detection job compares today's carrier-availability snapshot to yesterday's. An "exit" is recorded when a carrier that was `open` for a ZIP is now `closed` or `restricted`. A "reopen" fires in the reverse direction.

## 3. Audience

- Primary: insurance Sales Agents whose book of business (uploaded CSV or synced from AMS) includes at least one property in the affected ZIP.
- Secondary: Realtors in the affected ZIP who have received a CoverGuard report in the last 90 days.

## 4. Data Sources

- Carrier availability dataset (CoverGuard internal, 150+ carriers)
- Agent book of business (CSV upload, optional AMS sync: AMS360, QQCatalyst)
- Realtor report recipients (report-delivery log)

## 5. UX Surface

- In-app banner on agent dashboard: "⚠️ State Farm closed 94103. 4 policies in your book are exposed."
- Click-through opens a filtered list of affected policies with a one-click "Run replacement quote" action.
- Push notification via mobile app (when shipped) and email digest option.

## 6. Notification / Delivery Rules

- Default delivery: email + in-app banner.
- Digest mode: agents with >5 alerts/day can collapse to daily 8am digest.
- Critical-only: toggle limits alerts to exits (no reopens, no restrictions).
- Opt-out is explicit; default is opt-in.

## 7. Success Metrics

- **Activation:** 80% of agents with a book uploaded turn on alerts.
- **Impact:** 30% of exit alerts result in a replacement-quote run within 72 hours.
- **Retention lift:** measurable lift in the retention rate of policies in alerted ZIPs vs. non-alerted ZIPs (a/b controlled).

## 8. Dependencies

- Book-of-business upload UX (already planned).
- Delta-detection job (new, Airflow or cron).
- Email service provider with high deliverability (SendGrid / Customer.io).

## 9. Out of Scope

- Auto-remarketing — we alert, we don't auto-rebind.
- Carrier-internal appetite scoring — v1 treats the entire ZIP as the unit of change.

## 10. Open Questions

- Do we also alert on premium-increase signals, not just appetite?
- How do we treat multi-ZIP carriers that partially restrict?
- Should realtors get the alert on any report they've pulled or only for active listings?
