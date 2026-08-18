import {
  sendOtp,
  verifyOtp,
  googleLogin,
  register,
  login,
  refresh,
  logout,
} from '../controllers/auth.controller.js';

const phoneSchema = { type: 'string', pattern: '^\\+[1-9]\\d{7,14}$' };
const otpSchema = { type: 'string', pattern: '^\\d{6}$' };
const emailSchema = { type: 'string', format: 'email', maxLength: 254 };
const passwordSchema = { type: 'string', minLength: 8, maxLength: 128 };

export default async function authRoutes(fastify) {
  fastify.post(
    '/auth/send-otp',
    {
      schema: {
        description: 'Send an OTP to a phone number',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: { phone: phoneSchema },
          additionalProperties: false,
        },
      },
    },
    sendOtp,
  );

  fastify.post(
    '/auth/verify-otp',
    {
      schema: {
        description: 'Verify an OTP; creates the user on first login and returns tokens',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'otp'],
          properties: { phone: phoneSchema, otp: otpSchema },
          additionalProperties: false,
        },
      },
    },
    verifyOtp,
  );

  fastify.post(
    '/auth/register',
    {
      schema: {
        description: 'Create a user account with email and password, then return tokens',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: emailSchema,
            password: passwordSchema,
            name: { type: 'string', minLength: 1, maxLength: 120 },
          },
          additionalProperties: false,
        },
      },
    },
    register,
  );

  fastify.post(
    '/auth/login',
    {
      schema: {
        description: 'Sign in with email and password',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: emailSchema,
            password: passwordSchema,
          },
          additionalProperties: false,
        },
      },
    },
    login,
  );

  fastify.post(
    '/auth/google',
    {
      schema: {
        description:
          'Sign in (or sign up) with a Google ID token obtained from the client-side Google Sign-In flow',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['idToken'],
          properties: { idToken: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    googleLogin,
  );

  fastify.post(
    '/auth/refresh',
    {
      schema: {
        description: 'Rotate a refresh token for a new access/refresh token pair',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    refresh,
  );

  fastify.post(
    '/auth/logout',
    {
      schema: {
        description: 'Revoke a refresh token',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
          additionalProperties: false,
        },
      },
    },
    logout,
  );
}
