import 'dotenv/config';

const NODE_ENVS = ['development', 'test', 'production'];

const readRequired = (key) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const readOptional = (key, fallback = undefined) => {
  const value = process.env[key];
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

export const env = {
  nodeEnv,
  isDev: nodeEnv === 'development',
  isProd: nodeEnv === 'production',
  port,

  cors: {
    origin: readOptional('CORS_ORIGIN', '*'),
  },

  amplitude: {
    apiKey: readOptional('AMPLITUDE_API_KEY'),
    appVersion: readOptional('APP_VERSION', '1.0.0'),
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

  // Phase 5 onward.
  r2: {
    accountId: readOptional('R2_ACCOUNT_ID'),
    accessKeyId: readOptional('R2_ACCESS_KEY_ID'),
    secretAccessKey: readOptional('R2_SECRET_ACCESS_KEY'),
    bucketName: readOptional('R2_BUCKET_NAME'),
    publicUrl: readOptional('R2_PUBLIC_URL'),
  },

  // Phase 16 onward.
  razorpay: {
    keyId: readOptional('RAZORPAY_KEY_ID'),
    keySecret: readOptional('RAZORPAY_KEY_SECRET'),
    webhookSecret: readOptional('RAZORPAY_WEBHOOK_SECRET'),
  },
};

// Exported so a later phase can do `requireEnv(['DATABASE_URL', 'REDIS_URL'])`
// at its own startup instead of hardcoding another ad-hoc check.
export const requireEnv = (keys) => keys.forEach(readRequired);
