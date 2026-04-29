-- =========================================================================
-- User Activity Tracking Spine
-- Project: Supabase-coverguard-2 (vxrckdzbwhufghadfnsc)
-- Date:    2026-04-29
--
-- Adds:
--   1) Trigger-based enforcement of public.users.id <-> auth.users.id
--      (FK can't be used directly: public.users.id is text, auth.users.id
--      is uuid)
--   2) Missing indexes on user-FK columns (agent_chat_messages.userId,
--      direct_messages.senderId)
--   3) Naming consistency: property_checklists.user_id -> "userId",
--      .property_id -> "propertyId" (BREAKING for app code that queries
--      these columns by their old snake_case names)
--   4) Central append-only activity log: public.user_activity_events
--      with activity_event_type enum
--   5) RLS on user_activity_events: users read own activity, service
--      role inserts
--   6) Unifying view: public.v_user_activity unions every activity
--      source so a single query returns "everything user X did"
-- =========================================================================

-- 1) Enforce public.users.id <-> auth.users.id link via triggers
CREATE OR REPLACE FUNCTION public.ensure_public_user_in_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = NEW.id) THEN
    RAISE EXCEPTION 'public.users.id (%) must reference an existing auth.users.id', NEW.id;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS public_users_auth_check ON public.users;
CREATE TRIGGER public_users_auth_check
  BEFORE INSERT OR UPDATE OF id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_public_user_in_auth();

CREATE OR REPLACE FUNCTION public.cascade_auth_user_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $fn$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id::text;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS auth_user_cascade_to_public ON auth.users;
CREATE TRIGGER auth_user_cascade_to_public
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cascade_auth_user_delete();

-- 2) Missing indexes on user-FK columns
CREATE INDEX IF NOT EXISTS "agent_chat_messages_userId_createdAt_idx"
  ON public.agent_chat_messages ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_createdAt_idx"
  ON public.direct_messages ("senderId", "createdAt" DESC);

-- 3) Naming consistency on property_checklists (BREAKING for app code)
ALTER TABLE public.property_checklists RENAME COLUMN user_id     TO "userId";
ALTER TABLE public.property_checklists RENAME COLUMN property_id TO "propertyId";

-- 4) Activity event spine
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_event_type') THEN
    CREATE TYPE public.activity_event_type AS ENUM (
      'LOGIN','LOGOUT','SIGNUP',
      'PROFILE_UPDATED','CONSENT_ACCEPTED',
      'PROPERTY_VIEWED','PROPERTY_SAVED','PROPERTY_UNSAVED',
      'SEARCH_PERFORMED',
      'REPORT_GENERATED','REPORT_DOWNLOADED',
      'QUOTE_REQUESTED','QUOTE_STATUS_CHANGED',
      'CHECKLIST_CREATED','CHECKLIST_UPDATED',
      'AGENT_CHAT_SENT',
      'DIRECT_MESSAGE_SENT',
      'NOTIFICATION_READ',
      'SUBSCRIPTION_CHANGED',
      'ADMIN_ACTION'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_activity_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type   public.activity_event_type NOT NULL,
  entity_type  text,
  entity_id    text,
  metadata     jsonb NOT NULL DEFAULT '{}',
  ip_address   inet,
  user_agent   text,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uae_user_time
  ON public.user_activity_events ("userId", occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_uae_type_time
  ON public.user_activity_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_uae_entity
  ON public.user_activity_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_uae_metadata_gin
  ON public.user_activity_events USING GIN (metadata);

-- 5) RLS on the new table
ALTER TABLE public.user_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own activity" ON public.user_activity_events;
CREATE POLICY "users read own activity"
  ON public.user_activity_events FOR SELECT
  USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "service role inserts activity" ON public.user_activity_events;
CREATE POLICY "service role inserts activity"
  ON public.user_activity_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 6) Unifying view across all activity sources
CREATE OR REPLACE VIEW public.v_user_activity AS
  SELECT "userId"   AS user_id, 'SEARCH'::text          AS event, id,        "searchedAt"::timestamptz  AS at
    FROM public.search_history WHERE "userId" IS NOT NULL
  UNION ALL SELECT "userId",   'PROPERTY_SAVED',          id,        "savedAt"::timestamptz
    FROM public.saved_properties
  UNION ALL SELECT "userId",   'REPORT_GENERATED',        id,        "generatedAt"::timestamptz
    FROM public.property_reports
  UNION ALL SELECT "userId",   'QUOTE_REQUESTED',         id,        "submittedAt"::timestamptz
    FROM public.quote_requests
  UNION ALL SELECT "userId",   'CHECKLIST_CREATED',       id::text,  created_at
    FROM public.property_checklists
  UNION ALL SELECT "userId",   'AGENT_CHAT_SESSION',      id,        "createdAt"
    FROM public.agent_chat_sessions
  UNION ALL SELECT "userId",   'AGENT_CHAT_MESSAGE',      id,        "createdAt"
    FROM public.agent_chat_messages
  UNION ALL SELECT "senderId", 'DM_SENT',                 id,        "createdAt"
    FROM public.direct_messages
  UNION ALL SELECT "userId",   'NOTIFICATION',            id,        "createdAt"
    FROM public.notifications
  UNION ALL SELECT "userId",   'SUBSCRIPTION',            id,        "createdAt"
    FROM public.subscriptions
  UNION ALL SELECT "userId",   event_type::text,          id::text,  occurred_at
    FROM public.user_activity_events;

COMMENT ON TABLE public.user_activity_events IS 'Append-only audit trail of meaningful user actions. Write from app handlers; do not UPDATE/DELETE rows.';
COMMENT ON VIEW  public.v_user_activity      IS 'Unified user activity timeline across domain tables and user_activity_events. Query: SELECT * FROM v_user_activity WHERE user_id = $1 ORDER BY at DESC.';
