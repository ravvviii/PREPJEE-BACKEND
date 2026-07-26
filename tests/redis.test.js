import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { checkRedisConnection, closeRedis } from '../src/config/redis.js';

after(async () => {
  await closeRedis();
});

test('redis connection responds to PING against a real Redis instance', async () => {
  assert.equal(await checkRedisConnection(), true);
});
