import { query } from '../utils/db.js';
import { withTransaction } from '../utils/transaction.js';

export const create = async ({
  userId,
  provider,
  providerOrderId,
  amount,
  currency,
  metadata,
  idempotencyKey,
}) => {
  const { rows } = await query(
    `INSERT INTO payments
       (user_id, provider, provider_order_id, amount, currency, provider_metadata, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, provider, providerOrderId, amount, currency, metadata ?? null, idempotencyKey],
  );
  return rows[0];
};

export const findByIdempotencyKey = async (userId, provider, idempotencyKey) => {
  const { rows } = await query(
    `SELECT * FROM payments
     WHERE user_id = $1 AND provider = $2 AND idempotency_key = $3`,
    [userId, provider, idempotencyKey],
  );
  return rows[0] ?? null;
};

export const findByProviderOrderId = async (provider, providerOrderId) => {
  const { rows } = await query(
    'SELECT * FROM payments WHERE provider = $1 AND provider_order_id = $2',
    [provider, providerOrderId],
  );
  return rows[0] ?? null;
};

export const setProviderPaymentId = async (id, providerPaymentId) => {
  await query('UPDATE payments SET provider_payment_id = $2 WHERE id = $1', [
    id,
    providerPaymentId,
  ]);
};

export const completeWithSubscription = async ({
  paymentId,
  planId,
  expiresAt,
}) =>
  withTransaction(async (client) => {
    const { rows: paymentRows } = await client.query(
      'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
      [paymentId],
    );
    const payment = paymentRows[0];
    if (!payment || payment.status !== 'created') return null;

    await client.query(
      "UPDATE subscriptions SET status = 'expired' WHERE user_id = $1 AND status = 'active'",
      [payment.user_id],
    );
    const { rows: subscriptionRows } = await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, provider, status, expires_at)
       VALUES ($1, $2, $3, 'active', $4)
       RETURNING *`,
      [payment.user_id, planId, payment.provider, expiresAt],
    );
    const subscription = subscriptionRows[0];

    await client.query(
      `UPDATE payments
       SET status = 'paid', subscription_id = $2
       WHERE id = $1`,
      [payment.id, subscription.id],
    );

    return { payment, subscription };
  });

// Only from 'created' — a payment that's already 'paid' should never be
// flipped to 'failed' by a stray/out-of-order webhook.
export const markFailed = async (id) => {
  await query("UPDATE payments SET status = 'failed' WHERE id = $1 AND status = 'created'", [id]);
};

export const findPageByUserId = async ({ userId, limit, cursorCreatedAt, cursorId }) => {
  const params = [userId];
  let whereClause = 'WHERE user_id = $1';

  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  const { rows } = await query(
    `SELECT * FROM payments
     ${whereClause}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};
