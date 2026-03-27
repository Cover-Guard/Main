-- Fix type-mismatch in auth triggers and RLS policies.
-- public.users.id is TEXT; auth.users.id is UUID.
-- Cast UUID → TEXT everywhere so comparisons don't require an implicit cast operator.

-- ── 1a. handle_new_user — cast NEW.id to text ─────────────────────────────────

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
    NEW.id::text,
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

-- ── 1b. handle_user_updated — cast NEW.id to text ────────────────────────────

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
    role        = COALESCE(
                    (NEW.raw_user_meta_data->>'role')::"UserRole",
                    role
                  ),
    "avatarUrl" = COALESCE(
                    NEW.raw_user_meta_data->>'avatar_url',
                    "avatarUrl"
                  ),
    "updatedAt" = NOW()
  WHERE id = NEW.id::text;

  RETURN NEW;
END;
$$;

-- ── 1c. handle_user_deleted — cast OLD.id to text ────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id::text;
  RETURN OLD;
END;
$$;

-- ── 2.4  users — cast auth.uid() to text ────────────────────────────────────

DROP POLICY IF EXISTS "users: select own" ON public.users;
CREATE POLICY "users: select own"
  ON public.users FOR SELECT
  USING (auth.uid()::text = id);

DROP POLICY IF EXISTS "users: update own" ON public.users;
CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

DROP POLICY IF EXISTS "users: insert own" ON public.users;
CREATE POLICY "users: insert own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid()::text = id);

-- ── 2.5  saved_properties ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "saved_properties: select own" ON public.saved_properties;
CREATE POLICY "saved_properties: select own"
  ON public.saved_properties FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "saved_properties: insert own" ON public.saved_properties;
CREATE POLICY "saved_properties: insert own"
  ON public.saved_properties FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "saved_properties: update own" ON public.saved_properties;
CREATE POLICY "saved_properties: update own"
  ON public.saved_properties FOR UPDATE
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "saved_properties: delete own" ON public.saved_properties;
CREATE POLICY "saved_properties: delete own"
  ON public.saved_properties FOR DELETE
  USING (auth.uid()::text = "userId");

-- ── 2.6  property_reports ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "property_reports: select own" ON public.property_reports;
CREATE POLICY "property_reports: select own"
  ON public.property_reports FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "property_reports: insert own" ON public.property_reports;
CREATE POLICY "property_reports: insert own"
  ON public.property_reports FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "property_reports: delete own" ON public.property_reports;
CREATE POLICY "property_reports: delete own"
  ON public.property_reports FOR DELETE
  USING (auth.uid()::text = "userId");

-- ── 2.7  clients ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "clients: select own" ON public.clients;
CREATE POLICY "clients: select own"
  ON public.clients FOR SELECT
  USING (auth.uid()::text = "agentId");

DROP POLICY IF EXISTS "clients: insert own" ON public.clients;
CREATE POLICY "clients: insert own"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid()::text = "agentId");

DROP POLICY IF EXISTS "clients: update own" ON public.clients;
CREATE POLICY "clients: update own"
  ON public.clients FOR UPDATE
  USING (auth.uid()::text = "agentId")
  WITH CHECK (auth.uid()::text = "agentId");

DROP POLICY IF EXISTS "clients: delete own" ON public.clients;
CREATE POLICY "clients: delete own"
  ON public.clients FOR DELETE
  USING (auth.uid()::text = "agentId");

-- ── 2.8  quote_requests ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "quote_requests: select own" ON public.quote_requests;
CREATE POLICY "quote_requests: select own"
  ON public.quote_requests FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "quote_requests: insert own" ON public.quote_requests;
CREATE POLICY "quote_requests: insert own"
  ON public.quote_requests FOR INSERT
  WITH CHECK (auth.uid()::text = "userId");

-- ── 2.9  search_history ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "search_history: select own" ON public.search_history;
CREATE POLICY "search_history: select own"
  ON public.search_history FOR SELECT
  USING (auth.uid()::text = "userId");
