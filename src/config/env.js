import 'dotenv/config';

const NODE_ENVS = ['development', 'test', 'production'];

// Trimmed defensively — a stray leading/trailing space pasted into .env
// (easy to do by accident) would otherwise silently break credential auth.
const readRequired = (key) => {
  const value = process.env[key]?.trim();
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const readOptional = (key, fallback = undefined) => {
  const value = process.env[key]?.trim();
  return value === undefined || value === '' ? fallback : value;
};

const nodeEnv = readOptional('NODE_ENV', 'development');
if (!NODE_ENVS.includes(nodeEnv)) {
  throw new Error(`NODE_ENV must be one of ${NODE_ENVS.join(', ')}, got "${nodeEnv}"`);
}

const port = Number(readOptional('PORT', 4000));
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer, got "${process.env.PORT}"`);
}

const isProd = nodeEnv === 'production';
const internalApiKey = readOptional('INTERNAL_API_KEY');
if (internalApiKey && internalApiKey.length < 32) {
  throw new Error('INTERNAL_API_KEY must be at least 32 characters when configured');
}

// Comma-separated so more than one frontend origin can be trusted at once —
// e.g. the real production frontend AND a developer's local dev server
// while it isn't deployed yet. @fastify/cors accepts an array directly.
const corsOrigins = readOptional('CORS_ORIGIN', '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// A wildcard origin in production would let any website make authenticated
// cross-origin requests on a logged-in user's behalf — fine for local dev,
// never fine once this is reachable from the public internet.
if (isProd && corsOrigins.includes('*')) {
  throw new Error('CORS_ORIGIN must not include "*" when NODE_ENV=production');
}

export const env = {
  nodeEnv,
  isDev: nodeEnv === 'development',
  isProd,
  isTest: nodeEnv === 'test',
  port,

  cors: {
    // Always an array — @fastify/cors normalizes an array containing '*'
    // back to true wildcard-allow-all internally, so this doesn't change
    // local dev's default behavior.
    origin: corsOrigins,
  },

  amplitude: {
    apiKey: readOptional('AMPLITUDE_API_KEY'),
    appVersion: readOptional('APP_VERSION', '1.0.0'),
  },

  internal: {
    apiKey: internalApiKey,
  },

  database: {
    url: readRequired('DATABASE_URL'),
  },
  redis: {
    url: readRequired('REDIS_URL'),
  },

  jwt: {
    accessSecret: readRequired('JWT_ACCESS_SECRET'),
    refreshSecret: readRequired('JWT_REFRESH_SECRET'),
    accessExpiry: readOptional('JWT_ACCESS_EXPIRY', '15m'),
    refreshExpiry: readOptional('JWT_REFRESH_EXPIRY', '30d'),
    // Admins re-log-in instead of refreshing — no rotation, so a longer expiry.
    adminExpiry: readOptional('ADMIN_JWT_EXPIRY', '12h'),
  },
  google: {
    clientId: readOptional('GOOGLE_CLIENT_ID'),
  },

  r2: {
    accountId: readRequired('R2_ACCOUNT_ID'),
    accessKeyId: readRequired('R2_ACCESS_KEY_ID'),
    secretAccessKey: readRequired('R2_SECRET_ACCESS_KEY'),
    bucketName: readRequired('R2_BUCKET_NAME'),
    publicUrl: readRequired('R2_PUBLIC_URL'),
  },

  razorpay: {
    keyId: readRequired('RAZORPAY_KEY_ID'),
    keySecret: readRequired('RAZORPAY_KEY_SECRET'),
    webhookSecret: readRequired('RAZORPAY_WEBHOOK_SECRET'),
  },
};

// Exported so a later phase can do `requireEnv(['DATABASE_URL', 'REDIS_URL'])`
// at its own startup instead of hardcoding another ad-hoc check.
export const requireEnv = (keys) => keys.forEach(readRequired);
