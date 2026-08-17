import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { env } from '../src/config/env.js';
import { razorpayClient } from '../src/config/razorpay.js';
import { signAdminAccessToken, signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p16-test-admin@test.local';
const TEST_USER_PHONE = '+911234599016';
const ACTIVE_PLAN_NAME = '__P16Test Active Plan__';
const INACTIVE_PLAN_NAME = '__P16Test Inactive Plan__';
const OTHER_BUCKET_PLAN_NAME = '__P16Test Other Bucket Plan__';
const NEW_PLAN_NAME = '__P16Test New Plan__';
const RECURRING_PLAN_NAME = '__Recurring Plan Test__';

const computePaymentSignature = (orderId, paymentId) =>
  createHmac('sha256', env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');

const computeWebhookSignature = (rawBody) =>
  createHmac('sha256', env.razorpay.webhookSecret).update(rawBody).digest('hex');
const orderPayload = (planId, idempotencyKey = randomUUID()) => ({ planId, idempotencyKey });

let app;
let adminId;
let adminToken;
let userId;
let userToken;
let activePlanId;
let inactivePlanId;
let otherBucketPlanId;

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
    await pool.query('INSERT INTO users (phone, bucket_id) VALUES ($1, 25) RETURNING id', [
      TEST_USER_PHONE,
    ])
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

  otherBucketPlanId = (
    await pool.query(
      `INSERT INTO subscription_plans
       (name, amount, duration_days, is_active, bucket_min, bucket_max)
     VALUES ($1, 9900, 7, TRUE, 50, 79)
     RETURNING id`,
      [OTHER_BUCKET_PLAN_NAME],
    )
  ).rows[0].id;
});

after(async () => {
  razorpayClient.qrCode.create = originalQrCodeCreate;
  await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscription_plans WHERE name = ANY($1)', [
    [ACTIVE_PLAN_NAME, INACTIVE_PLAN_NAME, OTHER_BUCKET_PLAN_NAME, NEW_PLAN_NAME, RECURRING_PLAN_NAME],
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
  assert.ok(names.includes(OTHER_BUCKET_PLAN_NAME));
  assert.equal(names.includes(INACTIVE_PLAN_NAME), false);
});

test("GET /subscription-plans filters plans using the authenticated user's bucket", async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/subscription-plans?limit=50',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const names = response.json().data.items.map((plan) => plan.name);

  assert.equal(response.statusCode, 200);
  assert.ok(names.includes(ACTIVE_PLAN_NAME));
  assert.equal(names.includes(OTHER_BUCKET_PLAN_NAME), false);
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
    payload: {
      name: NEW_PLAN_NAME,
      amount: 19900,
      durationDays: 7,
      bucketMin: 20,
      bucketMax: 29,
    },
  });
  assert.equal(response.statusCode, 401);
});

let createdPlanId;

test('POST /admin/subscription-plans creates a plan', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscription-plans',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      name: NEW_PLAN_NAME,
      amount: 19900,
      durationDays: 7,
      bucketMin: 20,
      bucketMax: 29,
    },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.isActive, true);
  assert.equal(body.data.bucketMin, 20);
  assert.equal(body.data.bucketMax, 29);
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

let recurringPlanId;

test('POST /admin/subscription-plans validates and creates a recurring trial plan', async () => {
  const incomplete = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscription-plans',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      name: RECURRING_PLAN_NAME,
      amount: 99900,
      durationDays: 30,
      recurringEnabled: true,
    },
  });
  assert.equal(incomplete.statusCode, 400);
  assert.equal(incomplete.json().error.code, 'INVALID_RECURRING_PLAN');

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subscription-plans',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      name: RECURRING_PLAN_NAME,
      amount: 99900,
      durationDays: 30,
      recurringEnabled: true,
      billingPeriod: 'monthly',
      billingInterval: 1,
      totalCount: 12,
      trialAmount: 100,
      trialDays: 1,
      providerPlanId: 'plan_test_recurring',
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.recurringEnabled, true);
  assert.equal(response.json().data.trialAmount, 100);
  recurringPlanId = response.json().data.id;
});

