-- Add Stripe customer ID to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT UNIQUE;

-- Subscription plan enum
DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('INDIVIDUAL', 'PROFESSIONAL', 'TEAM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscription status enum
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM (
    'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED',
    'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscriptions table (camelCase columns to match rest of schema, TEXT id to match users.id)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "stripeSubscriptionId" TEXT NOT NULL UNIQUE,
  "stripePriceId" TEXT NOT NULL,
  plan "SubscriptionPlan" NOT NULL DEFAULT 'INDIVIDUAL',
  status "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "currentPeriodStart" TIMESTAMPTZ NOT NULL,
  "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions("userId");
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions("userId", status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions("stripeSubscriptionId");

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions: select own" ON public.subscriptions FOR SELECT USING (auth.uid()::text = "userId");
CREATE POLICY "subscriptions: insert own" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid()::text = "userId");

-- Auto-update updatedAt on row changes
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();
