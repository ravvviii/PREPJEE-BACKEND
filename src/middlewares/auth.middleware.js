import { createAuthMiddleware } from './authenticate.js';
import { JWT_PRINCIPAL, JWT_TOKEN_TYPE } from '../constants/index.js';
import { verifyToken } from '../utils/jwt.js';
import { env } from '../config/env.js';

// Verifies a user access token, attaches `request.user = { id }`.
export const requireAuth = createAuthMiddleware(JWT_PRINCIPAL.USER, 'user');

// Public endpoints can use this to enrich responses for signed-in users while
// preserving their public contract. Invalid credentials are ignored here;
// protected endpoints must continue to use requireAuth.
export const optionalAuth = async (request) => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return;

  try {
    const payload = verifyToken(header.slice('Bearer '.length), env.jwt.accessSecret);
    if (payload.tokenType === JWT_TOKEN_TYPE.ACCESS && payload.principal === JWT_PRINCIPAL.USER) {
      request.user = { id: payload.sub };
    }
  } catch {
    // Optional authentication deliberately falls back to the public response.
  }
};
