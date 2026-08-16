import { forgotPassword, login, resetPassword } from '../controllers/admin-auth.controller.js';
import { RATE_LIMIT } from '../constants/index.js';

export default async function adminAuthRoutes(fastify) {
  fastify.post(
    '/admin/auth/login',
    {
      // Tighter than the global default, and keyed by the attempted email
      // (falling back to IP if the body failed to parse) so credential
      // stuffing spread across many IPs against one account still gets
      // caught, not just a single-IP flood. hook: 'preHandler' is required
      // here — the plugin's default 'onRequest' hook runs before body
      // parsing, so keyGenerator would only ever see request.body as
      // undefined and silently fall back to IP-only keying.
      config: {
        rateLimit: {
          max: RATE_LIMIT.ADMIN_LOGIN_MAX,
          timeWindow: RATE_LIMIT.ADMIN_LOGIN_WINDOW_MS,
          hook: 'preHandler',
          keyGenerator: (request) => request.body?.email ?? request.ip,
        },
      },
      schema: {
        description: 'Admin login with email + password',
        tags: ['admin-auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
          additionalProperties: false,
        },
      },
    },
    login,
  );

  fastify.post(
    '/admin/auth/forgot-password',
    {
      config: {
        rateLimit: {
          max: RATE_LIMIT.PASSWORD_RESET_MAX,
          timeWindow: RATE_LIMIT.PASSWORD_RESET_WINDOW_MS,
          hook: 'preHandler',
          keyGenerator: (request) => request.body?.email ?? request.ip,
        },
      },
      schema: {
        description: 'Request password-reset instructions for an admin or super admin',
        tags: ['admin-auth'],
        body: {
          type: 'object',
          required: ['email'],
          properties: { email: { type: 'string', format: 'email', maxLength: 254 } },
          additionalProperties: false,
        },
      },
    },
    forgotPassword,
  );

  fastify.post(
    '/admin/auth/reset-password',
    {
      schema: {
        description: 'Set a new password using a one-time password-reset token',
        tags: ['admin-auth'],
        body: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: { type: 'string', minLength: 64, maxLength: 64 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
          },
          additionalProperties: false,
        },
      },
    },
    resetPassword,
  );
}
