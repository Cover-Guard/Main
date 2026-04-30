-- Notifications: suppress writes for muted (userId, entityType, entityId) tuples.
-- (PR 5 / Phase 2)
--
-- Builds on PR 1 (which added `notification_mutes`) and PR 2 (which made the
-- DM trigger populate `entityType`/`entityId`). The trigger is replaced so
-- it short-circuits when the recipient has an active mute for the conversation.
--
-- A mute row is "active" when either:
--   * `expiresAt IS NULL` (mute indefinitely), or
--   * `expiresAt > now()` (timed mute hasn't passed).
--
-- Cleanup of expired mutes is intentionally not done here — keeping rows lets
-- analytics see the historical mute. PR 9 will add a small daily prune job.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.

BEGIN;

CREATE OR REPLACE FUNCTION handle_new_direct_message() RETURNS trigger AS $$
DECLARE
  sender_name TEXT;
  is_muted    BOOLEAN := false;
BEGIN
  -- Conversation summary fields stay fresh regardless of mute status; muting
  -- silences notifications, not the inbox.
  UPDATE "direct_conversations"
     SET "lastMessageAt"   = NEW."createdAt",
         "lastMessageText" = NEW."content"
   WHERE "id" = NEW."conversationId";

  -- Active mute on this conversation for the recipient?
  SELECT EXISTS (
    SELECT 1 FROM "notification_mutes" m
     WHERE m."userId"     = NEW."recipientId"
       AND m."entityType" = 'direct_conversation'
       AND m."entityId"   = NEW."conversationId"
       AND (m."expiresAt" IS NULL OR m."expiresAt" > now())
  ) INTO is_muted;

  IF is_muted THEN
    -- Recipient has muted this thread. Skip notification creation entirely
    -- (no row in `notifications`, no realtime fan-out, no email/push).
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email, 'Someone')
    INTO sender_name
    FROM "users" u
   WHERE u.id = NEW."senderId";

  INSERT INTO "notifications" (
    "userId",
    "type",
    "severity",
    "category",
    "entityType",
    "entityId",
    "title",
    "body",
    "linkUrl",
    "payload"
  )
  VALUES (
    NEW."recipientId",
    'DM',
    'actionable',
    'collaborative',
    'direct_conversation',
    NEW."conversationId",
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

COMMIT;
