import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';
import * as dashboardRepository from '../src/repositories/dashboard.repository.js';

const TEST_ADMIN_EMAIL = 'p17-dashboard-test-admin@test.local';
const TEST_USER_PHONE = '+911234599017';
const TEST_CHAPTER_NAME = '__P17DashboardTest Chapter__';
const TEST_QUESTION_TEXT = '__P17DashboardTest Question__';

let app;
let adminId;
let adminToken;
let userId;
let chapterId;
let questionId;
let subjectId;
let classId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P17 Dashboard Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;
  adminToken = signAdminAccessToken(adminId, 'admin');

  userId = (
    await pool.query('INSERT INTO users (phone) VALUES ($1) RETURNING id', [TEST_USER_PHONE])
  ).rows[0].id;

  subjectId = (await pool.query("SELECT id FROM subjects WHERE name = 'Physics'")).rows[0].id;
  classId = (await pool.query("SELECT id FROM classes WHERE name = 'Class 11'")).rows[0].id;

  chapterId = (
    await pool.query(
      'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
      [subjectId, classId, TEST_CHAPTER_NAME],
    )
  ).rows[0].id;

  questionId = (
    await pool.query(
      `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by, is_published)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
      [subjectId, classId, chapterId, TEST_QUESTION_TEXT, adminId],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM attempts WHERE question_id = $1', [questionId]);
  await pool.query('DELETE FROM payments WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM questions WHERE id = $1', [questionId]);
  await pool.query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /admin/dashboard/stats rejects a request with no admin token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/admin/dashboard/stats' });
  assert.equal(response.statusCode, 401);
});

test('GET /admin/dashboard/stats reflects a new attempt, subscription, and paid payment', async () => {
  const beforeAttempts = await dashboardRepository.countAttempts();
  const beforeSubscriptions = await dashboardRepository.countActiveSubscriptions();
  const beforeRevenue = await dashboardRepository.sumRevenue();

  await pool.query(
    'INSERT INTO attempts (user_id, question_id, is_correct) VALUES ($1, $2, $3)',
    [userId, questionId, true],
  );
  await pool.query(
    "INSERT INTO subscriptions (user_id, status, expires_at) VALUES ($1, 'active', NOW() + interval '30 days')",
    [userId],
  );
  await pool.query(
    "INSERT INTO payments (user_id, provider_order_id, amount, status) VALUES ($1, $2, $3, 'paid')",
    [userId, '__P17DashboardTest order__', 19900],
  );

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/dashboard/stats',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const body = response.json();

  // >= rather than === : these are global aggregates, and other test files'
  // suites run concurrently against the same DB and may add their own rows
  // to the same tables between the snapshot and this request. The point of
  // this test is just to confirm our own insert is reflected, not to own
  // the whole table's row count.
  assert.equal(response.statusCode, 200);
  assert.ok(body.data.totalUsers >= 1);
  assert.ok(body.data.totalAttempts >= beforeAttempts + 1);
  assert.ok(body.data.activeSubscriptions >= beforeSubscriptions + 1);
  assert.ok(body.data.totalRevenue.amount >= beforeRevenue + 19900);
  assert.equal(body.data.totalRevenue.currency, 'INR');
});

test('mostAttemptedQuestions accurately counts attempts for a specific question', async () => {
  await pool.query(
    'INSERT INTO attempts (user_id, question_id, is_correct) VALUES ($1, $2, $3), ($1, $2, $4)',
    [userId, questionId, true, false],
  );

  // Bypasses the route's limit cap — this asserts the repository's counting
  // logic is correct, independent of whether this question ranks in the
  // top N among however much attempt data other test files have seeded.
  const rows = await dashboardRepository.mostAttemptedQuestions(100000);
  const row = rows.find((r) => r.id === questionId);

  assert.ok(row, 'expected the test question to appear in the results');
  assert.equal(row.attempt_count, 3);
});

test('weakestChapters accurately computes accuracy for a specific chapter', async () => {
  const rows = await dashboardRepository.weakestChapters(100000, 1);
  const row = rows.find((r) => r.id === chapterId);

  // Attempts seeded across the two tests above: true, true, false — 2/3 correct.
  assert.ok(row, 'expected the test chapter to appear in the results');
  assert.equal(row.attempt_count, 3);
  assert.equal(Math.round((row.accuracy + Number.EPSILON) * 100) / 100, 0.67);
});

test('GET /admin/dashboard/questions/most-attempted responds with the expected shape', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/dashboard/questions/most-attempted?limit=5',
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().data));
});

test('GET /admin/dashboard/chapters/weak responds with the expected shape', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/dashboard/chapters/weak?limit=5&minAttempts=1',
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json().data));
});
