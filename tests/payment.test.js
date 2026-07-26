import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { env } from '../src/config/env.js';
import { signAdminAccessToken, signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p16-test-admin@test.local';
const TEST_USER_PHONE = '+911234599016';
const ACTIVE_PLAN_NAME = '__P16Test Active Plan__';
const INACTIVE_PLAN_NAME = '__P16Test Inactive Plan__';
const NEW_PLAN_NAME = '__P16Test New Plan__';

const computePaymentSignature = (orderId, paymentId) =>
  createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');

const computeWebhookSignature = (rawBody) =>
  createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');

let app;
let adminId;
let adminToken;
let userId;
let userToken;
let activePlanId;
let inactivePlanId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P16 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;
  adminToken = signAdminAccessToken(adminId, 'admin');

  userId = (
    await pool.query('INSERT INTO users (phone) VALUES ($1) RETURNING id', [TEST_USER_PHONE])
  ).rows[0].id;
  userToken = signUserAccessToken(userId);

  activePlanId = (
    await pool.query(
      `INSERT INTO subscription_plans (name, amount, duration_days, is_active)
       VALUES ($1, 49900, 30, TRUE) RETURNING id`,
      [ACTIVE_PLAN_NAME],
    )
  ).rows[0].id;

  inactivePlanId = (
    await pool.query(
      `INSERT INTO subscription_plans (name, amount, duration_days, is_active)
       VALUES ($1, 99900, 365, FALSE) RETURNING id`,
      [INACTIVE_PLAN_NAME],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscription_plans WHERE name = ANY($1)', [
    [ACTIVE_PLAN_NAME, INACTIVE_PLAN_NAME, NEW_PLAN_NAME],
  ]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /subscription-plans (public) only shows active plans', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/subscription-plans?limit=50' });
  const names = response.json().data.items.map((p) => p.name);

  assert.equal(response.statusCode, 200);
  assert.ok(names.includes(ACTIVE_PLAN_NAME));
  assert.equal(names.includes(INACTIVE_PLAN_NAME), false);
});

test('GET /admin/subscription-plans (admin) shows active and retired plans', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/subscription-plans?limit=50',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const names = response.json().data.items.map((p) => p.name);

  assert.ok(names.includes(ACTIVE_PLAN_NAME));
  assert.ok(names.includes(INACTIVE_PLAN_NAME));
});

test('POST /admin/subscription-plans rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscription-plans',
    payload: { name: NEW_PLAN_NAME, amount: 19900, durationDays: 7 },
  });
  assert.equal(response.statusCode, 401);
});

let createdPlanId;

test('POST /admin/subscription-plans creates a plan', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscription-plans',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: NEW_PLAN_NAME, amount: 19900, durationDays: 7 },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.isActive, true);
  createdPlanId = body.data.id;
});

test('POST /admin/subscription-plans rejects a duplicate name', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscription-plans',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: NEW_PLAN_NAME, amount: 19900, durationDays: 7 },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'PLAN_NAME_TAKEN');
});

test('PUT /admin/subscription-plans/:id can retire a plan', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/subscription-plans/${createdPlanId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { isActive: false },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.isActive, false);
});

test('POST /payments/order rejects a request with no token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    payload: { planId: activePlanId },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /payments/order 404s for a plan that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: { planId: '00000000-0000-0000-0000-000000000000' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'PLAN_NOT_FOUND');
});

test('POST /payments/order 404s for an inactive (retired) plan', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: { planId: inactivePlanId },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'PLAN_NOT_FOUND');
});

let firstOrderId;

test('POST /payments/order creates a real Razorpay order for an active plan', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: { planId: activePlanId },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.ok(body.data.orderId.startsWith('order_'));
  assert.equal(body.data.amount, 49900);
  assert.equal(body.data.keyId, env.razorpay.keyId);
  firstOrderId = body.data.orderId;

  const row = await pool.query('SELECT status FROM payments WHERE provider_order_id = $1', [
    firstOrderId,
  ]);
  assert.equal(row.rows[0].status, 'created');
});

test('POST /payments/verify rejects an incorrect signature', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/verify',
    headers: { authorization: `Bearer ${userToken}` },
    payload: {
      razorpayOrderId: firstOrderId,
      razorpayPaymentId: 'pay_fake123',
      razorpaySignature: 'not-a-real-signature',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'INVALID_SIGNATURE');
});

test('POST /payments/verify with a correct signature marks the payment paid and activates a subscription', async () => {
  const fakePaymentId = 'pay_fake_verify_1';
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/verify',
    headers: { authorization: `Bearer ${userToken}` },
    payload: {
      razorpayOrderId: firstOrderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: computePaymentSignature(firstOrderId, fakePaymentId),
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.status, 'paid');

  const paymentRow = await pool.query(
    'SELECT status, subscription_id FROM payments WHERE provider_order_id = $1',
    [firstOrderId],
  );
  assert.equal(paymentRow.rows[0].status, 'paid');
  assert.ok(paymentRow.rows[0].subscription_id);

  const subRow = await pool.query(
    "SELECT status, plan_id, expires_at FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(subRow.rows.length, 1);
  assert.equal(subRow.rows[0].plan_id, activePlanId);
});

test('POST /payments/verify is idempotent — calling it again does not create a second subscription', async () => {
  const fakePaymentId = 'pay_fake_verify_1';
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/verify',
    headers: { authorization: `Bearer ${userToken}` },
    payload: {
      razorpayOrderId: firstOrderId,
      razorpayPaymentId: fakePaymentId,
      razorpaySignature: computePaymentSignature(firstOrderId, fakePaymentId),
    },
  });
  assert.equal(response.statusCode, 200);

  const subRow = await pool.query(
    "SELECT COUNT(*)::int AS count FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(subRow.rows[0].count, 1);
});

test('GET /payments/history includes the paid payment', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/payments/history?limit=50',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const items = response.json().data.items;

  assert.ok(items.some((p) => p.status === 'paid' && p.amount === 49900));
});

test('GET /users/me reflects the newly active subscription', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/users/me',
    headers: { authorization: `Bearer ${userToken}` },
  });

  assert.equal(response.json().data.subscription.status, 'active');
});

let secondOrderId;

test('POST /payments/webhook rejects an incorrect signature', async () => {
  const orderResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: { planId: activePlanId },
  });
  secondOrderId = orderResponse.json().data.orderId;

  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_fake_webhook_1', order_id: secondOrderId } } },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/webhook',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'wrong-signature' },
    payload: rawBody,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'INVALID_WEBHOOK_SIGNATURE');
});

test('POST /payments/webhook with a valid signature completes the payment (payment.captured)', async () => {
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_fake_webhook_1', order_id: secondOrderId } } },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/webhook',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': computeWebhookSignature(rawBody),
    },
    payload: rawBody,
  });

  assert.equal(response.statusCode, 200);

  const paymentRow = await pool.query('SELECT status FROM payments WHERE provider_order_id = $1', [
    secondOrderId,
  ]);
  assert.equal(paymentRow.rows[0].status, 'paid');

  // The first subscription (from the /verify test) should now be expired —
  // only one "current" active subscription per user at a time.
  const activeCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM subscriptions WHERE user_id = $1 AND status = 'active'",
    [userId],
  );
  assert.equal(activeCount.rows[0].count, 1);
});

test('POST /payments/webhook silently ignores an unknown order_id', async () => {
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_unknown', order_id: 'order_does_not_exist' } } },
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/webhook',
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': computeWebhookSignature(rawBody),
    },
    payload: rawBody,
  });

  assert.equal(response.statusCode, 200);
});
