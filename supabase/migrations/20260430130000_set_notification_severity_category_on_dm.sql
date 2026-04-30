-- Notifications: set severity, category, and entity reference on DM inserts.
-- (PR 2 / Phase 1 foundations)
--
-- Builds on the columns added by 20260430120000_add_notification_taxonomy_and_prefs.sql.
-- Replaces handle_new_direct_message so each DM notification row is born with:
--
--     severity   = 'actionable'           -- a DM expects a response
--     category   = 'collaborative'        -- it's user <-> user
--     entityType = 'direct_conversation'  -- enables mute-by-thread (PR 5)
--     entityId   = the conversation's id
--
-- All existing behaviour is preserved: we still update direct_conversations
-- with the latest message metadata and we still resolve the sender's display
-- name. Only the INSERT INTO "notifications" gets new fields.
--
-- This migration is safe to re-run: CREATE OR REPLACE FUNCTION fully replaces
-- the prior body, and we re-DROP/CREATE the trigger to be explicit.

BEGIN;

CREATE OR REPLACE FUNCTION handle_new_direct_message() RETURNS trigger AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Keep the conversation summary fresh.
  UPDATE "direct_conversations"
     SET "lastMessageAt"   = NEW."createdAt",
         "lastMessageText" = NEW."content"
   WHERE "id" = NEW."conversationId";

  -- Resolve a friendly display name for the sender.
  SELECT COALESCE(NULLIF(TRIM(CONCAT(u."firstName", ' ', u."lastName")), ''), u.email, 'Someone')
    INTO sender_name
    FROM "users" u
   WHERE u.id = NEW."senderId";

  -- Insert the recipient's notification with full taxonomy.
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
    'actionable',                             -- DMs expect a response
    'collaborative',                          -- user <-> user
    'direct_conversation',                    -- mutable surface
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

-- Re-bind the trigger to be explicit. Idempotent.
DROP TRIGGER IF EXISTS trg_new_direct_message ON "direct_messages";
CREATE TRIGGER trg_new_direct_message
AFTER INSERT ON "direct_messages"
FOR EACH ROW EXECUTE FUNCTION handle_new_direct_message();

COMMIT;
