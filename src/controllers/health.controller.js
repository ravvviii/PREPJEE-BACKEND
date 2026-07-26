import { success, fail } from '../utils/response.js';
import { trackEvent } from '../modules/analytics/index.js';
import { AMPLITUDE_EVENTS, HTTP_STATUS } from '../constants/index.js';
import { checkDatabaseConnection } from '../config/database.js';
import { checkRedisConnection } from '../config/redis.js';
import { checkR2Connection } from '../repositories/storage.repository.js';

export const getHealth = async (_request, reply) => {
  // Fire-and-forget — never await analytics on the request/response path.
  trackEvent(AMPLITUDE_EVENTS.HEALTH_API_CHECK, 'system');

  reply.send(success({ status: 'ok', uptime: process.uptime() }));
};

// Readiness check — actually pings dependencies. Not meant for constant
// infra polling (unlike /health); use for deploy-gating or manual debugging.
export const getHealthReady = async (_request, reply) => {
  const [databaseOk, redisOk, r2Ok] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
    checkR2Connection(),
  ]);

  const dependencies = {
    database: databaseOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
    r2: r2Ok ? 'ok' : 'error',
  };

  if (databaseOk && redisOk && r2Ok) {
    return reply.send(success({ status: 'ready', dependencies }));
  }

  return reply
    .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
    .send(fail('One or more dependencies are unreachable', 'NOT_READY', dependencies));
};
