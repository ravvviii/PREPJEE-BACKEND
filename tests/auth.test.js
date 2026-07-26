import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { redis, closeRedis } from '../src/config/redis.js';
import { getLastSentOtp } from '../src/modules/otp/otp-provider.js';
import { hashPassword } from '../src/utils/password.js';
import { signUserAccessToken, signAdminAccessToken } from '../src/utils/jwt.js';
import { OTP } from '../src/constants/index.js';

const TEST_PHONE = '+911234500001';
const TEST_PHONE_ATTEMPTS = '+911234500002';
const TEST_PHONE_EXPIRY = '+911234500003';
const ALL_TEST_PHONES = [TEST_PHONE, TEST_PHONE_ATTEMPTS, TEST_PHONE_EXPIRY];
const TEST_ADMIN_EMAIL = 'phase4-test-admin@test.local';
const TEST_ADMIN_PASSWORD = 'correct-horse-battery-staple';

let app;

const cleanupTestData = async () => {
  await pool.query(
    `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1))`,
    [ALL_TEST_PHONES],
  );
  await pool.query('DELETE FROM otp_codes WHERE phone = ANY($1)', [ALL_TEST_PHONES]);
  await pool.query('DELETE FROM users WHERE phone = ANY($1)', [ALL_TEST_PHONES]);
  await pool.query('DELETE FROM admins WHERE email = $1', [TEST_ADMIN_EMAIL]);

  const redisKeys = ALL_TEST_PHONES.flatMap((phone) => [
    `otp:cooldown:${phone}`,
    `otp:sendcount:${phone}`,
  ]);
  await redis.del(...redisKeys);
};

before(async () => {
  app = buildApp();
  await cleanupTestData();
});

after(async () => {
  await cleanupTestData();
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /auth/send-otp sends an OTP', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/send-otp',
    payload: { phone: TEST_PHONE },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.expiresInSeconds, OTP.EXPIRY_SECONDS);
  assert.equal(getLastSentOtp().phone, TEST_PHONE);
});

test('POST /auth/send-otp rejects an immediate resend (cooldown)', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/send-otp',
    payload: { phone: TEST_PHONE },
  });
  const body = response.json();

  assert.equal(response.statusCode, 429);
  assert.equal(body.error.code, 'OTP_COOLDOWN');
});

test('POST /auth/send-otp rejects a malformed phone number', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/send-otp',
    payload: { phone: 'not-a-phone' },
  });

  assert.equal(response.statusCode, 400);
});

test('POST /auth/verify-otp rejects an incorrect code and increments attempts', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-otp',
    payload: { phone: TEST_PHONE, otp: '000000' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 400);
  assert.equal(body.error.code, 'OTP_INCORRECT');
});

let issuedRefreshToken;

test('POST /auth/verify-otp succeeds with the correct code, creates the user, returns tokens', async () => {
  const { code } = getLastSentOtp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-otp',
    payload: { phone: TEST_PHONE, otp: code },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.user.phone, TEST_PHONE);
  assert.ok(body.data.accessToken);
  assert.ok(body.data.refreshToken);

  issuedRefreshToken = body.data.refreshToken;
});

test('POST /auth/refresh rotates the refresh token and kills the old one', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: issuedRefreshToken },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(body.data.accessToken);
  assert.ok(body.data.refreshToken);
  assert.notEqual(body.data.refreshToken, issuedRefreshToken);

  const reuseResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: issuedRefreshToken },
  });
  assert.equal(reuseResponse.statusCode, 401);

  issuedRefreshToken = body.data.refreshToken;
});

test('POST /auth/logout revokes the refresh token', async () => {
  const logoutResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    payload: { refreshToken: issuedRefreshToken },
  });
  assert.equal(logoutResponse.statusCode, 200);

  const refreshAfterLogout = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    payload: { refreshToken: issuedRefreshToken },
  });
  assert.equal(refreshAfterLogout.statusCode, 401);
});

