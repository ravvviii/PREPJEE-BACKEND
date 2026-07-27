import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';
import { RATE_LIMIT } from '../constants/index.js';

async function securityPlugins(fastify) {
  await fastify.register(cors, { origin: env.cors.origin });
  await fastify.register(helmet);
  // The global response hook currently emits zero-length bodies on the local
  // Node runtime for compressed browser responses. Keep request decompression
  // available, but leave response compression to the deployment proxy/CDN.
  await fastify.register(compress, { globalCompression: false });

  // Baseline, applies to every route unless overridden per-route via
  // `config: { rateLimit: {...} }` (see admin-auth.routes.js for the
  // stricter override on login — the one endpoint with no other brute-force
  // defense, unlike OTP verify which already has its own attempt-count cap).
  await fastify.register(rateLimit, {
    max: RATE_LIMIT.GLOBAL_MAX,
    timeWindow: RATE_LIMIT.GLOBAL_WINDOW_MS,
  });
}

// Without fastify-plugin, `app.register(securityPlugins)` creates its own
// isolated encapsulation branch — cors/helmet/compress's hooks would only
// apply within that branch, never reaching any actual route (which live in
// a separate sibling branch via routes/index.js). fastify-plugin makes this
// register directly on the instance it's given instead, so the hooks apply
// everywhere. (Found via a real bug: these headers were silently never
// reaching any response.)
export default fp(securityPlugins);
