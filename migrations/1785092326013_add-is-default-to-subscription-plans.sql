-- Up Migration

ALTER TABLE subscription_plans
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial unique index: only rows where is_default = TRUE are indexed, so at
-- most one plan can ever be the default — enforced by Postgres itself, not
-- just application code (defense in depth against a race condition).
CREATE UNIQUE INDEX subscription_plans_one_default_idx
  ON subscription_plans (is_default)
  WHERE is_default = TRUE;

-- Down Migration

DROP INDEX IF EXISTS subscription_plans_one_default_idx;
ALTER TABLE subscription_plans DROP COLUMN is_default;
