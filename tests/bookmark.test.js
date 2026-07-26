import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken, signUserAccessToken } from '../src/utils/jwt.js';

const TEST_ADMIN_EMAIL = 'p15-test-admin@test.local';
const TEST_USER_PHONE = '+911234599015';
const TEST_CHAPTER_NAME = '__P15Test Chapter__';

let app;
let adminId;
let adminToken;
let userId;
let userToken;
let chapterId;
let question1Id;
let question2Id;
let draftQuestionId;

before(async () => {
  app = buildApp();

  adminId = (
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['P15 Test Admin', TEST_ADMIN_EMAIL, 'hash'],
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

  const createQuestion = async (text, isPublished) =>
    (
      await pool.query(
        `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by, is_published)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [physicsId, class11Id, chapterId, text, adminId, isPublished],
      )
    ).rows[0].id;

  question1Id = await createQuestion('__P15 Q1__', true);
  question2Id = await createQuestion('__P15 Q2__', true);
  draftQuestionId = await createQuestion('__P15 Draft Q__', false);
});

after(async () => {
  await pool.query('DELETE FROM bookmarks WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM questions WHERE id = ANY($1)', [
    [question1Id, question2Id, draftQuestionId],
  ]);
  await pool.query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.query('DELETE FROM admins WHERE id = $1', [adminId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('POST /questions/:id/bookmark rejects a request with no token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${question1Id}/bookmark`,
  });
  assert.equal(response.statusCode, 401);
});

test('POST /questions/:id/bookmark 404s for a question that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/questions/00000000-0000-0000-0000-000000000000/bookmark',
    headers: { authorization: `Bearer ${userToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test('POST /questions/:id/bookmark 404s for an unpublished (draft) question', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${draftQuestionId}/bookmark`,
    headers: { authorization: `Bearer ${userToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'QUESTION_NOT_FOUND');
});

test('POST /questions/:id/bookmark bookmarks a published question', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${question1Id}/bookmark`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(response.statusCode, 200);
});

test('POST /questions/:id/bookmark is idempotent — bookmarking twice creates only one row', async () => {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${question1Id}/bookmark`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(response.statusCode, 200);

  const row = await pool.query(
    'SELECT COUNT(*)::int AS count FROM bookmarks WHERE user_id = $1 AND question_id = $2',
    [userId, question1Id],
  );
  assert.equal(row.rows[0].count, 1);
});

test('GET /bookmarks includes the bookmarked question', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/bookmarks?limit=50',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(body.data.items.some((item) => item.questionId === question1Id));
});

test('GET /bookmarks paginates correctly across two bookmarks', async () => {
  await app.inject({
    method: 'POST',
    url: `/api/v1/questions/${question2Id}/bookmark`,
    headers: { authorization: `Bearer ${userToken}` },
  });

  const page1 = await app.inject({
    method: 'GET',
    url: '/api/v1/bookmarks?limit=1',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const page1Body = page1.json();
  assert.equal(page1Body.data.items.length, 1);
  assert.ok(page1Body.data.nextCursor);

  const page2 = await app.inject({
    method: 'GET',
    url: `/api/v1/bookmarks?limit=1&cursor=${encodeURIComponent(page1Body.data.nextCursor)}`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  const page2Body = page2.json();
  assert.equal(page2Body.data.items.length, 1);
  assert.notEqual(page2Body.data.items[0].questionId, page1Body.data.items[0].questionId);
});

test('A bookmark disappears from the list once the question is unpublished', async () => {
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${question2Id}/unpublish`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/bookmarks?limit=50',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const stillThere = response.json().data.items.some((item) => item.questionId === question2Id);
  assert.equal(stillThere, false);

  // republish so it doesn't affect anything else, and re-bookmark cleanup is simpler
  await app.inject({
    method: 'POST',
    url: `/api/v1/admin/questions/${question2Id}/publish`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
});

test('DELETE /questions/:id/bookmark removes it, and it disappears from the list', async () => {
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/questions/${question1Id}/bookmark`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/bookmarks?limit=50',
    headers: { authorization: `Bearer ${userToken}` },
  });
  const stillThere = listResponse.json().data.items.some((item) => item.questionId === question1Id);
  assert.equal(stillThere, false);
});

test('DELETE /questions/:id/bookmark is idempotent — removing an already-removed bookmark still succeeds', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/questions/${question1Id}/bookmark`,
    headers: { authorization: `Bearer ${userToken}` },
  });
  assert.equal(response.statusCode, 200);
});

test('GET /bookmarks rejects a request with no token', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/bookmarks' });
  assert.equal(response.statusCode, 401);
});