test('POST /auth/verify-otp blocks further attempts after MAX_VERIFY_ATTEMPTS wrong codes', async () => {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/send-otp',
    payload: { phone: TEST_PHONE_ATTEMPTS },
  });

  for (let i = 0; i < OTP.MAX_VERIFY_ATTEMPTS; i += 1) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-otp',
      payload: { phone: TEST_PHONE_ATTEMPTS, otp: '000000' },
    });
    assert.equal(response.json().error.code, 'OTP_INCORRECT');
  }

  const blockedResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-otp',
    payload: { phone: TEST_PHONE_ATTEMPTS, otp: '000000' },
  });
  assert.equal(blockedResponse.statusCode, 400);
  assert.equal(blockedResponse.json().error.code, 'OTP_MAX_ATTEMPTS');
});

test('POST /auth/verify-otp rejects an expired code', async () => {
  await app.inject({
    method: 'POST',
    url: '/api/v1/auth/send-otp',
    payload: { phone: TEST_PHONE_EXPIRY },
  });
  const { code } = getLastSentOtp();

  await pool.query(
    `UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE phone = $1`,
    [TEST_PHONE_EXPIRY],
  );

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-otp',
    payload: { phone: TEST_PHONE_EXPIRY, otp: code },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'OTP_EXPIRED');
});

test('POST /admin/auth/login rejects an unknown email and a wrong password identically', async () => {
  await pool.query(
    'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
    ['Phase 4 Test Admin', TEST_ADMIN_EMAIL, await hashPassword(TEST_ADMIN_PASSWORD)],
  );

  const unknownEmailResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email: 'no-such-admin@test.local', password: 'whatever123' },
  });
  const wrongPasswordResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email: TEST_ADMIN_EMAIL, password: 'wrong-password' },
  });

  assert.equal(unknownEmailResponse.statusCode, 401);
  assert.equal(wrongPasswordResponse.statusCode, 401);
  assert.equal(unknownEmailResponse.json().error.code, 'INVALID_CREDENTIALS');
  assert.equal(wrongPasswordResponse.json().error.code, 'INVALID_CREDENTIALS');
});

test('POST /admin/auth/login succeeds with the right credentials', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.admin.email, TEST_ADMIN_EMAIL);
  assert.ok(body.data.accessToken);
});

// --- Middleware ---
// A throwaway app with one protected route each, just to exercise the
// middleware's token verification directly rather than re-testing login.
test('requireAuth / requireAdminAuth middleware', async (t) => {
  const { default: Fastify } = await import('fastify');
  const { requireAuth } = await import('../src/middlewares/auth.middleware.js');
  const { requireAdminAuth } = await import('../src/middlewares/admin-auth.middleware.js');

  const middlewareApp = Fastify();
  middlewareApp.get('/protected/user', { preHandler: requireAuth }, (request) => ({
    userId: request.user.id,
  }));
  middlewareApp.get('/protected/admin', { preHandler: requireAdminAuth }, (request) => ({
    adminId: request.admin.id,
  }));

  await t.test('rejects a request with no Authorization header', async () => {
    const response = await middlewareApp.inject({ method: 'GET', url: '/protected/user' });
    assert.equal(response.statusCode, 401);
  });

  await t.test('rejects a garbage token', async () => {
    const response = await middlewareApp.inject({
      method: 'GET',
      url: '/protected/user',
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    assert.equal(response.statusCode, 401);
  });

  await t.test('accepts a valid user access token', async () => {
    const token = signUserAccessToken('11111111-1111-1111-1111-111111111111');
    const response = await middlewareApp.inject({
      method: 'GET',
      url: '/protected/user',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().userId, '11111111-1111-1111-1111-111111111111');
  });

  await t.test('rejects a user token on the admin route', async () => {
    const token = signUserAccessToken('11111111-1111-1111-1111-111111111111');
    const response = await middlewareApp.inject({
      method: 'GET',
      url: '/protected/admin',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 401);
  });

  await t.test('accepts a valid admin access token', async () => {
    const token = signAdminAccessToken('22222222-2222-2222-2222-222222222222', 'admin');
    const response = await middlewareApp.inject({
      method: 'GET',
      url: '/protected/admin',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().adminId, '22222222-2222-2222-2222-222222222222');
  });

  await middlewareApp.close();
});
