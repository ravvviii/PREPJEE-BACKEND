import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken, signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p10-test-admin@test.local';
const TEST_USER_PHONE = '+911234599010';
const TEST_CHAPTER_NAME = '__P10Test Chapter__';
const TEST_MISMATCH_CHAPTER_NAME = '__P10Test Mismatch Chapter__';
const TEST_SUBJECT_NAME = '__P10Test Other Subject__';

let app;
let adminId;
let adminToken;
let userId;
let userToken;
let physicsId;
let class11Id;
let chapterId;
let mismatchSubjectId;
let mismatchChapterId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P10 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;
  adminToken = signAdminAccessToken(adminId, 'admin');

  userId = (
    await pool.query('INSERT INTO users (phone) VALUES ($1) RETURNING id', [TEST_USER_PHONE])
  ).rows[0].id;
  userToken = signUserAccessToken(userId);

  physicsId = (await pool.query("SELECT id FROM subjects WHERE name = 'Physics'")).rows[0].id;
  class11Id = (await pool.query("SELECT id FROM classes WHERE name = 'Class 11'")).rows[0].id;

  chapterId = (
    await pool.query(
      'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
      [physicsId, class11Id, TEST_CHAPTER_NAME],
    )
  ).rows[0].id;

  mismatchSubjectId = (
    await pool.query('INSERT INTO subjects (name) VALUES ($1) RETURNING id', [
      TEST_SUBJECT_NAME,
    ])
  ).rows[0].id;
  mismatchChapterId = (
    await pool.query(
      'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
      [mismatchSubjectId, class11Id, TEST_MISMATCH_CHAPTER_NAME],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM questions WHERE created_by = $1', [adminId]);
  await pool.query('DELETE FROM chapters WHERE id = ANY($1)', [[chapterId, mismatchChapterId]]);
  await pool.query('DELETE FROM subjects WHERE id = $1', [mismatchSubjectId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /questions rejects a request with no token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/questions' });
  assert.equal(response.statusCode, 401);
});

test('POST /admin/questions rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/questions',
    payload: { subjectId: physicsId, classId: class11Id, chapterId, questionText: 'q' },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /admin/questions rejects a subjectId that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/questions',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      subjectId: '00000000-0000-0000-0000-000000000000',
      classId: class11Id,
      chapterId,
      questionText: 'q',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'SUBJECT_NOT_FOUND');
});

test("POST /admin/questions rejects a chapter that doesn't belong to the given subject/class", async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/questions',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      subjectId: physicsId,
      classId: class11Id,
      chapterId: mismatchChapterId,
      questionText: 'q',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'CHAPTER_SUBJECT_CLASS_MISMATCH');
});

let questionId;

test('POST /admin/questions creates a draft (unpublished) question', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/questions',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      subjectId: physicsId,
      classId: class11Id,
      chapterId,
      questionText: "What is Newton's second law?",
      difficulty: 'easy',
    },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.isPublished, false);
  assert.equal(body.data.difficulty, 'easy');
  questionId = body.data.id;
});

test('GET /questions (student) does not show the unpublished draft', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions?chapterId=${chapterId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const found = response.json().data.items.some((q) => q.id === questionId);
  assert.equal(found, false);
});

test('GET /admin/questions (admin) shows the unpublished draft', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions?chapterId=${chapterId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const found = response.json().data.items.some((q) => q.id === questionId);
  assert.equal(found, true);
});

test('GET /admin/questions?difficulty=easy filters correctly (enum comparison)', async () => {
  const matching = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions?chapterId=${chapterId}&difficulty=easy`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(matching.statusCode, 200);
  assert.ok(matching.json().data.items.some((q) => q.id === questionId));

  const nonMatching = await app.inject({
    method: 'GET',
    url: `/api/v1/admin/questions?chapterId=${chapterId}&difficulty=hard`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(nonMatching.json().data.items.some((q) => q.id === questionId), false);
});

test('GET /questions/:id (student) 404s on an unpublished question', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions/${questionId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test('POST /admin/questions/:id/publish publishes it', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/publish`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().data.isPublished, true);
});

test('GET /questions/:id (student) now succeeds and fires VIEWED_QUESTION', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions/${questionId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.id, questionId);
  assert.equal(body.data.questionText, "What is Newton's second law?");
});

test('GET /questions (student) now includes the published question', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions?chapterId=${chapterId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const found = response.json().data.items.some((q) => q.id === questionId);
  assert.equal(found, true);
});

test('PUT /admin/questions/:id updates the question text without touching published status', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/questions/${questionId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { questionText: 'Updated question text' },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.questionText, 'Updated question text');
  assert.equal(body.data.isPublished, true);
});

test('POST /admin/questions/:id/unpublish hides it again', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${questionId}/unpublish`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.json().data.isPublished, false);

  const studentResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/questions/${questionId}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(studentResponse.statusCode, 404);
});

test('DELETE /admin/questions/:id soft-deletes it', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/questions/${questionId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.statusCode, 200);

  const row = await pool.query('SELECT deleted_at FROM questions WHERE id = $1', [questionId]);
  assert.ok(row.rows[0].deleted_at);
});

test('DELETE /admin/questions/:id 404s when called again', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/questions/${questionId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});
