import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// env.js validates at import time (fail-fast on boot), so exercising its
// production guard means importing it fresh in a child process with a
// specific NODE_ENV — it can't be re-imported with different env vars
// within this process due to ES module caching.
const REQUIRED_ENV = {
  DATABASE_URL: 'postgres://x',
  REDIS_URL: 'redis://x',
  JWT_ACCESS_SECRET: 'x',
  JWT_REFRESH_SECRET: 'x',
  R2_ACCOUNT_ID: 'x',
  R2_ACCESS_KEY_ID: 'x',
  R2_SECRET_ACCESS_KEY: 'x',
  R2_BUCKET_NAME: 'x',
  R2_PUBLIC_URL: 'x',
  RAZORPAY_KEY_ID: 'x',
  RAZORPAY_KEY_SECRET: 'x',
  RAZORPAY_WEBHOOK_SECRET: 'x',
};

const importEnvIn = (extraEnv) =>
  execFileAsync('node', ['-e', "import('./src/config/env.js')"], {
    // Merge onto the real process.env (for PATH etc.) rather than replacing
    // it outright — otherwise the child process may not even locate `node`.
    env: { ...process.env, ...REQUIRED_ENV, ...extraEnv },
  });

test('env.js refuses to boot with a wildcard CORS_ORIGIN in production', async () => {
  await assert.rejects(
    importEnvIn({ NODE_ENV: 'production', CORS_ORIGIN: '*' }),
    (error) => error.stderr.includes('CORS_ORIGIN must not include "*"'),
  );
});

test('env.js boots fine with a specific CORS_ORIGIN in production', async () => {
  await assert.doesNotReject(
    importEnvIn({ NODE_ENV: 'production', CORS_ORIGIN: 'https://prepjee.in' }),
  );
});

test('env.js boots fine with a wildcard CORS_ORIGIN outside production', async () => {
  await assert.doesNotReject(importEnvIn({ NODE_ENV: 'development', CORS_ORIGIN: '*' }));
});

test('env.js accepts a comma-separated CORS_ORIGIN list in production', async () => {
  await assert.doesNotReject(
    importEnvIn({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://prepjee.in,http://localhost:5173',
    }),
  );
});

test('env.js still refuses to boot if "*" is one of several comma-separated origins in production', async () => {
  await assert.rejects(
    importEnvIn({ NODE_ENV: 'production', CORS_ORIGIN: 'https://prepjee.in,*' }),
    (error) => error.stderr.includes('CORS_ORIGIN must not include "*"'),
  );
});
