import { redis } from '../config/redis.js';

const versionKey = (namespace) => `cache:${namespace}:version`;

// Bumping the version makes every previously cached key for this namespace
// unreachable at once — no Redis SCAN/KEYS sweep needed to invalidate.
// Stale entries aren't deleted, just orphaned; they self-clean via TTL.
export const bumpCacheVersion = async (namespace) => {
  await redis.incr(versionKey(namespace));
};

// Cache-aside: returns the cached value on a hit; on a miss, calls `fn`,
// caches its result under the current version, and returns it.
export const cached = async (namespace, cacheKeyParts, ttlSeconds, fn) => {
  const version = (await redis.get(versionKey(namespace))) ?? '0';
  const key = `cache:${namespace}:v${version}:${cacheKeyParts}`;

  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  const result = await fn();
  await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
  return result;
};
