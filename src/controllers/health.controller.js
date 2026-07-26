import { success } from '../utils/response.js';
import { trackEvent } from '../modules/analytics/index.js';
import { AMPLITUDE_EVENTS } from '../constants/index.js';

export const getHealth = async (_request, reply) => {
  // Fire-and-forget — never await analytics on the request/response path.
  trackEvent(AMPLITUDE_EVENTS.HEALTH_API_CHECK, 'system');

  reply.send(success({ status: 'ok', uptime: process.uptime() }));
};
