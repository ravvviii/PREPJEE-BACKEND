import { query } from '../utils/db.js';
import { withTransaction } from '../utils/transaction.js';

export const findPage = async ({ limit, cursorCreatedAt, cursorId, onlyActive }) => {
  const params = [];
  let whereClause = 'WHERE TRUE';

  if (onlyActive) {
    whereClause += ' AND is_active = TRUE';
  }
  if (cursorCreatedAt && cursorId) {
    params.push(cursorCreatedAt, cursorId);
    whereClause += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  const { rows } = await query(
    `SELECT * FROM subscription_plans
     ${whereClause}
     ORDER BY created_at ASC, id ASC
     LIMIT $${params.length}`,
    params,
  );
  return rows;
};

export const findById = async (id) => {
  const { rows } = await query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
  return rows[0] ?? null;
};

export const findByName = async (name) => {
  const { rows } = await query('SELECT * FROM subscription_plans WHERE name = $1', [name]);
  return rows[0] ?? null;
};

export const findDefault = async () => {
  const { rows } = await query('SELECT * FROM subscription_plans WHERE is_default = TRUE LIMIT 1');
  return rows[0] ?? null;
};

export const create = async ({ name, amount, currency, durationDays }) => {
  const { rows } = await query(
    `INSERT INTO subscription_plans (name, amount, currency, duration_days)
     VALUES ($1, $2, COALESCE($3, 'INR'), $4)
     RETURNING *`,
    [name, amount, currency, durationDays],
  );
  return rows[0];
};

export const update = async (id, { name, amount, currency, durationDays, isActive }) => {
  const { rows } = await query(
    `UPDATE subscription_plans SET
       name = COALESCE($2, name),
       amount = COALESCE($3, amount),
       currency = COALESCE($4, currency),
       duration_days = COALESCE($5, duration_days),
       is_active = COALESCE($6, is_active)
     WHERE id = $1
     RETURNING *`,
    [id, name, amount, currency, durationDays, isActive],
  );
  return rows[0] ?? null;
};

// Unsetting the old default and setting the new one must happen atomically —
// the partial unique index only allows one is_default = TRUE row at a time,
// so doing this as two separate non-transactional statements could
// momentarily violate it under concurrent requests.
export const setAsDefault = async (id) =>
  withTransaction(async (client) => {
    await client.query('UPDATE subscription_plans SET is_default = FALSE WHERE is_default = TRUE');
    const { rows } = await client.query(
      'UPDATE subscription_plans SET is_default = TRUE WHERE id = $1 RETURNING *',
      [id],
    );
    return rows[0] ?? null;
  });

export const unsetDefault = async (id) => {
  const { rows } = await query(
    'UPDATE subscription_plans SET is_default = FALSE WHERE id = $1 RETURNING *',
    [id],
  );
  return rows[0] ?? null;
};
