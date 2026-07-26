import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (error) => {
  console.error('[Redis] Connection error', error.message);
});

export const checkRedisConnection = async () => {
  try {
    const response = await redis.ping();
    return response === 'PONG';
  } catch (error) {
    console.error('[Redis] Connection check failed', error.message);
    return false;
  }
};

export const closeRedis = () => redis.quit();
