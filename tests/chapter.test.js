import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';

const FAKE_ADMIN_ID = '66666666-6666-6666-6666-666666666666';
const adminToken = signAdminAccessToken(FAKE_ADMIN_ID, 'admin');

const TEST_NAME = '__P9Test Chapter__ Mechanics';
const TEST_NAME_RENAMED = '__P9Test Chapter__ Renamed';
const TEST_SUBJECT_NAME = '__P9Test Subject__';

let app;
let physicsId;
let class11Id;
let otherSubjectId;

before(async () => {
  app = buildApp();

  physicsId = (await pool.query("SELECT id FROM subjects WHERE name = 'Physics'")).rows[0].id;
  class11Id = (await pool.query("SELECT id FROM classes WHERE name = 'Class 11'")).rows[0].id;

  otherSubjectId = (
    await pool.query('INSERT INTO subjects (name) VALUES ($1) RETURNING id', [
      TEST_SUBJECT_NAME,
    ])
  ).rows[0].id;
});

after(async () => {
  await pool.query('DELETE FROM chapters WHERE name IN ($1, $2)', [
    TEST_NAME,
    TEST_NAME_RENAMED,
  ]);
  await pool.query('DELETE FROM subjects WHERE id = $1', [otherSubjectId]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /chapters is public and filters by subjectId', async () => {
  const response = await app.inject({
    method: 'GET',
    url: `/api/v1/chapters?subjectId=${physicsId}&limit=50`,
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(body.data.items.every((c) => c.subjectId === physicsId));
});

test('POST /admin/chapters rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/chapters',
    payload: { subjectId: physicsId, classId: class11Id, name: TEST_NAME },
  });
  assert.equal(response.statusCode, 401);
});

test('POST /admin/chapters rejects a subjectId that does not exist', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/chapters',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      subjectId: '00000000-0000-0000-0000-000000000000',
      classId: class11Id,
      name: TEST_NAME,
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'SUBJECT_NOT_FOUND');
});

let createdId;

test('POST /admin/chapters creates a chapter', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/chapters',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { subjectId: physicsId, classId: class11Id, name: TEST_NAME },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.name, TEST_NAME);
  assert.equal(body.data.subjectId, physicsId);
  createdId = body.data.id;
});

test('POST /admin/chapters rejects the same subject+class+name combination again', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/chapters',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { subjectId: physicsId, classId: class11Id, name: TEST_NAME },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'CHAPTER_NAME_TAKEN');
});

test('POST /admin/chapters allows the same name under a different subject (scoped uniqueness)', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/chapters',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { subjectId: otherSubjectId, classId: class11Id, name: TEST_NAME },
  });

  assert.equal(response.statusCode, 201);

  // clean up this second row too — different subject, same name
  await pool.query('DELETE FROM chapters WHERE subject_id = $1 AND name = $2', [
    otherSubjectId,
    TEST_NAME,
  ]);
});

test('GET /chapters?search= finds the chapter by partial name', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/chapters?search=Mechanics&limit=50',
  });
  const body = response.json();

  assert.ok(body.data.items.some((c) => c.id === createdId));
});

test('PUT /admin/chapters/:id renames a chapter', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/chapters/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_RENAMED },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.name, TEST_NAME_RENAMED);
});

test('PUT /admin/chapters/:id 404s for a chapter that does not exist', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/admin/chapters/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: 'whatever' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'CHAPTER_NOT_FOUND');
});

test('DELETE /admin/chapters/:id soft-deletes, and it disappears from the list', async () => {
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/chapters/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({
    method: 'GET',
    url: `/api/v1/chapters?subjectId=${physicsId}&limit=50`,
  });
  const stillThere = listResponse.json().data.items.some((c) => c.id === createdId);
  assert.equal(stillThere, false);
});

test('DELETE /admin/chapters/:id 404s when called again on an already-deleted chapter', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/chapters/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'CHAPTER_NOT_FOUND');
});
