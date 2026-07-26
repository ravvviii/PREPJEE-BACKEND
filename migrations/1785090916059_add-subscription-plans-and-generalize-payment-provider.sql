-- Up Migration

-- Neither `subscriptions` nor `payments` has ever been written to by the app
-- yet (Phase 16 hasn't been built) — safe to reshape both here rather than
-- edit Phase 3's original migration, since this project is many phases past
-- that point and other tables now depend on things it touched.

CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  duration_days INTEGER NOT NULL,
  -- Retire a plan without deleting it — past subscriptions/payments still
  -- reference it, so a hard delete was never really an option anyway.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX subscription_plans_name_key ON subscription_plans (name);
CREATE INDEX subscription_plans_is_active_idx ON subscription_plans (is_active);

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- subscriptions: plan_type (free text) -> plan_id (real FK), and
-- razorpay_subscription_id -> provider-generic naming.
ALTER TABLE subscriptions
  DROP COLUMN plan_type,
  ADD COLUMN plan_id UUID REFERENCES subscription_plans (id),
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'razorpay';

ALTER TABLE subscriptions
  RENAME COLUMN razorpay_subscription_id TO provider_subscription_id;

CREATE INDEX subscriptions_plan_id_idx ON subscriptions (plan_id);

-- payments: same provider-generic renaming, plus a metadata column for
-- whatever a future provider needs that doesn't fit order/payment id.
ALTER TABLE payments
  RENAME COLUMN razorpay_order_id TO provider_order_id;

ALTER TABLE payments
  RENAME COLUMN razorpay_payment_id TO provider_payment_id;

ALTER TABLE payments
  ADD COLUMN provider TEXT NOT NULL DEFAULT 'razorpay',
  ADD COLUMN provider_metadata JSONB;

-- Old index assumed a single provider's order IDs were globally unique;
-- scope it to (provider, provider_order_id) now that more than one provider
-- can produce order-like IDs.
DROP INDEX IF EXISTS payments_razorpay_order_id_key;
CREATE UNIQUE INDEX payments_provider_order_id_key ON payments (provider, provider_order_id);

-- Down Migration

DROP INDEX IF EXISTS payments_provider_order_id_key;
CREATE UNIQUE INDEX payments_razorpay_order_id_key ON payments (provider_order_id);

ALTER TABLE payments
  DROP COLUMN provider_metadata,
  DROP COLUMN provider;

ALTER TABLE payments RENAME COLUMN provider_payment_id TO razorpay_payment_id;
ALTER TABLE payments RENAME COLUMN provider_order_id TO razorpay_order_id;

DROP INDEX IF EXISTS subscriptions_plan_id_idx;

ALTER TABLE subscriptions RENAME COLUMN provider_subscription_id TO razorpay_subscription_id;

ALTER TABLE subscriptions
  DROP COLUMN provider,
  DROP COLUMN plan_id,
  ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE subscriptions ALTER COLUMN plan_type DROP DEFAULT;

DROP TABLE IF EXISTS subscription_plans;
