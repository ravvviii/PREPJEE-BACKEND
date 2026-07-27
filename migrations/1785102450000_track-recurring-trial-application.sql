-- Up Migration

ALTER TABLE recurring_subscription_intents
  ADD COLUMN trial_applied BOOLEAN NOT NULL DEFAULT FALSE;

-- Down Migration

ALTER TABLE recurring_subscription_intents
  DROP COLUMN IF EXISTS trial_applied;
