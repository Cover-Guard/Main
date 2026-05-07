# Migration Source Reconciliation — 2026-05-07

**Status:** Decision proposed. Execution deferred to follow-up PRs.
**Author:** AI-assisted review; human review required before merge.
**Effort ID:** P-A1 (see `coverguard-platform-plan.md`).

---

## Why this exists

The repository carries two parallel migration systems:

- `apps/api/prisma/migrations/` — Prisma Migrate
- `supabase/migrations/` — Supabase CLI

`CLAUDE.md` already designates Supabase as authoritative ("DB migrations via Supabase. Schema changes go in `supabase/migrations/*.sql`. After applying, run `db:pull` then `db:generate` to sync Prisma."). The `apps/api/prisma/migrations/` directory contradicts that policy. This audit confirms drift, and proposes the resolution.

## Drift inventory (as of 2026-05-07)

### Present in both (5)

These timestamps appear in both directories. Content has not been compared byte-for-byte; assume divergence is possible.

| Timestamp | Description |
|---|---|
| 20260321000000 | init |
| 20260325000000 | add_nda_privacy_accepted_at |
| 20260327000000 | rename_fir_to_fire_hazard_zone |
| 20260428000000 | add_usage_counters |
| 20260429000000 | user_activity_tracking_spine |

### Present only in `apps/api/prisma/migrations/` (6)

These were applied via Prisma Migrate against some environment but never landed in the Supabase migration history. **Two of them are RLS-related and important.**

| Timestamp | Description | Risk |
|---|---|---|
| 20260322000000 | add_property_state_created_at_idx | Low — index only |
| 20260322010000 | fix_missing_fks_and_indexes | Medium — FKs + indexes |
| 20260322020000 | add_rls_realtime_and_triggers | **High — RLS, realtime, triggers** |
| 20260322030000 | add_users_role_idx | Low — index only |
| 20260327010000 | add_missing_properties_state_idx | Low — index only |
| 20260327020000 | fix_rls_uid_text_casts | **High — RLS UID cast fix** |

### Present only in `supabase/migrations/` (12)

These are the Supabase-authoritative additions that have shipped since the dual-tracking began. Prisma's migration history is unaware of them; the Prisma client still works because `db:pull` has been run periodically against the live DB.

| Timestamp | Description |
|---|---|
| 20250409 | add_walkscore_columns |
| 20260327100000 | add_fire_insurance_fields |
| 20260327200000 | update_handle_new_user_trigger |
| 20260327300000 | add_stripe_subscriptions |
| 20260327400000 | add_client_id_to_saved_properties |
| 20260327500000 | add_subscriptions_rls |
| 20260328000000 | trigger_sync |
| 20260328100000 | add_property_checklists |
| 20260417000000 | add_deals |
| 20260419000000 | add_agent_chat_and_dms |
| 20260430000000 | add_usage_counters_catchup |
| 20260430120000 | add_notification_taxonomy_and_prefs |

## Decision

**Supabase is the single source of truth for schema migrations going forward.** `apps/api/prisma/migrations/` is removed. Prisma is used as ORM only — schema is regenerated from the live DB via `db:pull` + `db:generate`.

This matches the policy already stated in `CLAUDE.md` line 313 ("DB migrations via Supabase").

## Follow-up PRs (sequenced)

This PR commits the decision and the documentation alignment. Three follow-up PRs execute it:

1. **PR-A1.b — Port performance indexes from Prisma-only history.**
   The six Prisma-only migrations include indexes and an RLS-cast fix that may already be live in production but are not reproducible against a fresh Supabase project. Each one needs a corresponding Supabase migration:
   - `add_property_state_created_at_idx`
   - `fix_missing_fks_and_indexes`
   - `add_rls_realtime_and_triggers` (verify against current Supabase schema; may already be subsumed)
   - `add_users_role_idx`
   - `add_missing_properties_state_idx`
   - `fix_rls_uid_text_casts`
   Each port should be guarded by `IF NOT EXISTS` / `CREATE OR REPLACE` to be idempotent against environments where the index already exists.

2. **PR-A1.c — Delete `apps/api/prisma/migrations/` directory.**
   Move contents (12 files including `migration_lock.toml`) to `docs/audits/legacy-prisma-migrations/` for historical record, then delete the originals. Update `apps/api/prisma.config.ts` if it references the migrations directory.

3. **PR-A1.d — Add CI schema-drift check.**
   Add a `schema-drift-check` job in `.github/workflows/ci.yml` that runs `npx prisma db pull --print` against staging and fails the build if the result differs from committed `schema.prisma`. This catches the next drift before it accumulates.

## Verification

A reviewer can sanity-check this audit by running, in a fresh clone:

```bash
ls apps/api/prisma/migrations/ | sort > /tmp/prisma.txt
ls supabase/migrations/ | sed 's/\.sql$//' | sort > /tmp/supabase.txt
comm -23 /tmp/prisma.txt /tmp/supabase.txt   # only in Prisma
comm -13 /tmp/prisma.txt /tmp/supabase.txt   # only in Supabase
comm -12 /tmp/prisma.txt /tmp/supabase.txt   # in both
```

The numbers (6 / 12 / 5) and the timestamps in each set should match the tables above.

## What this PR changes

- Adds this audit document at `docs/audits/2026-05-migration-reconciliation.md`.
- Updates `CLAUDE.md` to add an explicit "do not recreate `apps/api/prisma/migrations/`" warning under the Notes for AI Assistants section.
- Updates `README.md` to remove references to the non-existent `npm run db:migrate` command (the actual command is `npm run db:push`).

No code is changed. No schema is changed. The schema drift it documents will be resolved by PR-A1.b through PR-A1.d.
