-- Add Stripe customer ID to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Subscription plan enum
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('INDIVIDUAL', 'PROFESSIONAL', 'TEAM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscription status enum
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED',
    'UNPAID', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAUSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  plan subscription_plan NOT NULL DEFAULT 'INDIVIDUAL',
  status subscription_status NOT NULL DEFAULT 'INCOMPLETE',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

-- Auto-update updated_at on row changes (mirrors Prisma @updatedAt behaviour)
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();
