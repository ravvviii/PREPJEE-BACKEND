import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';

const TEST_EMAIL_NEW = 'p-google-new@test.local';
const TEST_EMAIL_LINKING = 'p-google-linking@test.local';
const TEST_EMAIL_UNVERIFIED = 'p-google-unverified@test.local';
const TEST_EMAIL_SUSPENDED = 'p-google-suspended@test.local';
const TEST_PHONE_LINKING = '+911234599900';
const TEST_PHONE_UNVERIFIED = '+911234599901';
const TEST_PHONE_SUSPENDED = '+911234599902';
const ALL_TEST_EMAILS = [TEST_EMAIL_NEW, TEST_EMAIL_LINKING, TEST_EMAIL_UNVERIFIED, TEST_EMAIL_SUSPENDED];
const ALL_TEST_PHONES = [TEST_PHONE_LINKING, TEST_PHONE_UNVERIFIED, TEST_PHONE_SUSPENDED];

let app;

// In test mode, google-auth-provider.js decodes without verifying the
// signature — this just needs to be JWT-shaped, any secret works.
const fakeGoogleIdToken = (claims) => jwt.sign(claims, 'irrelevant-in-test-mode');

before(async () => {
  app = buildApp();
});

after(async () => {
  await pool.query(
    `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1) OR phone = ANY($2))`,
    [ALL_TEST_EMAILS, ALL_TEST_PHONES],
  );
  await pool.query('DELETE FROM users WHERE email = ANY($1) OR phone = ANY($2)', [
    ALL_TEST_EMAILS,
    ALL_TEST_PHONES,
  ]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /auth/google rejects a request with no idToken', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/v1/auth/google', payload: {} });
  assert.equal(response.statusCode, 400);
});

test('POST /auth/google rejects a token that decodes without sub/email', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: { idToken: fakeGoogleIdToken({ foo: 'bar' }) },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'INVALID_GOOGLE_TOKEN');
});

let newUserGoogleId;
let newUserId;

test('POST /auth/google creates a new phone-less user on first sign-in', async () => {
  newUserGoogleId = `google-new-${Date.now()}`;
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: {
      idToken: fakeGoogleIdToken({
        sub: newUserGoogleId,
        email: TEST_EMAIL_NEW,
        email_verified: true,
        name: 'New Google User',
      }),
    },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.user.email, TEST_EMAIL_NEW);
  assert.equal(body.data.user.phone, null);
  assert.ok(body.data.accessToken);
  newUserId = body.data.user.id;

  const row = await pool.query('SELECT phone, google_id FROM users WHERE id = $1', [newUserId]);
  assert.equal(row.rows[0].phone, null);
  assert.equal(row.rows[0].google_id, newUserGoogleId);
});

test('POST /auth/google signing in again with the same googleId reuses the same user, not a duplicate', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: {
      idToken: fakeGoogleIdToken({
        sub: newUserGoogleId,
        email: TEST_EMAIL_NEW,
        email_verified: true,
      }),
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.user.id, newUserId);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE google_id = $1', [
    newUserGoogleId,
  ]);
  assert.equal(rows[0].count, 1);
});

test('POST /auth/google links to an existing phone account when the email is verified and matches', async () => {
  const { rows } = await pool.query(
    'INSERT INTO users (phone, email) VALUES ($1, $2) RETURNING id',
    [TEST_PHONE_LINKING, TEST_EMAIL_LINKING],
  );
  const existingUserId = rows[0].id;
  const googleId = `google-link-${Date.now()}`;

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: {
      idToken: fakeGoogleIdToken({
        sub: googleId,
        email: TEST_EMAIL_LINKING,
        email_verified: true,
      }),
    },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.user.id, existingUserId);
  assert.equal(body.data.user.phone, TEST_PHONE_LINKING);

  const row = await pool.query('SELECT google_id FROM users WHERE id = $1', [existingUserId]);
  assert.equal(row.rows[0].google_id, googleId);
});

test('POST /auth/google does NOT link when the email is unverified — creates a separate account instead', async () => {
  const { rows } = await pool.query(
    'INSERT INTO users (phone, email) VALUES ($1, $2) RETURNING id',
    [TEST_PHONE_UNVERIFIED, TEST_EMAIL_UNVERIFIED],
  );
  const existingUserId = rows[0].id;
  const googleId = `google-unverified-${Date.now()}`;

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: {
      idToken: fakeGoogleIdToken({
        sub: googleId,
        email: TEST_EMAIL_UNVERIFIED,
        email_verified: false,
      }),
    },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.notEqual(body.data.user.id, existingUserId);
  // users.email is unique, and the existing row already holds this email —
  // the new account is created without it rather than violating that
  // constraint or silently mis-attributing an unverified email.
  assert.equal(body.data.user.email, null);

  const existingRow = await pool.query('SELECT google_id FROM users WHERE id = $1', [
    existingUserId,
  ]);
  assert.equal(existingRow.rows[0].google_id, null);

  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [body.data.user.id]);
  await pool.query('DELETE FROM users WHERE id = $1', [body.data.user.id]);
});

test('POST /auth/google rejects sign-in for a suspended account', async () => {
  const googleId = `google-suspended-${Date.now()}`;
  const { rows } = await pool.query(
    'INSERT INTO users (phone, google_id, suspended_at) VALUES ($1, $2, NOW()) RETURNING id',
    [TEST_PHONE_SUSPENDED, googleId],
  );

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/google',
    payload: {
      idToken: fakeGoogleIdToken({
        sub: googleId,
        email: TEST_EMAIL_SUSPENDED,
        email_verified: true,
      }),
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().error.code, 'ACCOUNT_SUSPENDED');

  await pool.query('DELETE FROM users WHERE id = $1', [rows[0].id]);
});
