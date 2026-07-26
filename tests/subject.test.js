import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';

const FAKE_ADMIN_ID = '44444444-4444-4444-4444-444444444444';
const adminToken = signAdminAccessToken(FAKE_ADMIN_ID, 'admin');

const TEST_NAME_A = '__P7Test Subject A__';
const TEST_NAME_B = '__P7Test Subject B__';

let app;

before(async () => {
  app = buildApp();
});

after(async () => {
  await pool.query('DELETE FROM subjects WHERE name = ANY($1)', [[TEST_NAME_A, TEST_NAME_B]]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /subjects is public and returns the seeded subjects', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/subjects?limit=50' });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.data.items));
  assert.ok(body.data.items.some((s) => s.name === 'Physics'));
});

test('GET /subjects?limit=1 returns exactly one item and a cursor to the next page', async () => {
  const page1 = await app.inject({ method: 'GET', url: '/api/v1/subjects?limit=1' });
  const page1Body = page1.json();

  assert.equal(page1Body.data.items.length, 1);
  assert.ok(page1Body.data.nextCursor);

  const page2 = await app.inject({
    method: 'GET',
    url: `/api/v1/subjects?limit=1&cursor=${encodeURIComponent(page1Body.data.nextCursor)}`,
  });
  const page2Body = page2.json();

  assert.equal(page2Body.data.items.length, 1);
  assert.notEqual(page2Body.data.items[0].id, page1Body.data.items[0].id);
});

test('POST /admin/subjects rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subjects',
    payload: { name: TEST_NAME_A },
  });
  assert.equal(response.statusCode, 401);
});

let createdId;

test('POST /admin/subjects creates a subject', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subjects',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_A },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.name, TEST_NAME_A);
  createdId = body.data.id;
});

test('POST /admin/subjects rejects a duplicate name', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/subjects',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_A },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'SUBJECT_NAME_TAKEN');
});

test('PUT /admin/subjects/:id renames a subject', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/subjects/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_B },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.name, TEST_NAME_B);
});

test('PUT /admin/subjects/:id 404s for a subject that does not exist', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/admin/subjects/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: 'whatever' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'SUBJECT_NOT_FOUND');
});

test('DELETE /admin/subjects/:id soft-deletes, and it disappears from the list', async () => {
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/subjects/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({ method: 'GET', url: '/api/v1/subjects?limit=50' });
  const stillThere = listResponse.json().data.items.some((s) => s.id === createdId);
  assert.equal(stillThere, false);

  const row = await pool.query('SELECT deleted_at FROM subjects WHERE id = $1', [createdId]);
  assert.ok(row.rows[0].deleted_at);
});

test('DELETE /admin/subjects/:id 404s when called again on an already-deleted subject', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/subjects/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'SUBJECT_NOT_FOUND');
});
