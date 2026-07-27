-- Up Migration

ALTER TABLE subscription_plans
  ADD COLUMN recurring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN billing_period TEXT,
  ADD COLUMN billing_interval SMALLINT,
  ADD COLUMN total_count INTEGER,
  ADD COLUMN trial_amount INTEGER,
  ADD COLUMN trial_days SMALLINT,
  ADD COLUMN provider_plan_id TEXT;

ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_recurring_config CHECK (
  recurring_enabled = FALSE OR (
    billing_period IN ('daily', 'weekly', 'monthly', 'yearly')
    AND billing_interval >= 1
    AND total_count >= 1
    AND provider_plan_id IS NOT NULL
  )
);
ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_trial_config CHECK (
  (trial_amount IS NULL AND trial_days IS NULL)
  OR (trial_amount >= 100 AND trial_days >= 1 AND recurring_enabled = TRUE)
);

CREATE TABLE recurring_subscription_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans (id),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_subscription_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  start_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subscription_id),
  UNIQUE (user_id, provider, idempotency_key)
);

CREATE INDEX recurring_subscription_intents_user_idx
  ON recurring_subscription_intents (user_id, created_at DESC);

ALTER TABLE subscriptions
  ADD COLUMN trial_started_at TIMESTAMPTZ;

CREATE UNIQUE INDEX subscriptions_one_trial_per_user_plan
  ON subscriptions (user_id, plan_id)
  WHERE trial_started_at IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS subscriptions_one_trial_per_user_plan;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS trial_started_at;
DROP TABLE IF EXISTS recurring_subscription_intents;
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_trial_config;
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_recurring_config;
ALTER TABLE subscription_plans
  DROP COLUMN IF EXISTS provider_plan_id,
  DROP COLUMN IF EXISTS trial_days,
  DROP COLUMN IF EXISTS trial_amount,
  DROP COLUMN IF EXISTS total_count,
  DROP COLUMN IF EXISTS billing_interval,
  DROP COLUMN IF EXISTS billing_period,
  DROP COLUMN IF EXISTS recurring_enabled;
