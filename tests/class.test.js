import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { pool, closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';

const FAKE_ADMIN_ID = '55555555-5555-5555-5555-555555555555';
const adminToken = signAdminAccessToken(FAKE_ADMIN_ID, 'admin');

const TEST_NAME_A = '__P8Test Class A__';
const TEST_NAME_B = '__P8Test Class B__';

let app;

before(async () => {
  app = buildApp();
});

after(async () => {
  await pool.query('DELETE FROM classes WHERE name = ANY($1)', [[TEST_NAME_A, TEST_NAME_B]]);
  await app.close();
  await closeDatabase();
  await closeRedis();
});

test('GET /classes is public and returns the seeded classes', async () => {
  const response = await app.inject({ method: 'GET', url: '/api/v1/classes?limit=50' });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(body.data.items));
  assert.ok(body.data.items.some((c) => c.name === 'Class 11'));
});

test('GET /classes?limit=1 paginates correctly to a different item on page 2', async () => {
  const page1 = await app.inject({ method: 'GET', url: '/api/v1/classes?limit=1' });
  const page1Body = page1.json();

  assert.equal(page1Body.data.items.length, 1);
  assert.ok(page1Body.data.nextCursor);

  const page2 = await app.inject({
    method: 'GET',
    url: `/api/v1/classes?limit=1&cursor=${encodeURIComponent(page1Body.data.nextCursor)}`,
  });
  const page2Body = page2.json();

  assert.equal(page2Body.data.items.length, 1);
  assert.notEqual(page2Body.data.items[0].id, page1Body.data.items[0].id);
});

test('POST /admin/classes rejects a request with no admin token', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/classes',
    payload: { name: TEST_NAME_A },
  });
  assert.equal(response.statusCode, 401);
});

let createdId;

test('POST /admin/classes creates a class', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/classes',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_A },
  });
  const body = response.json();

  assert.equal(response.statusCode, 201);
  assert.equal(body.data.name, TEST_NAME_A);
  createdId = body.data.id;
});

test('POST /admin/classes rejects a duplicate name', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/classes',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_A },
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, 'CLASS_NAME_TAKEN');
});

test('PUT /admin/classes/:id renames a class', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/admin/classes/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: TEST_NAME_B },
  });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.data.name, TEST_NAME_B);
});

test('PUT /admin/classes/:id 404s for a class that does not exist', async () => {
  const response = await app.inject({
    method: 'PUT',
    url: '/api/v1/admin/classes/00000000-0000-0000-0000-000000000000',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: 'whatever' },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'CLASS_NOT_FOUND');
});

test('DELETE /admin/classes/:id soft-deletes, and it disappears from the list', async () => {
  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/classes/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteResponse.statusCode, 200);

  const listResponse = await app.inject({ method: 'GET', url: '/api/v1/classes?limit=50' });
  const stillThere = listResponse.json().data.items.some((c) => c.id === createdId);
  assert.equal(stillThere, false);

  const row = await pool.query('SELECT deleted_at FROM classes WHERE id = $1', [createdId]);
  assert.ok(row.rows[0].deleted_at);
});

test('DELETE /admin/classes/:id 404s when called again on an already-deleted class', async () => {
  const response = await app.inject({
    method: 'DELETE',
    url: `/api/v1/admin/classes/${createdId}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, 'CLASS_NOT_FOUND');
});
