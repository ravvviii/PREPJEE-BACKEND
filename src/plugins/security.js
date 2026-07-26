import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import { env } from '../config/env.js';

async function securityPlugins(fastify) {
  await fastify.register(cors, { origin: env.cors.origin });
  await fastify.register(helmet);
  await fastify.register(compress);
}

// Without fastify-plugin, `app.register(securityPlugins)` creates its own
// isolated encapsulation branch — cors/helmet/compress's hooks would only
// apply within that branch, never reaching any actual route (which live in
// a separate sibling branch via routes/index.js). fastify-plugin makes this
// register directly on the instance it's given instead, so the hooks apply
// everywhere. (Found via a real bug: these headers were silently never
// reaching any response.)
export default fp(securityPlugins);
