import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signUserAccessToken } from '../src/utils/jwt.js';

const TEST_PHONE = '+911234599001';

let app;
let userId;
let accessToken;
let seededClassId;
let seededExamId;
let adminId;
let subjectId;
let chapterId;
let questionId;

before(async () => {
  app = buildApp();

  const { rows: userRows } = await pool.query(
    'INSERT INTO users (phone) VALUES ($1) RETURNING id',
    [TEST_PHONE],
  );
  userId = userRows[0].id;
  accessToken = signUserAccessToken(userId);

  seededClassId = (await pool.query("SELECT id FROM classes WHERE name = 'Class 11'")).rows[0].id;
  seededExamId = (await pool.query("SELECT id FROM exams WHERE name = 'JEE Main'")).rows[0].id;

  // Fixtures for the stats-aggregation test — Phase 10 (Questions)/13 (Attempts)
  // don't exist yet, so build the FK chain directly.
  adminId = (
    await pool.query(
      `INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      ['User Test Admin', 'user-module-test-admin@test.local', 'hash'],
    )
  ).rows[0].id;

  subjectId = (
    await pool.query(`INSERT INTO subjects (name) VALUES ($1) RETURNING id`, [
      '__UserTest Subject__',
    ])
  ).rows[0].id;

  chapterId = (
    await pool.query(
      `INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id`,
      [subjectId, seededClassId, '__UserTest Chapter__'],
    )
  ).rows[0].id;

  questionId = (
    await pool.query(
      `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [subjectId, seededClassId, chapterId, '__UserTest Question__', adminId],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM attempts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM questions WHERE id = $1', [questionId]);
  await pool.query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  await pool.query('DELETE FROM subjects WHERE id = $1', [subjectId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);

  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /users/me rejects a request with no token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
  assert.equal(response.statusCode, 401);
});

test('GET /users/me returns the profile with zeroed stats and no subscription', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/users/me',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.id, userId);
  assert.equal(body.data.phone, TEST_PHONE);
  assert.equal(body.data.subscription.status, 'none');
  assert.equal(body.data.stats.totalAttempts, 0);
  assert.equal(body.data.stats.accuracyPercent, 0);
});

test('PUT /users/profile updates name/email and reflects it back', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/users/profile',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { name: 'Test Student', email: 'test-student@example.com' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.name, 'Test Student');
  assert.equal(body.data.email, 'test-student@example.com');
});

test('PUT /users/profile accepts a real classId and targetExamId', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/users/profile',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { classId: seededClassId, targetExamId: seededExamId },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.classId, seededClassId);
  assert.equal(body.data.targetExamId, seededExamId);
});

test('PUT /users/profile rejects a classId that does not exist', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/users/profile',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { classId: '00000000-0000-0000-0000-000000000000' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'CLASS_NOT_FOUND');
});

test('PUT /users/profile silently ignores an attempt to change the phone number', async () => {
  // "phone" isn't in the schema, and Fastify's AJV strips unknown properties
  // by default (rather than rejecting) — so this returns 200, but the phone
  // itself must be provably unchanged, which is the property that actually matters.
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/users/profile',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { phone: '+919999999999' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.phone, TEST_PHONE);
});

test('GET /users/me reflects real attempt stats once attempts exist', async () => {
  await pool.query(
    `INSERT INTO attempts (user_id, question_id, is_correct) VALUES
       ($1, $2, true),
       ($1, $2, false)`,
    [userId, questionId],
  );

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/users/me',
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = response.json();

  assert.equal(body.data.stats.totalAttempts, 2);
  assert.equal(body.data.stats.correctAttempts, 1);
  assert.equal(body.data.stats.accuracyPercent, 50);
});

test('GET /users/me reflects an active subscription', async () => {
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_type, status, expires_at)
     VALUES ($1, 'monthly', 'active', NOW() + INTERVAL '30 days')`,
    [userId],
  );

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/users/me',
    headers: { authorization: `Bearer ${accessToken}` },
  });

  assert.equal(response.json().data.subscription.status, 'active');
});
