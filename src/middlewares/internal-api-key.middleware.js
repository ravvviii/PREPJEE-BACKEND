import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { HTTP_STATUS } from '../constants/index.js';

const digest = (value) => createHash('sha256').update(value).digest();

export const requireInternalApiKey = async (request) => {
  if (!env.internal.apiKey) {
    throw new AppError(
      'Internal API is not configured',
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      'INTERNAL_API_NOT_CONFIGURED',
    );
  }

  const supplied = request.headers['x-internal-api-key'];
  const valid =
    typeof supplied === 'string' &&
    timingSafeEqual(digest(supplied), digest(env.internal.apiKey));

  if (!valid) {
    throw new AppError(
      'Invalid internal API key',
      HTTP_STATUS.UNAUTHORIZED,
      'INVALID_INTERNAL_API_KEY',
    );
  }
};
