import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';

// health.controller.js imports the DB/Redis config modules (for /health/ready),
// which open real connections as a side effect of import — close them here so
// this test file's process can exit instead of hanging on open sockets.
after(async () => {
  await closeDatabase();
  await closeRedis();
});

test('GET /health returns the standard success envelope', async () => {
  const app = buildApp();

  const response = await app.inject({ method: 'GET', url: '/health' });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
  assert.equal(body.error, null);

  await app.close();
});

test('GET /health/ready returns 200 with both dependencies ok', async () => {
  const app = buildApp();

  const response = await app.inject({ method: 'GET', url: '/health/ready' });
  const body = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ready');
  assert.equal(body.data.dependencies.database, 'ok');
  assert.equal(body.data.dependencies.redis, 'ok');

  await app.close();
});

test('GET /unknown-route returns a 404 in the standard error envelope', async () => {
  const app = buildApp();

  const response = await app.inject({ method: 'GET', url: '/unknown-route' });
  const body = response.json();

  assert.equal(response.statusCode, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');

  await app.close();
});
