import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

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

test('GET /unknown-route returns a 404 in the standard error envelope', async () => {
  const app = buildApp();

  const response = await app.inject({ method: 'GET', url: '/unknown-route' });
  const body = response.json();

  assert.equal(response.statusCode, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'NOT_FOUND');

  await app.close();
});
