-- Up Migration

-- Every existing plan remains visible to every cohort after migration.
ALTER TABLE subscription_plans
  ADD COLUMN bucket_min SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN bucket_max SMALLINT NOT NULL DEFAULT 99;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_bucket_range
  CHECK (
    bucket_min >= 0
    AND bucket_max <= 99
    AND bucket_min <= bucket_max
  );

CREATE INDEX subscription_plans_active_bucket_range_idx
  ON subscription_plans (bucket_min, bucket_max)
  WHERE is_active = TRUE;

-- Down Migration

DROP INDEX IF EXISTS subscription_plans_active_bucket_range_idx;
ALTER TABLE subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_bucket_range;
ALTER TABLE subscription_plans
  DROP COLUMN IF EXISTS bucket_min,
  DROP COLUMN IF EXISTS bucket_max;
