import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import FormData from 'form-data';
import { buildApp } from '../src/app.js';
import { closeDatabase } from '../src/config/database.js';
import { closeRedis } from '../src/config/redis.js';
import * as storageService from '../src/services/storage.service.js';
import * as storageRepository from '../src/repositories/storage.repository.js';
import { signAdminAccessToken } from '../src/utils/jwt.js';
import { UPLOAD } from '../src/constants/index.js';

const FAKE_ADMIN_ID = '33333333-3333-3333-3333-333333333333';
const adminToken = signAdminAccessToken(FAKE_ADMIN_ID, 'admin');

const createdKeys = [];

after(async () => {
  await Promise.all(createdKeys.map((key) => storageService.deleteImage(key).catch(() => {})));
  await closeDatabase();
  await closeRedis();
});

test('storageService.uploadImage rejects an unsupported mime type', async () => {
  await assert.rejects(
    storageService.uploadImage({ buffer: Buffer.from('x'), mimeType: 'application/pdf' }),
    (error) => error.code === 'UNSUPPORTED_FILE_TYPE',
  );
});

test('storageService.uploadImage rejects an oversized file', async () => {
  const oversized = Buffer.alloc(UPLOAD.MAX_FILE_SIZE_BYTES + 1);
  await assert.rejects(
    storageService.uploadImage({ buffer: oversized, mimeType: 'image/png' }),
    (error) => error.code === 'FILE_TOO_LARGE',
  );
});

test('storageService.uploadImage falls back to the misc folder for an unknown folder', async () => {
  const { key, url } = await storageService.uploadImage({
    buffer: Buffer.from('fake-image-bytes'),
    mimeType: 'image/png',
    folder: 'not-a-real-folder',
  });
  createdKeys.push(key);

  assert.match(key, /^misc\//);
  assert.equal(url, `${process.env.R2_PUBLIC_URL}/${key}`);
  assert.equal(await storageRepository.objectExists(key), true);
});

test('storageService.deleteImage actually removes the object from R2', async () => {
  const { key } = await storageService.uploadImage({
    buffer: Buffer.from('fake-image-bytes'),
    mimeType: 'image/jpeg',
    folder: UPLOAD.FOLDERS.QUESTIONS,
  });

  assert.equal(await storageRepository.objectExists(key), true);
  await storageService.deleteImage(key);
  assert.equal(await storageRepository.objectExists(key), false);
});

test('POST /api/v1/uploads/image rejects a request with no admin token', async () => {
  const app = buildApp();
  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'test.png',
    contentType: 'image/png',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/uploads/image',
    payload: form.getBuffer(),
    headers: form.getHeaders(),
  });

  assert.equal(response.statusCode, 401);
  await app.close();
});

test('POST /api/v1/uploads/image uploads a real file end-to-end, DELETE removes it', async () => {
  const app = buildApp();
  const form = new FormData();
  form.append('file', Buffer.from('fake-image-bytes'), {
    filename: 'test.png',
    contentType: 'image/png',
  });
  form.append('folder', UPLOAD.FOLDERS.PROFILES);

  const uploadResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/uploads/image',
    payload: form.getBuffer(),
    headers: { ...form.getHeaders(), authorization: `Bearer ${adminToken}` },
  });
  const uploadBody = uploadResponse.json();

  assert.equal(uploadResponse.statusCode, 200);
  assert.match(uploadBody.data.key, /^profiles\//);
  assert.equal(await storageRepository.objectExists(uploadBody.data.key), true);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: '/api/v1/uploads/image',
    payload: { key: uploadBody.data.key },
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(await storageRepository.objectExists(uploadBody.data.key), false);

  await app.close();
});
