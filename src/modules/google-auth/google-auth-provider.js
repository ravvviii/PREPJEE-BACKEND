import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { HTTP_STATUS } from '../../constants/index.js';

let client = null;
const getClient = () => {
  if (!client) client = new OAuth2Client(env.google.clientId);
  return client;
};

// Verifies a Google ID token and returns exactly the claims auth.service.js
// needs. Real verification checks the token's signature against Google's
// public keys and its audience against GOOGLE_CLIENT_ID — there is no
// server-side "test mode" for this (unlike Razorpay), since a valid ID
// token can only come from a real user completing an interactive Google
// consent flow. In test mode, this decodes the token without verifying its
// signature instead — tests construct a plain JWT with whatever claims they
// want to exercise (new user, existing google_id, email linking, ...); the
// cryptographic verification itself is Google's library to trust, not ours
// to re-test — what we test is our own account-linking logic downstream.
export const verifyGoogleIdToken = async (idToken) => {
  if (!env.google.clientId) {
    throw new AppError(
      'Google sign-in is not configured on this server',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      'GOOGLE_AUTH_NOT_CONFIGURED',
    );
  }

  let payload;
  if (env.isTest) {
    payload = jwt.decode(idToken);
  } else {
    // google-auth-library throws its own plain Error for anything malformed
    // (e.g. "Wrong number of segments in token") rather than something we'd
    // want leaking to the client as a raw 500 — normalized to the same
    // clean 401 as the "decoded but missing claims" case below.
    try {
      const ticket = await getClient().verifyIdToken({ idToken, audience: env.google.clientId });
      payload = ticket.getPayload();
    } catch {
      throw new AppError('Invalid Google ID token', HTTP_STATUS.UNAUTHORIZED, 'INVALID_GOOGLE_TOKEN');
    }
  }

  if (!payload?.sub || !payload?.email) {
    throw new AppError('Invalid Google ID token', HTTP_STATUS.UNAUTHORIZED, 'INVALID_GOOGLE_TOKEN');
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name ?? null,
    avatarUrl: payload.picture ?? null,
  };
};
