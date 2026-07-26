-- Up Migration

-- This migration only exists to prove `migrate up`/`migrate down` work
-- end-to-end before Phase 3 introduces real schema. pgcrypto is a safe,
-- commonly-needed extension to enable early (gen_random_uuid(), hashing) —
-- not a commitment to a specific primary-key strategy, which is a Phase 3 decision.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Down Migration

DROP EXTENSION IF EXISTS pgcrypto;
