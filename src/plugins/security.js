import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import { env } from '../config/env.js';

export default async function securityPlugins(fastify) {
  await fastify.register(cors, { origin: env.cors.origin });
  await fastify.register(helmet);
  await fastify.register(compress);
}
