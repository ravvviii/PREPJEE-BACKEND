import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken, signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p11-test-admin@test.local';
const TEST_USER_PHONE = '+911234599011';
const TEST_CHAPTER_NAME = '__P11Test Chapter__';
const TEST_QUESTION_TEXT = '__P11Test Question__';

let app;
let adminId;
let adminToken;
let userId;
let userToken;
let chapterId;
let questionId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P11 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;
  adminToken = signAdminAccessToken(adminId, 'admin');

  userId = (
    await pool.query('INSERT INTO users (phone) VALUES ($1) RETURNING id', [TEST_USER_PHONE])
  ).rows[0].id;
  userToken = signUserAccessToken(userId);

  const physicsId = (await pool.query("SELECT id FROM subjects WHERE name = 'Physics'")).rows[0]
    .id;
  const class11Id = (await pool.query("SELECT id FROM classes WHERE name = 'Class 11'")).rows[0]
    .id;

  chapterId = (
    await pool.query(
      'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
      [physicsId, class11Id, TEST_CHAPTER_NAME],
    )
  ).rows[0].id;

  questionId = (
    await pool.query(
      `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [physicsId, class11Id, chapterId, TEST_QUESTION_TEXT, adminId],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM options WHERE question_id = $1', [questionId]);
  await pool.query('DELETE FROM questions WHERE id = $1', [questionId]);
  await pool.query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /admin/questions/:questionId/options rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/options`,
    payload: { optionText: 'A' },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /admin/questions/:questionId/options 404s for a question that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/questions/00000000-0000-0000-0000-000000000000/options',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { optionText: 'A' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

let optionAId;
let optionBId;

test('POST creates the first option with auto orderIndex 0', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/options`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { optionText: 'Option A', isCorrect: false },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.orderIndex, 0);
  assert.equal(body.data.isCorrect, false);
  optionAId = body.data.id;
});

test('POST creates the second option with auto orderIndex 1', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/options`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { optionText: 'Option B (correct)', isCorrect: true },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.orderIndex, 1);
  assert.equal(body.data.isCorrect, true);
  optionBId = body.data.id;
});

test('GET /admin/questions/:questionId/options (admin) sees isCorrect on both options', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions/${questionId}/options`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const items = response.json().data;

  assert.equal(items.length, 2);
  const correctOne = items.find((o) => o.id === optionBId);
  assert.equal(correctOne.isCorrect, true);
});

test('PUT /admin/options/:id updates option text', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/options/${optionAId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { optionText: 'Option A (edited)' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.optionText, 'Option A (edited)');
});

test('PUT /admin/options/:id 404s for an option that does not exist', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/admin/options/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { optionText: 'whatever' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'OPTION_NOT_FOUND');
});

test('GET /questions/:id (student) embeds options WITHOUT isCorrect', async () => {
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/publish`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions/${questionId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.options.length, 2);
  for (const option of body.data.options) {
    assert.equal('isCorrect' in option, false);
  }
});

test('DELETE /admin/options/:id removes an option', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/options/${optionBId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.statusCode, 200);

  const listResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions/${questionId}/options`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listResponse.json().data.length, 1);
});

test('DELETE /admin/options/:id 404s when called again', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/options/${optionBId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'OPTION_NOT_FOUND');
});
