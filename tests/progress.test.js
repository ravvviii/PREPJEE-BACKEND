import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p14-test-admin@test.local';
const TEST_USER_PHONE = '+911234599014';
// Dedicated test-only class so the progressPercent denominator (total
// published questions "in this class") is fully isolated from every other
// test file running concurrently — no shared seeded class involved.
const TEST_CLASS_NAME = '__P14Test Class__';
const TEST_CHAPTER_A_NAME = '__P14Test Chapter A__';
const TEST_CHAPTER_B_NAME = '__P14Test Chapter B__';

let app;
let adminId;
let userId;
let userToken;
let classId;
let chapterAId;
let chapterBId;
let questionA1Id;
let questionA2Id;
let questionB1Id;
let optionA1CorrectId;
let optionB1CorrectId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P14 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
    )
  ).rows[0].id;

  const physicsId = (await pool.query("SELECT id FROM subjects WHERE name = 'Physics'")).rows[0]
    .id;

  classId = (
    await pool.query('INSERT INTO classes (name) VALUES ($1) RETURNING id', [TEST_CLASS_NAME])
  ).rows[0].id;

  userId = (
    await pool.query(
      'INSERT INTO users (phone, class_id) VALUES ($1, $2) RETURNING id',
      [TEST_USER_PHONE, classId],
    )
  ).rows[0].id;
  userToken = signUserAccessToken(userId);

  chapterAId = (
    await pool.query(
      'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
      [physicsId, classId, TEST_CHAPTER_A_NAME],
    )
  ).rows[0].id;
  chapterBId = (
    await pool.query(
      'INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id',
      [physicsId, classId, TEST_CHAPTER_B_NAME],
    )
  ).rows[0].id;

  const createPublishedQuestion = async (chapterIdForQuestion, text) =>
    (
      await pool.query(
        `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by, is_published)
         VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id`,
        [physicsId, classId, chapterIdForQuestion, text, adminId],
      )
    ).rows[0].id;

  questionA1Id = await createPublishedQuestion(chapterAId, '__P14 Q A1__');
  questionA2Id = await createPublishedQuestion(chapterAId, '__P14 Q A2__');
  questionB1Id = await createPublishedQuestion(chapterBId, '__P14 Q B1__');

  const createCorrectOption = async (questionIdForOption) =>
    (
      await pool.query(
        'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, TRUE) RETURNING id',
        [questionIdForOption, 'correct'],
      )
    ).rows[0].id;

  optionA1CorrectId = await createCorrectOption(questionA1Id);
  // Question A2's own option exists (a real question would have one) but is
  // deliberately never selected — that attempt tests the "attempted, not solved" path.
  await createCorrectOption(questionA2Id);
  optionB1CorrectId = await createCorrectOption(questionB1Id);
});

after(async () => {
  await pool.query('DELETE FROM attempts WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM options WHERE question_id = ANY($1)', [
    [questionA1Id, questionA2Id, questionB1Id],
  ]);
  await pool.query('DELETE FROM questions WHERE id = ANY($1)', [
    [questionA1Id, questionA2Id, questionB1Id],
  ]);
  await pool.query('DELETE FROM chapters WHERE id = ANY($1)', [[chapterAId, chapterBId]]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM classes WHERE id = $1', [classId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /progress rejects a request with no token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/progress' });
  assert.equal(response.statusCode, 401);
});

test('GET /progress starts at all zeros with no activity', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/progress',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.solvedQuestionsCount, 0);
  assert.equal(body.data.attemptedQuestionsCount, 0);
  assert.equal(body.data.completedChapters.length, 0);
  assert.equal(body.data.progressPercent, 0);
  assert.equal(body.data.studyHistory.length, 0);
});

test('Attempting one of two questions in a chapter does not complete it yet', async () => {
  await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionA1Id}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: optionA1CorrectId },
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/progress',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(body.data.solvedQuestionsCount, 1);
  assert.equal(body.data.attemptedQuestionsCount, 1);
  assert.equal(
    body.data.completedChapters.some((c) => c.id === chapterAId),
    false,
  );
  // 1 solved out of 3 total published questions in this test class.
  assert.equal(body.data.progressPercent, 33);
});

test('Attempting (even incorrectly) the remaining question completes the chapter', async () => {
  await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionA2Id}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: {}, // no selectedOptionId — counts as an incorrect attempt, still "attempted"
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/progress',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(body.data.attemptedQuestionsCount, 2);
  assert.equal(body.data.solvedQuestionsCount, 1); // A2 was not solved, only attempted
  assert.ok(body.data.completedChapters.some((c) => c.id === chapterAId));
  assert.equal(
    body.data.completedChapters.some((c) => c.id === chapterBId),
    false,
  );
});

test('Solving the question in chapter B completes it too and updates study history', async () => {
  await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${questionB1Id}/attempts`,
    headers: { authorization: `Bearer ${userToken}` },
    payload: { selectedOptionId: optionB1CorrectId },
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/progress',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(body.data.solvedQuestionsCount, 2);
  assert.equal(body.data.attemptedQuestionsCount, 3);
  assert.ok(body.data.completedChapters.some((c) => c.id === chapterBId));
  assert.equal(body.data.progressPercent, 67); // 2 solved / 3 total

  assert.equal(body.data.studyHistory.length, 3);
  // most recent first
  assert.equal(body.data.studyHistory[0].questionId, questionB1Id);
  assert.equal(body.data.studyHistory[0].isCorrect, true);
});
