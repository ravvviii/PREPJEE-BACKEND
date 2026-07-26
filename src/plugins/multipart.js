import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import { UPLOAD } from '../constants/index.js';

async function multipartPlugin(fastify) {
  await fastify.register(multipart, {
    limits: { fileSize: UPLOAD.MAX_FILE_SIZE_BYTES },
  });
}

// Same reasoning as security.js — without fastify-plugin, the content-type
// parser @fastify/multipart registers would be scoped to an isolated branch
// and never reach the actual upload routes (this was the exact bug behind
// the 415 "Unsupported Media Type" error).
export default fp(multipartPlugin);
