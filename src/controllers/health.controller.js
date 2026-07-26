import { success, fail } from '../utils/response.js';
import { trackEvent } from '../modules/analytics/index.js';
import { AMPLITUDE_EVENTS, HTTP_STATUS } from '../constants/index.js';
import { checkDatabaseConnection } from '../config/database.js';
import { checkRedisConnection } from '../config/redis.js';

export const getHealth = async (_request, reply) => {
  // Fire-and-forget — never await analytics on the request/response path.
  trackEvent(AMPLITUDE_EVENTS.HEALTH_API_CHECK, 'system');

  reply.send(success({ status: 'ok', uptime: process.uptime() }));
};

// Readiness check — actually pings dependencies. Not meant for constant
// infra polling (unlike /health); use for deploy-gating or manual debugging.
export const getHealthReady = async (_request, reply) => {
  const [databaseOk, redisOk] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ]);

  const dependencies = {
    database: databaseOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
  };

  if (databaseOk && redisOk) {
    return reply.send(success({ status: 'ready', dependencies }));
  }

  return reply
    .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
    .send(fail('One or more dependencies are unreachable', 'NOT_READY', dependencies));
};
