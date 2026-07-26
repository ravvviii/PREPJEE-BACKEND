import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken, signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p12-test-admin@test.local';
const TEST_USER_PHONE = '+911234599012';
const TEST_CHAPTER_NAME = '__P12Test Chapter__';
const TEST_QUESTION_TEXT = '__P12Test Question__';

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
      ['P12 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
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
      `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by, is_published)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
      [physicsId, class11Id, chapterId, TEST_QUESTION_TEXT, adminId],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM solutions WHERE question_id = $1', [questionId]);
  await pool.query('DELETE FROM questions WHERE id = $1', [questionId]);
  await pool.query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST .../solution rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    payload: { explanationText: 'Because F = ma.' },
  });
  assert.equal(response.statusCode, 401);
});

test('POST .../solution 404s for a question that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/questions/00000000-0000-0000-0000-000000000000/solution',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { explanationText: 'x' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test('GET .../solution 404s when no solution has been created yet', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'SOLUTION_NOT_FOUND');
});

test('POST .../solution creates the solution', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { explanationText: 'Because F = ma.' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.explanationText, 'Because F = ma.');
  assert.equal(body.data.questionId, questionId);
});

test('POST .../solution rejects creating a second solution for the same question', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { explanationText: 'A different explanation.' },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'SOLUTION_ALREADY_EXISTS');
});

test('GET .../solution now returns it', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.explanationText, 'Because F = ma.');
});

test('PUT .../solution updates the explanation text', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { explanationText: 'Updated: Because F = ma, and a = F/m.' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.explanationText, 'Updated: Because F = ma, and a = F/m.');
});

test("GET /questions/:id (student) does not include a solution field at all", async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions/${questionId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal('solution' in body.data, false);
});

test('DELETE .../solution removes it', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.statusCode, 200);

  const getResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(getResponse.statusCode, 404);
});

test('DELETE .../solution 404s when called again', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/questions/${questionId}/solution`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'SOLUTION_NOT_FOUND');
});
