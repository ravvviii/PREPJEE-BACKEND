import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cached, bumpCacheVersion } from '../src/utils/cache.js';
import { redis, closeRedis } from '../src/config/redis.js';

const NAMESPACE = '__test_namespace__';

// Clears both the version pointer AND every cached value — leftover value
// keys survive their own TTL regardless of the version reset, so a run
// shortly after a previous one (or one that crashed before cleanup) could
// otherwise hit a stale entry from it.
const clearNamespace = async () => {
  const keys = await redis.keys(`cache:${NAMESPACE}:*`);
  if (keys.length > 0) await redis.del(...keys);
};

before(clearNamespace);
after(async () => {
  await clearNamespace();
  await closeRedis();
});

test('cached() only calls fn once for repeated calls with the same key', async () => {
  let callCount = 0;
  const fn = async () => {
    callCount += 1;
    return { value: 'fresh' };
  };

  const first = await cached(NAMESPACE, 'same-key', 60, fn);
  const second = await cached(NAMESPACE, 'same-key', 60, fn);

  assert.equal(callCount, 1);
  assert.deepEqual(first, { value: 'fresh' });
  assert.deepEqual(second, { value: 'fresh' });
});

test('cached() calls fn again for a different key', async () => {
  let callCount = 0;
  const fn = async () => {
    callCount += 1;
    return { value: callCount };
  };

  await cached(NAMESPACE, 'key-a', 60, fn);
  await cached(NAMESPACE, 'key-b', 60, fn);

  assert.equal(callCount, 2);
});

test('bumpCacheVersion() invalidates every previously cached key in that namespace', async () => {
  let callCount = 0;
  const fn = async () => {
    callCount += 1;
    return { value: callCount };
  };

  const before1 = await cached(NAMESPACE, 'invalidation-key', 60, fn);
  const before2 = await cached(NAMESPACE, 'invalidation-key', 60, fn);
  assert.equal(callCount, 1);
  assert.deepEqual(before1, before2);

  await bumpCacheVersion(NAMESPACE);

  const after1 = await cached(NAMESPACE, 'invalidation-key', 60, fn);
  assert.equal(callCount, 2);
  assert.notDeepEqual(after1, before1);
});
