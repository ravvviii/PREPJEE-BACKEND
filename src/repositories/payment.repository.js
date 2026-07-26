import { query } from '../utils/db.js';

export const create = async ({ userId, provider, providerOrderId, amount, currency, metadata }) => {
  const { rows } = await query(
    `INSERT INTO payments (user_id, provider, provider_order_id, amount, currency, provider_metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, provider, providerOrderId, amount, currency, metadata ?? null],
  );
  return rows[0];
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

export const markPaid = async (id, { subscriptionId }) => {
  await query("UPDATE payments SET status = 'paid', subscription_id = $2 WHERE id = $1", [
    id,
    subscriptionId,
  ]);
};

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
