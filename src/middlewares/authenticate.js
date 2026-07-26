import { verifyToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { fail } from '../utils/response.js';
import { HTTP_STATUS, JWT_TOKEN_TYPE } from '../constants/index.js';

// Shared by both the user and admin auth middlewares — same Bearer-token
// mechanics, differing only in which `principal` claim is required and which
// request property the identity gets attached as.
export const createAuthMiddleware = (principal, attachAs) => async (request, reply) => {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply
      .status(HTTP_STATUS.UNAUTHORIZED)
      .send(fail('Missing or invalid Authorization header', 'UNAUTHORIZED'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyToken(token, env.jwt.accessSecret);
    if (payload.tokenType !== JWT_TOKEN_TYPE.ACCESS || payload.principal !== principal) {
      throw new Error('Unexpected token kind');
    }
    request[attachAs] = { id: payload.sub, role: payload.role };
  } catch {
    return reply
      .status(HTTP_STATUS.UNAUTHORIZED)
      .send(fail('Invalid or expired token', 'UNAUTHORIZED'));
  }
};