test('PUT /admin/subscription-plans/:id can disable recurring and clears its configuration', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/subscription-plans/${recurringPlanId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { recurringEnabled: false },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.recurringEnabled, false);
  assert.equal(response.json().data.providerPlanId, null);
  assert.equal(response.json().data.trialAmount, null);
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
    payload: orderPayload(activePlanId),
  });
  assert.equal(response.statusCode, 401);
});

test('POST /payments/order 404s for a plan that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: orderPayload('00000000-0000-0000-0000-000000000000'),
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'PLAN_NOT_FOUND');
});

test('POST /payments/order 404s for an inactive (retired) plan', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: orderPayload(inactivePlanId),
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'PLAN_NOT_FOUND');
});

test("POST /payments/order rejects a plan outside the user's bucket", async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: orderPayload(otherBucketPlanId),
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'PLAN_NOT_FOUND');
});

let firstOrderId;
let firstIdempotencyKey;
let firstQrCodeId;
let firstQrIdempotencyKey;
const originalQrCodeCreate = razorpayClient.qrCode.create;

test('POST /payments/order creates a real Razorpay order for an active plan', async () => {
  firstIdempotencyKey = randomUUID();
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: orderPayload(activePlanId, firstIdempotencyKey),
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

test('POST /payments/order reuses the order for the same idempotency key', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/order',
    headers: { authorization: `Bearer ${userToken}` },
    payload: orderPayload(activePlanId, firstIdempotencyKey),
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.orderId, firstOrderId);

  const count = await pool.query(
    'SELECT COUNT(*)::int AS count FROM payments WHERE user_id = $1 AND idempotency_key = $2',
    [userId, firstIdempotencyKey],
  );
  assert.equal(count.rows[0].count, 1);
});

test('POST /payments/qr creates a Razorpay QR code for an active plan', async () => {
  firstQrIdempotencyKey = randomUUID();
  firstQrCodeId = `qr_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  razorpayClient.qrCode.create = async (payload) => ({
    id: firstQrCodeId,
    image_url: `https://rzp.io/i/${firstQrCodeId}`,
    short_url: `https://rzp.io/l/${firstQrCodeId}`,
    payment_amount: payload.payment_amount,
  });
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/qr',
    headers: { authorization: `Bearer ${userToken}` },
    payload: {
      ...orderPayload(activePlanId, firstQrIdempotencyKey),
      description: 'PREPJEE QR test payment',
    },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.ok(body.data.qrCodeId.startsWith('qr_'));
  assert.ok(body.data.imageUrl);
  assert.equal(body.data.amount, 49900);

  const row = await pool.query(
    `SELECT status, provider_metadata
     FROM payments
     WHERE provider_order_id = $1`,
    [firstQrCodeId],
  );
  assert.equal(row.rows[0].status, 'created');
  assert.equal(row.rows[0].provider_metadata.checkoutType, 'qr');
});

test('POST /payments/qr reuses the QR code for the same idempotency key', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/payments/qr',
    headers: { authorization: `Bearer ${userToken}` },
    payload: orderPayload(activePlanId, firstQrIdempotencyKey),
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.qrCodeId, firstQrCodeId);

  const count = await pool.query(
    'SELECT COUNT(*)::int AS count FROM payments WHERE user_id = $1 AND idempotency_key = $2',
    [userId, firstQrIdempotencyKey],
  );
  assert.equal(count.rows[0].count, 1);
});

test('POST /payments/webhook with a valid QR payment completes the payment', async () => {
  razorpayClient.qrCode.create = originalQrCodeCreate;
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_fake_qr_webhook_1',
          qr_code_id: firstQrCodeId,
        },
      },
    },
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

  const paymentRow = await pool.query(
    'SELECT status, provider_payment_id, subscription_id FROM payments WHERE provider_order_id = $1',
    [firstQrCodeId],
  );
  assert.equal(paymentRow.rows[0].status, 'paid');
  assert.equal(paymentRow.rows[0].provider_payment_id, 'pay_fake_qr_webhook_1');
  assert.ok(paymentRow.rows[0].subscription_id);
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
    payload: orderPayload(activePlanId),
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
