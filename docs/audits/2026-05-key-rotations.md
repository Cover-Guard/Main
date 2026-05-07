# Secret Rotation Runbook & Log

**Status:** Living document — append a row to the log every time a sensitive secret is rotated.
**Effort ID:** P-A5a (initial), P-A5b (RLS audit + webhook off service-role), recurring.

---

## Why this exists

CoverGuard's API uses several long-lived secrets. The most consequential is `SUPABASE_SERVICE_ROLE_KEY` — it bypasses Row-Level Security and grants full database access. There is currently no rotation cadence and no record of when these secrets were last rotated.

This runbook standardizes the procedure and captures the evidence in one place. The first entry is reserved for the P-A5a rotation that this PR triggers.

---

## Secrets in scope

| Secret | Where stored | Blast radius | Rotation cadence |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, Vercel, Railway, GitHub Actions | Full DB read/write, bypasses RLS | At least every 90 days, immediately on suspected exposure |
| `SUPABASE_ANON_KEY` | Same as above + browser | Limited by RLS | Every 180 days |
| `STRIPE_SECRET_KEY` | Stripe, Vercel, Railway, GitHub Actions | Stripe account write access | Every 180 days, immediately on Stripe account compromise notice |
| `STRIPE_WEBHOOK_SECRET` | Same | Webhook signing — wrong value just makes webhook 400 | When endpoint URL changes; otherwise long-lived |
| `JWT_SECRET` | Same | Currently unused per `.env.example` comment; safe to omit. If introduced later, rotate every 180 days. | n/a |
| `ANTHROPIC_API_KEY` | Anthropic console, Vercel, Railway, GitHub Actions | LLM cost meter | Every 180 days, immediately on exposure |
| `ATTOM_API_KEY`, `FBI_CDE_KEY`, `WALK_SCORE_API_KEY` | Vendors, Vercel, Railway, GitHub Actions | Vendor-specific quota | Every 365 days |
| `GOOGLE_MAPS_API_KEY` (+ public variant) | Google Cloud, Vercel, Railway, GitHub Actions | Maps API quota | Every 365 days; restrict by HTTP referrer for the public variant |

---

## Procedure: rotate `SUPABASE_SERVICE_ROLE_KEY`

The high-risk one. Follow this exactly.

### Pre-flight

1. Pick a low-traffic window (Stripe webhook is the most sensitive consumer; avoid times where invoice events are likely).
2. Have an unrelated team member on standby in case the webhook breaks and needs immediate rollback.
3. Confirm you can sign in to: Supabase dashboard, Vercel project settings, Railway project settings, GitHub repo settings.

### Rotation

