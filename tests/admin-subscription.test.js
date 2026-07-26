import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p16b-test-admin@test.local';
const TEST_USER_PHONE = '+911234599020';
const PLAN_A_NAME = '__P16bTest Plan A__';
const PLAN_B_NAME = '__P16bTest Plan B__';

let app;
let adminId;
let adminToken;
let userId;
let planAId;
let planBId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P16b Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;
  adminToken = signAdminAccessToken(adminId, 'admin');

  userId = (
    await pool.query('INSERT INTO users (phone) VALUES ($1) RETURNING id', [TEST_USER_PHONE])
  ).rows[0].id;

  planAId = (
    await pool.query(
      'INSERT INTO subscription_plans (name, amount, duration_days) VALUES ($1, 19900, 7) RETURNING id',
      [PLAN_A_NAME],
    )
  ).rows[0].id;

  planBId = (
    await pool.query(
      'INSERT INTO subscription_plans (name, amount, duration_days) VALUES ($1, 49900, 30) RETURNING id',
      [PLAN_B_NAME],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscription_plans WHERE name = ANY($1)', [
    [PLAN_A_NAME, PLAN_B_NAME],
  ]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /admin/subscriptions/grant rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/grant',
    payload: { phone: TEST_USER_PHONE, planName: PLAN_A_NAME },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /admin/subscriptions/grant 404s for a phone number that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/grant',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: '+910000000000', planName: PLAN_A_NAME },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'USER_NOT_FOUND');
});

test('POST /admin/subscriptions/grant 404s for a plan name that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/grant',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: TEST_USER_PHONE, planName: 'Not A Real Plan' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'PLAN_NOT_FOUND');
});

test('POST /admin/subscriptions/grant with no planName and no default configured fails clearly', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/grant',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: TEST_USER_PHONE },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'NO_DEFAULT_PLAN');
});

test('POST /admin/subscriptions/grant with a real planName activates the subscription', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/grant',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: TEST_USER_PHONE, planName: PLAN_A_NAME },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.planName, PLAN_A_NAME);

  const row = await pool.query(
    "SELECT plan_id, provider, status FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(row.rows[0].plan_id, planAId);
  assert.equal(row.rows[0].provider, 'admin_grant');
});

test('PUT /admin/subscription-plans/:id can mark exactly one plan as default at a time', async () => {
  await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/subscription-plans/${planAId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { isDefault: true },
  });

  const afterFirst = await pool.query(
    'SELECT id, is_default FROM subscription_plans WHERE id = ANY($1)',
    [[planAId, planBId]],
  );
  assert.ok(afterFirst.rows.find((r) => r.id === planAId).is_default);
  assert.equal(afterFirst.rows.find((r) => r.id === planBId).is_default, false);

  await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/subscription-plans/${planBId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { isDefault: true },
  });

  const afterSecond = await pool.query(
    'SELECT id, is_default FROM subscription_plans WHERE id = ANY($1)',
    [[planAId, planBId]],
  );
  assert.equal(afterSecond.rows.find((r) => r.id === planAId).is_default, false);
  assert.ok(afterSecond.rows.find((r) => r.id === planBId).is_default);
});

test('POST /admin/subscriptions/grant with no planName falls back to the default plan', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/grant',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: TEST_USER_PHONE },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.planName, PLAN_B_NAME);

  // granting again expires the previous active subscription — only one at a time
  const activeCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(activeCount.rows[0].count, 1);
});

test('POST /admin/subscriptions/revoke rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/revoke',
    payload: { phone: TEST_USER_PHONE },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /admin/subscriptions/revoke 404s for a phone number that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/revoke',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: '+910000000000' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'USER_NOT_FOUND');
});

test('POST /admin/subscriptions/revoke revokes the active subscription', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/revoke',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: TEST_USER_PHONE },
  });
  assert.equal(response.statusCode, 200);

  const activeCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(activeCount.rows[0].count, 0);
});

test('POST /admin/subscriptions/revoke 404s when the user has no active subscription left', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscriptions/revoke',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { phone: TEST_USER_PHONE },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'SUBSCRIPTION_NOT_FOUND');
});
