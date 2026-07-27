import { query } from '../utils/db.js';
import { withTransaction } from '../utils/transaction.js';

export const findIntentByIdempotencyKey = async (userId, provider, idempotencyKey) => {
  const { rows } = await query(
    `SELECT * FROM recurring_subscription_intents
     WHERE user_id = $1 AND provider = $2 AND idempotency_key = $3`,
    [userId, provider, idempotencyKey],
  );
  return rows[0] ?? null;
};

export const findIntentByProviderId = async (provider, providerSubscriptionId) => {
  const { rows } = await query(
    `SELECT * FROM recurring_subscription_intents
     WHERE provider = $1 AND provider_subscription_id = $2`,
    [provider, providerSubscriptionId],
  );
  return rows[0] ?? null;
};

export const createIntent = async ({
  userId,
  planId,
  provider,
  providerSubscriptionId,
  idempotencyKey,
  startAt,
  trialApplied,
}) => {
  const { rows } = await query(
    `INSERT INTO recurring_subscription_intents
       (user_id, plan_id, provider, provider_subscription_id, idempotency_key, start_at,
        trial_applied)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, planId, provider, providerSubscriptionId, idempotencyKey, startAt, trialApplied],
  );
  return rows[0];
};

export const hasUsedTrial = async (userId, planId) => {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM subscriptions
       WHERE user_id = $1 AND plan_id = $2 AND trial_started_at IS NOT NULL
     ) AS used`,
    [userId, planId],
  );
  return rows[0].used;
};

export const activateSubscription = async ({ intentId, paymentId }) =>
  withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT intent.*, plan.duration_days
       FROM recurring_subscription_intents intent
       JOIN subscription_plans plan ON plan.id = intent.plan_id
       WHERE intent.id = $1
       FOR UPDATE OF intent`,
      [intentId],
    );
    const intent = rows[0];
    if (!intent || intent.status !== 'created') return null;

    await client.query(
      "UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'",
      [intent.user_id],
    );
    const { rows: subscriptionRows } = await client.query(
      `INSERT INTO subscriptions
         (user_id, plan_id, provider, provider_subscription_id, status, expires_at, trial_started_at)
       VALUES ($1, $2, $3, $4, 'active', $5,
               CASE WHEN $6 THEN NOW() ELSE NULL END)
       RETURNING *`,
      [
        intent.user_id,
        intent.plan_id,
        intent.provider,
        intent.provider_subscription_id,
        intent.trial_applied
          ? intent.start_at
          : new Date(Date.now() + intent.duration_days * 24 * 60 * 60 * 1000),
        intent.trial_applied,
      ],
    );
    await client.query(
      `UPDATE recurring_subscription_intents
       SET status = 'authenticated', updated_at = NOW()
       WHERE id = $1`,
      [intent.id],
    );

    return { intent, subscription: subscriptionRows[0], paymentId };
  });

export const recordCharge = async ({
  providerSubscriptionId,
  providerPaymentId,
  providerOrderId,
  amount,
  currency,
  event,
}) => {
  if (!providerPaymentId || !Number.isInteger(amount)) return null;
  const orderId = providerOrderId || `subscription:${providerSubscriptionId}:${providerPaymentId}`;
  const { rows } = await query(
    `INSERT INTO payments
       (user_id, subscription_id, provider, provider_order_id, provider_payment_id,
        amount, currency, status, provider_metadata)
     SELECT subscription.user_id, subscription.id, intent.provider, $2, $3,
            $4, $5, 'paid', $6::jsonb
     FROM recurring_subscription_intents intent
     JOIN subscriptions subscription
       ON subscription.provider_subscription_id = intent.provider_subscription_id
     WHERE intent.provider_subscription_id = $1
     ON CONFLICT (provider, provider_order_id) DO UPDATE SET
       provider_payment_id = COALESCE(payments.provider_payment_id, EXCLUDED.provider_payment_id),
       status = 'paid',
       provider_metadata = payments.provider_metadata || EXCLUDED.provider_metadata
     RETURNING *`,
    [
      providerSubscriptionId,
      orderId,
      providerPaymentId,
      amount,
      currency || 'INR',
      JSON.stringify({ recurring: true, event }),
    ],
  );
  return rows[0] ?? null;
};

export const updateLifecycle = async ({
  providerSubscriptionId,
  status,
  currentEnd,
}) => {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE recurring_subscription_intents
       SET status = $2, updated_at = NOW()
       WHERE provider_subscription_id = $1`,
      [providerSubscriptionId, status],
    );

    if (status === 'active' && currentEnd) {
      await client.query(
        `UPDATE subscriptions
         SET status = 'active', expires_at = $2
         WHERE provider_subscription_id = $1`,
        [providerSubscriptionId, new Date(currentEnd * 1000)],
      );
    } else if (['cancelled', 'completed', 'expired', 'halted'].includes(status)) {
      await client.query(
        `UPDATE subscriptions
         SET status = CASE WHEN $2 = 'cancelled' THEN 'cancelled'::subscription_status
                           ELSE 'expired'::subscription_status END
         WHERE provider_subscription_id = $1`,
        [providerSubscriptionId, status],
      );
    }
  });
};
