-- Up Migration

ALTER TABLE payments ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX payments_user_provider_idempotency_key
  ON payments (user_id, provider, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Down Migration

DROP INDEX IF EXISTS payments_user_provider_idempotency_key;
ALTER TABLE payments DROP COLUMN IF EXISTS idempotency_key;
