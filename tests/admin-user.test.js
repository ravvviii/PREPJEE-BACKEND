import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p17-user-test-admin@test.local';
const TEST_USER_PHONE = '+911234599018';
const TEST_USER_NAME = '__P17UserTest Name__';

let app;
let adminId;
let adminToken;
let userId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P17 User Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;
  adminToken = signAdminAccessToken(adminId, 'admin');

  userId = (
    await pool.query('INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING id', [
      TEST_USER_PHONE,
      TEST_USER_NAME,
    ])
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /admin/users rejects a request with no admin token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/users' });
  assert.equal(response.statusCode, 401);
});

test('GET /admin/users?search finds a user by phone', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/users?search=${encodeURIComponent(TEST_USER_PHONE)}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(body.data.some((user) => user.id === userId));
});

test('GET /admin/users?search finds a user by partial name', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/users?search=${encodeURIComponent('P17UserTest')}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(body.data.some((user) => user.id === userId));
});

test('POST /admin/users/:id/suspend 404s for an unknown user id', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/users/00000000-0000-0000-0000-000000000000/suspend',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'USER_NOT_FOUND');
});

test('POST /admin/users/:id/suspend sets suspended_at and revokes outstanding refresh tokens', async () => {
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'p17-test-hash', NOW() + interval '1 day')",
    [userId],
  );

  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/users/${userId}/suspend`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(body.data.suspendedAt);

  const { rows } = await pool.query(
    'SELECT revoked_at FROM refresh_tokens WHERE user_id = $1',
    [userId],
  );
  assert.ok(rows.every((row) => row.revoked_at !== null));
});

test('POST /admin/users/:id/unsuspend clears suspended_at', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/users/${userId}/unsuspend`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.suspendedAt, null);
});