1. **Generate new key** — Supabase dashboard → Project Settings → API → Service Role Key → "Generate new key." Do NOT click "Revoke old key" yet. Copy the new value to a temporary password manager entry.
2. **Stage in Vercel** — Vercel → Project (Cover-Guard/Main) → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY`. Edit value, paste new key. Apply to **Preview** environment only first. Save.
3. **Verify Preview** — Trigger a Vercel preview deploy on a throwaway branch. Hit `POST /api/auth/me/terms` with a real bearer token. Expect 200. Hit `POST /api/stripe/webhook` with a Stripe-CLI test event. Expect 200 with the event acknowledged.
4. **Promote to Production in Vercel** — Edit the same env var, apply to **Production** and **Development**. Save. Trigger a production redeploy.
5. **Update Railway** — Railway → API service → Variables → `SUPABASE_SERVICE_ROLE_KEY`. Save. Railway auto-redeploys.
6. **Update GitHub Actions** — GitHub repo → Settings → Secrets and variables → Actions → `SUPABASE_SERVICE_ROLE_KEY`. Update the value. Re-run the most recent CI build to confirm.
7. **Verify production** — From an authenticated session, exercise: profile load, save property, request quote, advisor chat. All should succeed. Tail Sentry for any 500s in the next 15 minutes.
8. **Stripe webhook live test** — Use Stripe CLI to forward a real test event to production's webhook endpoint. Expect 200.
9. **Revoke old key** — Supabase dashboard → Project Settings → API → click the X / "Revoke" on the previous key. From this moment, only the new key works.
10. **Confirm revocation** — Verify a stale local `.env` (still holding the old key) gets a 401 when calling a service-role-protected endpoint. This is the proof the rotation actually rotated.
11. **Notify team** — Post in the team channel: rotated, no incidents, evidence link.
12. **Update local `.env` files** — Each developer must update their own local `.env`. Post the new value to a 1Password/Bitwarden shared vault entry; do NOT post the value in chat.

### Rollback

If anything fails between steps 4 and 9:

1. In Vercel + Railway + GitHub Actions, restore the old key value (from password-manager step 1).
2. Force a redeploy of API on Vercel and Railway.
3. Confirm webhook + auth work again.
4. Investigate the failure before retrying. Common cause: the new key was pasted with a trailing newline or an extra `SUPABASE_` prefix.

If you have already revoked the old key (step 9) and the new key fails:

1. Generate a *third* key in Supabase dashboard.
2. Race through steps 2–8 with the third key.
3. Post-mortem the second-key failure.

---

## Procedure: rotate `STRIPE_SECRET_KEY`

Lower-risk than service-role but still consequential.

1. Stripe dashboard → Developers → API keys → Roll secret key. Stripe gives you a 12-hour grace period where both old and new keys work.
2. Update `STRIPE_SECRET_KEY` in Vercel, Railway, GitHub Actions, and the local password vault entry.
3. Trigger redeploys.
4. Test: `POST /api/stripe/checkout` and `POST /api/stripe/portal` from staging.
5. Wait for the 12-hour grace period to expire OR explicitly revoke the old key in Stripe dashboard once verified.
6. Post a row to the rotation log below.

---

## Procedure: rotate `STRIPE_WEBHOOK_SECRET`

Different from the secret key — this is the signing secret for one specific webhook endpoint.

1. Stripe dashboard → Developers → Webhooks → select the production endpoint → "Reveal signing secret" → click "Roll signing secret."
2. Stripe immediately returns a new secret. The old one stops being valid the moment the new one is revealed (no grace period).
3. Update `STRIPE_WEBHOOK_SECRET` in Vercel, Railway, GitHub Actions.
4. Force redeploy.
5. Send a Stripe CLI test event. Expect the webhook to verify successfully (200) within seconds of redeploy.
6. If webhooks fail, the rollback is "roll the signing secret again" — there is no way to recover the previous value. Plan accordingly: do this when you have time to babysit a redeploy.

---

## Rotation log

Append a row here every time a secret is rotated. Most-recent first.

| Date (UTC) | Secret | Performed by | Reason | Verification | Notes |
|---|---|---|---|---|---|
| _pending_ | `SUPABASE_SERVICE_ROLE_KEY` | _to fill_ | P-A5a — establish rotation cadence; key has been long-lived since the original Supabase project setup; no specific exposure event | _to fill: link to Sentry dashboard time window + Stripe test-event ID_ | First entry. Set rotation cadence calendar reminder for 90 days hence. |

---

## After your rotation

When you complete the P-A5a rotation:

1. Replace the `_pending_` row above with the actual date and evidence.
2. Add a calendar reminder titled "Rotate SUPABASE_SERVICE_ROLE_KEY" set 90 days out.
3. Open a tiny follow-up PR with just that log update so the rotation has a paper trail in git history.
4. Close the P-A5a effort in the workstream tracker.

---

## Related work

- **P-A5b** removes the dependency on service-role for the Stripe webhook write path, replacing it with a signing-key + scoped-role pattern. Once P-A5b lands, the blast radius of a service-role leak shrinks meaningfully and the rotation cadence above can be revisited.
- **P-A2** ships Sentry on the API. After Sentry is in place, the verification steps in this runbook should reference Sentry's release filter for the time window of the rotation.
- **A3** moves the token cache and revocation store out of in-process memory and into Redis. That makes "proof the rotation actually rotated" verifiable across instances.

---

*Last updated: 2026-05-07 (initial runbook commit).*
