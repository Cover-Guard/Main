-- Agent chat (AI), direct messages (user↔user), notifications, and web push.
-- Keeps the existing CoverGuard model (users.id = text, snake_case table names
-- with camelCase columns) and mirrors the RLS pattern used by `deals`.

-- 1. AI agent chat sessions
CREATE TABLE IF NOT EXISTS "agent_chat_sessions" (
  "id"        TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "userId"    TEXT        NOT NULL,
  "title"     TEXT        NOT NULL DEFAULT 'Your Agent',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "agent_chat_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_chat_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "agent_chat_sessions_userId_updatedAt_idx"
  ON "agent_chat_sessions" ("userId", "updatedAt" DESC);

-- 2. AI agent chat messages
CREATE TABLE IF NOT EXISTS "agent_chat_messages" (
  "id"        TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "sessionId" TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "role"      TEXT        NOT NULL CHECK ("role" IN ('user','assistant','system')),
  "content"   TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "agent_chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_chat_messages_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "agent_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_chat_messages_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "agent_chat_messages_sessionId_createdAt_idx"
  ON "agent_chat_messages" ("sessionId", "createdAt" ASC);

-- 3. Direct conversations (unique pair, canonicalised userAId < userBId)
CREATE TABLE IF NOT EXISTS "direct_conversations" (
  "id"              TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "userAId"         TEXT        NOT NULL,
  "userBId"         TEXT        NOT NULL,
  "lastMessageAt"   TIMESTAMPTZ,
  "lastMessageText" TEXT,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_conversations_user_pair_uniq" UNIQUE ("userAId","userBId"),
  CONSTRAINT "direct_conversations_userA_lt_userB"  CHECK ("userAId" < "userBId"),
  CONSTRAINT "direct_conversations_userAId_fkey"
    FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_conversations_userBId_fkey"
    FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "direct_conversations_userA_idx" ON "direct_conversations" ("userAId","lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "direct_conversations_userB_idx" ON "direct_conversations" ("userBId","lastMessageAt" DESC);

-- 4. Direct messages
CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id"              TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "conversationId"  TEXT        NOT NULL,
  "senderId"        TEXT        NOT NULL,
  "recipientId"     TEXT        NOT NULL,
  "content"         TEXT        NOT NULL,
  "readAt"          TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_messages_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "direct_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_messages_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_messages_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "direct_messages_conv_createdAt_idx"
  ON "direct_messages" ("conversationId","createdAt" ASC);
CREATE INDEX IF NOT EXISTS "direct_messages_recipient_unread_idx"
  ON "direct_messages" ("recipientId") WHERE "readAt" IS NULL;

-- 5. Notifications
DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('DM','AGENT_REPLY','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"        TEXT              NOT NULL DEFAULT (gen_random_uuid())::text,
  "userId"    TEXT              NOT NULL,
  "type"      "NotificationType" NOT NULL,
  "title"     TEXT              NOT NULL,
  "body"      TEXT,
  "linkUrl"   TEXT,
  "payload"   JSONB             NOT NULL DEFAULT '{}'::jsonb,
  "readAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ       NOT NULL DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "notifications_userId_unread_idx"
  ON "notifications" ("userId","createdAt" DESC) WHERE "readAt" IS NULL;
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications" ("userId","createdAt" DESC);

-- 6. Push subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"        TEXT        NOT NULL DEFAULT (gen_random_uuid())::text,
  "userId"    TEXT        NOT NULL,
  "endpoint"  TEXT        NOT NULL UNIQUE,
  "p256dh"    TEXT        NOT NULL,
  "auth"      TEXT        NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx" ON "push_subscriptions" ("userId");

-- Trigger: on new DM insert, create notification + update conversation metadata.
CREATE OR REPLACE FUNCTION handle_new_direct_message() RETURNS trigger AS $$
DECLARE
  sender_name TEXT;
BEGIN
  UPDATE "direct_conversations"
     SET "lastMessageAt"   = NEW."createdAt",
         "lastMessageText" = NEW."content"
   WHERE "id" = NEW."conversationId";

  SELECT COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email, 'Someone')
    INTO sender_name
    FROM "users" u
   WHERE u.id = NEW."senderId";

  INSERT INTO "notifications" ("userId","type","title","body","linkUrl","payload")
  VALUES (
    NEW."recipientId",
    'DM',
    'New message from ' || COALESCE(sender_name,'a teammate'),
    LEFT(NEW."content", 140),
    '/dashboard?thread=' || NEW."conversationId",
    jsonb_build_object(
      'conversationId', NEW."conversationId",
      'messageId',      NEW."id",
      'senderId',       NEW."senderId"
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_new_direct_message ON "direct_messages";
CREATE TRIGGER trg_new_direct_message
AFTER INSERT ON "direct_messages"
FOR EACH ROW EXECUTE FUNCTION handle_new_direct_message();

-- Helper RPC the client calls to ensure a conversation row exists.
CREATE OR REPLACE FUNCTION get_or_create_direct_conversation(p_other_user TEXT)
RETURNS TEXT AS $$
DECLARE
  me   TEXT := auth.uid()::text;
  a    TEXT;
  b    TEXT;
  cid  TEXT;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user IS NULL OR p_other_user = me THEN
    RAISE EXCEPTION 'Invalid other user';
  END IF;

  IF me < p_other_user THEN a := me; b := p_other_user;
  ELSE a := p_other_user; b := me;
  END IF;

  SELECT id INTO cid FROM "direct_conversations"
   WHERE "userAId" = a AND "userBId" = b;

  IF cid IS NULL THEN
    INSERT INTO "direct_conversations" ("userAId","userBId")
    VALUES (a,b) RETURNING id INTO cid;
  END IF;
  RETURN cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE "agent_chat_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acs: own select" ON "agent_chat_sessions" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "acs: own insert" ON "agent_chat_sessions" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "acs: own update" ON "agent_chat_sessions" FOR UPDATE USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "acs: own delete" ON "agent_chat_sessions" FOR DELETE USING (auth.uid()::text = "userId");

ALTER TABLE "agent_chat_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acm: own select" ON "agent_chat_messages" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "acm: own insert" ON "agent_chat_messages" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "acm: own delete" ON "agent_chat_messages" FOR DELETE USING (auth.uid()::text = "userId");

ALTER TABLE "direct_conversations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc: member select" ON "direct_conversations"
  FOR SELECT USING (auth.uid()::text IN ("userAId","userBId"));
CREATE POLICY "dc: member insert" ON "direct_conversations"
  FOR INSERT WITH CHECK (auth.uid()::text IN ("userAId","userBId"));

ALTER TABLE "direct_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dm: member select" ON "direct_messages"
  FOR SELECT USING (auth.uid()::text IN ("senderId","recipientId"));
CREATE POLICY "dm: sender insert" ON "direct_messages"
  FOR INSERT WITH CHECK (auth.uid()::text = "senderId");
CREATE POLICY "dm: recipient update" ON "direct_messages"
  FOR UPDATE USING (auth.uid()::text = "recipientId") WITH CHECK (auth.uid()::text = "recipientId");

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "n: own select" ON "notifications" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "n: own update" ON "notifications" FOR UPDATE USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId");

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps: own select" ON "push_subscriptions" FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "ps: own insert" ON "push_subscriptions" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "ps: own delete" ON "push_subscriptions" FOR DELETE USING (auth.uid()::text = "userId");

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE "agent_chat_messages";
ALTER PUBLICATION supabase_realtime ADD TABLE "direct_messages";
ALTER PUBLICATION supabase_realtime ADD TABLE "notifications";
