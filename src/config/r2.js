import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

// R2's API is S3-compatible, so the AWS SDK works against it unmodified —
// just point `endpoint` at Cloudflare instead of AWS.
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
});
