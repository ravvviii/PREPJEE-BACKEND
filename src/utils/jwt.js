import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { JWT_TOKEN_TYPE, JWT_PRINCIPAL } from '../constants/index.js';

export const signUserAccessToken = (userId) =>
  jwt.sign(
    { sub: userId, tokenType: JWT_TOKEN_TYPE.ACCESS, principal: JWT_PRINCIPAL.USER },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry },
  );

// The refresh token is itself a JWT (reusing jsonwebtoken's own duration
// parsing for expiry) but is NEVER trusted on signature alone — the caller
// must also confirm its hash exists, unrevoked, in `refresh_tokens` (see
// auth.service.js). That's what gives us real server-side revocation on top
// of a stateless token.
export const signRefreshToken = (userId) =>
  jwt.sign(
    {
      sub: userId,
      tokenType: JWT_TOKEN_TYPE.REFRESH,
      principal: JWT_PRINCIPAL.USER,
      jti: randomUUID(),
    },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry },
  );

// No refresh/rotation for admins (Phase 4 decision) — a single, longer-lived
// access token; they re-log-in once it expires.
export const signAdminAccessToken = (adminId, role) =>
  jwt.sign(
    { sub: adminId, tokenType: JWT_TOKEN_TYPE.ACCESS, principal: JWT_PRINCIPAL.ADMIN, role },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.adminExpiry },
  );

// algorithms pinned explicitly rather than relying on jsonwebtoken's
// type-based inference — defense in depth against any alg-confusion class
// of attack, regardless of library version.
export const verifyToken = (token, secret) => jwt.verify(token, secret, { algorithms: ['HS256'] });

// exp claim, in ms — used to populate refresh_tokens.expires_at so the DB
// row's lifetime always matches the JWT's own expiry exactly.
export const getTokenExpiryDate = (token) => {
  const decoded = jwt.decode(token);
  return new Date(decoded.exp * 1000);
};
