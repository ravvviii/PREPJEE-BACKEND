import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signUserAccessToken } from '../src/utils/jwt.js';
import * as progressRepository from '../src/repositories/progress.repository.js';

const TEST_ADMIN_EMAIL = 'p13-test-admin@test.local';
const TEST_USER_PHONE = '+911234599013';
const TEST_CHAPTER_NAME = '__P13Test Chapter__';

let app;
let adminId;
let userId;
let userToken;
let chapterId;
let questionId; // published, 2 options, has a solution
let correctOptionId;
let wrongOptionId;
let draftQuestionId; // unpublished
let otherQuestionId; // published, used only to hold a "foreign" option
let foreignOptionId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P13 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;

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
      [physicsId, class11Id, chapterId, '__P13Test Question__', adminId],
    )
  ).rows[0].id;

  correctOptionId = (
    await pool.query(
      'INSERT INTO options (question_id, option_text, is_correct, order_index) VALUES ($1, $2, TRUE, 0) RETURNING id',
      [questionId, '9.8'],
    )
  ).rows[0].id;

  wrongOptionId = (
    await pool.query(
      'INSERT INTO options (question_id, option_text, is_correct, order_index) VALUES ($1, $2, FALSE, 1) RETURNING id',
      [questionId, '4'],
    )
  ).rows[0].id;

  await pool.query(
    'INSERT INTO solutions (question_id, explanation_text) VALUES ($1, $2)',
    [questionId, 'Acceleration due to gravity is 9.8 m/s^2.'],
  );

  draftQuestionId = (
    await pool.query(
      `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by, is_published)
       VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
      [physicsId, class11Id, chapterId, '__P13Test Draft Question__', adminId],
    )
  ).rows[0].id;

  otherQuestionId = (
    await pool.query(
      `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by, is_published)
       VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
      [physicsId, class11Id, chapterId, '__P13Test Other Question__', adminId],
    )
  ).rows[0].id;

  foreignOptionId = (
    await pool.query(
      'INSERT INTO options (question_id, option_text, is_correct, order_index) VALUES ($1, $2, TRUE, 0) RETURNING id',
      [otherQuestionId, 'Foreign option'],
    )
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM attempts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM solutions WHERE question_id = $1', [questionId]);
  await pool.query('DELETE FROM options WHERE question_id = ANY($1)', [
    [questionId, otherQuestionId],
  ]);
  await pool.query('DELETE FROM questions WHERE id = ANY($1)', [
    [questionId, draftQuestionId, otherQuestionId],
  ]);
  await pool.query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /questions/:id/attempts rejects a request with no token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionId}/attempts`,
    payload: { selectedOptionId: correctOptionId },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /questions/:id/attempts 404s for a question that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/questions/00000000-0000-0000-0000-000000000000/attempts',
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: correctOptionId },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test('POST /questions/:id/attempts 404s for an unpublished (draft) question', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${draftQuestionId}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: {},
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test('POST /questions/:id/attempts rejects an option belonging to a different question', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionId}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: foreignOptionId },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'OPTION_QUESTION_MISMATCH');
});

test('POST /questions/:id/attempts with the correct option returns isCorrect true + the explanation', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionId}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: correctOptionId, timeTakenSeconds: 12 },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.isCorrect, true);
  assert.ok(body.data.correctOptionIds.includes(correctOptionId));
  assert.equal(
    body.data.explanation.explanationText,
    'Acceleration due to gravity is 9.8 m/s^2.',
  );
});

test('POST /questions/:id/attempts with the wrong option returns isCorrect false', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionId}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: wrongOptionId },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.isCorrect, false);
});

test('POST /questions/:id/attempts with no selectedOptionId counts as incorrect', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionId}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: {},
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().data.isCorrect, false);
});

test('GET /questions/:id/accuracy reflects all 3 attempts (1 correct)', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/questions/${questionId}/accuracy`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.totalAttempts, 3);
  assert.equal(body.data.correctAttempts, 1);
  assert.equal(body.data.accuracyPercent, 33);
});

test('GET /questions/:id/accuracy 404s for a question that does not exist', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/questions/00000000-0000-0000-0000-000000000000/accuracy',
    headers: { authorization: `Bearer ${userToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test("GET /chapters/:id/accuracy reflects the same user's accuracy within that chapter", async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/chapters/${chapterId}/accuracy`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.totalAttempts, 3);
  assert.equal(body.data.correctAttempts, 1);
});

test('GET /chapters/:id/accuracy rejects a request with no token', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/chapters/${chapterId}/accuracy`,
  });
  assert.equal(response.statusCode, 401);
});

test('chapter is not yet complete after attempting only one of its two published questions', async () => {
  const complete = await progressRepository.isChapterComplete(userId, chapterId);
  assert.equal(complete, false);
});

test('POST /questions/:id/attempts on the chapter\'s last unattempted published question completes it', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${otherQuestionId}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: foreignOptionId },
  });
  assert.equal(response.statusCode, 201);

  const complete = await progressRepository.isChapterComplete(userId, chapterId);
  assert.equal(complete, true);
});

test('GET /chapters/:id/accuracy 404s for a chapter that does not exist', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/chapters/00000000-0000-0000-0000-000000000000/accuracy',
    headers: { authorization: `Bearer ${userToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'CHAPTER_NOT_FOUND');
});
