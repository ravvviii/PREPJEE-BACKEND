import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { env } from '../src/config/env.js';

const INTERNAL_KEY = 'test-internal-api-key-at-least-32-chars';
const TEST_USER_PHONE = '+911234599088';
const TEST_USER_EMAIL = 'internal-subscription@example.com';
const DEFAULT_PLAN_NAME = 'monthly_999';
const CUSTOM_PLAN_NAME = '__Internal Subscription Custom__';

let app;
let userId;
let defaultPlanId;
let customPlanId;
let createdDefaultPlan = false;

before(async () => {
  env.internal.apiKey = INTERNAL_KEY;
  app = buildApp();

  userId = (
    await pool.query('INSERT INTO users (phone, email) VALUES ($1, $2) RETURNING id', [
      TEST_USER_PHONE,
      TEST_USER_EMAIL,
    ])
  ).rows[0].id;

  const existingDefault = await pool.query(
    'SELECT id FROM subscription_plans WHERE name = $1',
    [DEFAULT_PLAN_NAME],
  );
  if (existingDefault.rows[0]) {
    defaultPlanId = existingDefault.rows[0].id;
  } else {
    defaultPlanId = (
      await pool.query(
        `INSERT INTO subscription_plans (name, amount, duration_days)
         VALUES ($1, 99900, 30) RETURNING id`,
        [DEFAULT_PLAN_NAME],
      )
    ).rows[0].id;
    createdDefaultPlan = true;
  }

  customPlanId = (
    await pool.query(
      `INSERT INTO subscription_plans (name, amount, duration_days)
       VALUES ($1, 19900, 7) RETURNING id`,
      [CUSTOM_PLAN_NAME],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscription_plans WHERE id = $1', [customPlanId]);
  if (createdDefaultPlan) {
    await pool.query('DELETE FROM subscription_plans WHERE id = $1', [defaultPlanId]);
  }
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /internal/subscriptions rejects a missing API key', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/subscriptions',
    payload: { phone: TEST_USER_PHONE },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'INVALID_INTERNAL_API_KEY');
});

test('POST /internal/subscriptions defaults to monthly_999', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/subscriptions',
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    payload: { phone: TEST_USER_PHONE },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.planName, DEFAULT_PLAN_NAME);
});

test('POST /internal/subscriptions accepts an explicit plan name', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/subscriptions',
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    payload: { phone: TEST_USER_PHONE, planName: CUSTOM_PLAN_NAME },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.planName, CUSTOM_PLAN_NAME);
});

test('POST /internal/subscriptions accepts an email instead of a phone', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/subscriptions',
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    payload: { email: TEST_USER_EMAIL },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.planName, DEFAULT_PLAN_NAME);
});

test('POST /internal/subscriptions requires exactly one user identifier', async () => {
  const missing = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/subscriptions',
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    payload: {},
  });
  const both = await app.inject({
    method: 'POST',
    url: '/api/v1/internal/subscriptions',
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    payload: { phone: TEST_USER_PHONE, email: TEST_USER_EMAIL },
  });

  assert.equal(missing.statusCode, 400);
  assert.equal(both.statusCode, 400);
});

test('DELETE /internal/subscriptions revokes active access by email', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: '/api/v1/internal/subscriptions',
    headers: { 'x-internal-api-key': INTERNAL_KEY },
    payload: { email: TEST_USER_EMAIL },
  });

  assert.equal(response.statusCode, 200);
  const active = await pool.query(
    "SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(active.rowCount, 0);
});
