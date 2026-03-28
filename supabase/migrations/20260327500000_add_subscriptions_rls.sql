-- Add RLS policies for subscriptions table

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: select own"
  ON subscriptions FOR SELECT
  USING ((auth.uid())::text = "userId");

CREATE POLICY "subscriptions: insert own"
  ON subscriptions FOR INSERT
  WITH CHECK ((auth.uid())::text = "userId");
