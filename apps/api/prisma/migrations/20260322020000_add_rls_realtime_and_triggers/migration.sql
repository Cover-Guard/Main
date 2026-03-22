-- =============================================================================
-- CoverGuard: auth sync triggers, Row Level Security, and Supabase Realtime
-- =============================================================================
-- This migration wires three layers of automatic synchronisation:
--
--  1. TRIGGERS  — keep public.users in lock-step with auth.users so that
--                 OAuth sign-ups (Google) get a profile row without any
--                 application code having to run.
--
--  2. RLS       — enforce per-row ownership at the database level so that
--                 the Supabase anon key cannot read or mutate another user's
--                 data, even if application code has a bug.  The API always
--                 uses the service-role key, which bypasses RLS, so existing
--                 Prisma queries are unaffected.
--
--  3. REALTIME  — publish the tables that benefit from live push updates
--                 to the supabase_realtime WAL publication so the frontend
--                 can subscribe without any server-side streaming endpoint.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1 — auth ↔ public.users synchronisation triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. CREATE — auto-provision a public.users profile whenever a new row is
--     inserted into auth.users (covers email/password AND all OAuth providers).
--     Uses ON CONFLICT (id) DO NOTHING so it is safe to run even when the API
--     already created the profile (email/password path).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    "firstName",
    "lastName",
    role,
    company,
    "licenseNumber",
    "updatedAt"
  )
  VALUES (
    NEW.id,
    NEW.email,
    -- Google provides full_name / name; fall back to the email local-part
    COALESCE(
      NEW.raw_user_meta_data->>'firstName',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'lastName',
      NULLIF(
        split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2),
        ''
      ),
      ''
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::"UserRole",
      'BUYER'
    ),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'licenseNumber',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 1b. UPDATE — sync email and role whenever the auth.users row is updated
--     (e.g. user changes email, or the OAuth callback sets role metadata).

CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    email       = NEW.email,
    -- Only promote role if the metadata carries an explicit value;
    -- never downgrade an existing role to the default.
    role        = COALESCE(
                    (NEW.raw_user_meta_data->>'role')::"UserRole",
                    role
                  ),
    "avatarUrl" = COALESCE(
                    NEW.raw_user_meta_data->>'avatar_url',
                    "avatarUrl"
                  ),
    "updatedAt" = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();


-- 1c. DELETE — remove the public.users profile (and cascade to all owned rows)
--     when a Supabase admin deletes the auth user.

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2 — Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
-- Convention:
--   • The API service-role key bypasses RLS → all Prisma queries continue
--     to work unchanged.
--   • The browser anon key is subject to RLS → users can only touch their
--     own rows; public property data is readable by anyone.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 2.1  properties (public read; writes via service role only) ───────────────

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "properties: public read"
  ON public.properties FOR SELECT
  USING (true);


-- ── 2.2  risk_profiles (public read; writes via service role only) ────────────

ALTER TABLE public.risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risk_profiles: public read"
  ON public.risk_profiles FOR SELECT
  USING (true);


-- ── 2.3  insurance_estimates (public read; writes via service role only) ──────

ALTER TABLE public.insurance_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insurance_estimates: public read"
  ON public.insurance_estimates FOR SELECT
  USING (true);


-- ── 2.4  users ────────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Each authenticated user may read and update only their own profile row.
CREATE POLICY "users: select own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- The handle_new_user trigger runs as SECURITY DEFINER, which means it
-- executes with the function owner's privileges (superuser) and is exempt
-- from RLS, so no INSERT policy is needed for the trigger path.
-- We still add one so that future upsert calls from the callback route work.
CREATE POLICY "users: insert own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ── 2.5  saved_properties ─────────────────────────────────────────────────────

ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_properties: select own"
  ON public.saved_properties FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "saved_properties: insert own"
  ON public.saved_properties FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "saved_properties: update own"
  ON public.saved_properties FOR UPDATE
  USING (auth.uid() = "userId")
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "saved_properties: delete own"
  ON public.saved_properties FOR DELETE
  USING (auth.uid() = "userId");


-- ── 2.6  property_reports ─────────────────────────────────────────────────────

ALTER TABLE public.property_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_reports: select own"
  ON public.property_reports FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "property_reports: insert own"
  ON public.property_reports FOR INSERT
  WITH CHECK (auth.uid() = "userId");

CREATE POLICY "property_reports: delete own"
  ON public.property_reports FOR DELETE
  USING (auth.uid() = "userId");


-- ── 2.7  clients ──────────────────────────────────────────────────────────────

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: select own"
  ON public.clients FOR SELECT
  USING (auth.uid() = "agentId");

CREATE POLICY "clients: insert own"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = "agentId");

CREATE POLICY "clients: update own"
  ON public.clients FOR UPDATE
  USING (auth.uid() = "agentId")
  WITH CHECK (auth.uid() = "agentId");

CREATE POLICY "clients: delete own"
  ON public.clients FOR DELETE
  USING (auth.uid() = "agentId");


-- ── 2.8  quote_requests ───────────────────────────────────────────────────────

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_requests: select own"
  ON public.quote_requests FOR SELECT
  USING (auth.uid() = "userId");

CREATE POLICY "quote_requests: insert own"
  ON public.quote_requests FOR INSERT
  WITH CHECK (auth.uid() = "userId");

-- Status updates come from admin/service role only; users cannot self-update.


-- ── 2.9  search_history ───────────────────────────────────────────────────────

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own history;
-- anonymous rows (userId IS NULL) are not visible to anyone via the anon key.
CREATE POLICY "search_history: select own"
  ON public.search_history FOR SELECT
  USING (auth.uid() = "userId");

-- Writes come from the service-role API only; no direct insert policy needed.


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3 — Supabase Realtime
-- ─────────────────────────────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL is required so that UPDATE and DELETE WAL events
-- carry the full old row (not just the primary key), enabling the frontend
-- to compute the diff without a separate fetch.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tables that benefit most from live push:
--   • saved_properties  — badge counts, saved-list updates
--   • quote_requests    — status changes (PENDING → SENT → RESPONDED)
--   • properties        — new listings appearing in search results

ALTER TABLE public.saved_properties  REPLICA IDENTITY FULL;
ALTER TABLE public.quote_requests    REPLICA IDENTITY FULL;
ALTER TABLE public.properties        REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_properties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_requests;
