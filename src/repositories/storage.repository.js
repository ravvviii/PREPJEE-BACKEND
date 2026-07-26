import {
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { r2Client } from '../config/r2.js';
import { env } from '../config/env.js';

export const putObject = async (key, body, contentType) => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

export const deleteObject = async (key) => {
  await r2Client.send(new DeleteObjectCommand({ Bucket: env.r2.bucketName, Key: key }));
};

export const objectExists = async (key) => {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: env.r2.bucketName, Key: key }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') return false;
    throw error;
  }
};

export const checkR2Connection = async () => {
  try {
    await r2Client.send(new HeadBucketCommand({ Bucket: env.r2.bucketName }));
    return true;
  } catch (error) {
    console.error('[R2] Connection check failed', error.message);
    return false;
  }
};
