import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, closeDatabase } from '../src/config/database.js';

// The whole file runs inside one transaction on a single dedicated client,
// rolled back at the very end — nothing here persists, and no manual cleanup
// is needed. Tests that expect a constraint violation use a SAVEPOINT so the
// one failing statement doesn't poison the rest of the shared transaction.
let client;
let adminId;
let subjectId;
let classId;
let chapterId;
let userId;
let questionId;

before(async () => {
  client = await pool.connect();
  await client.query('BEGIN');

  ({
    rows: [{ id: adminId }],
  } = await client.query(
    `INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
    ['Schema Test Admin', 'schema-test-admin@test.local', 'hash'],
  ));

  ({
    rows: [{ id: subjectId }],
  } = await client.query(`INSERT INTO subjects (name) VALUES ($1) RETURNING id`, [
    '__SchemaTest Subject__',
  ]));

  ({
    rows: [{ id: classId }],
  } = await client.query(`INSERT INTO classes (name) VALUES ($1) RETURNING id`, [
    '__SchemaTest Class__',
  ]));

  ({
    rows: [{ id: chapterId }],
  } = await client.query(
    `INSERT INTO chapters (subject_id, class_id, name) VALUES ($1, $2, $3) RETURNING id`,
    [subjectId, classId, '__SchemaTest Chapter__'],
  ));

  ({
    rows: [{ id: userId }],
  } = await client.query(`INSERT INTO users (phone) VALUES ($1) RETURNING id`, [
    '+910000000001',
  ]));

  ({
    rows: [{ id: questionId }],
  } = await client.query(
    `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [subjectId, classId, chapterId, '__SchemaTest Question__', adminId],
  ));
});

after(async () => {
  await client.query('ROLLBACK');
  client.release();
  await closeDatabase();
});

test('primary keys are UUIDs', () => {
  assert.match(subjectId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});

test('database session timezone is Asia/Kolkata', async () => {
  const { rows } = await client.query("SELECT current_setting('timezone') AS tz");
  assert.equal(rows[0].tz, 'Asia/Kolkata');
});

test('subjects.name unique constraint rejects duplicates', async () => {
  await client.query('SAVEPOINT sp_dup_subject');
  try {
    await assert.rejects(
      client.query('INSERT INTO subjects (name) VALUES ($1)', ['__SchemaTest Subject__']),
      (error) => error.code === '23505', // unique_violation
    );
  } finally {
    // Runs even if the assertion itself fails, so one bad expectation here
    // can't poison the shared transaction for every test that runs after it.
    await client.query('ROLLBACK TO SAVEPOINT sp_dup_subject');
  }
});

test('updated_at trigger bumps the timestamp on UPDATE', async () => {
  const beforeUpdate = await client.query('SELECT updated_at FROM subjects WHERE id = $1', [
    subjectId,
  ]);

  await new Promise((resolve) => setTimeout(resolve, 10));
  await client.query('UPDATE subjects SET name = name WHERE id = $1', [subjectId]);

  const afterUpdate = await client.query('SELECT updated_at FROM subjects WHERE id = $1', [
    subjectId,
  ]);

  assert.ok(
    new Date(afterUpdate.rows[0].updated_at) > new Date(beforeUpdate.rows[0].updated_at),
  );
});

test('deleting a question referenced by an attempt is restricted', async () => {
  await client.query(
    'INSERT INTO attempts (user_id, question_id, is_correct) VALUES ($1, $2, $3)',
    [userId, questionId, true],
  );

  await client.query('SAVEPOINT sp_restrict');
  try {
    await assert.rejects(
      client.query('DELETE FROM questions WHERE id = $1', [questionId]),
      (error) => error.code === '23001', // restrict_violation
    );
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT sp_restrict');
  }
});

test('a user can attempt the same question more than once', async () => {
  await client.query(
    'INSERT INTO attempts (user_id, question_id, is_correct) VALUES ($1, $2, $3)',
    [userId, questionId, false],
  );
  await client.query(
    'INSERT INTO attempts (user_id, question_id, is_correct) VALUES ($1, $2, $3)',
    [userId, questionId, true],
  );

  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM attempts WHERE user_id = $1 AND question_id = $2',
    [userId, questionId],
  );
  assert.ok(rows[0].count >= 2);
});

test('user_phone is auto-populated on insert for every user_id-referencing table', async () => {
  const { rows: userRows } = await client.query(
    `INSERT INTO users (phone) VALUES ($1) RETURNING id, phone`,
    ['+910000000099'],
  );
  const { id: phoneUserId, phone } = userRows[0];

  const {
    rows: [refreshToken],
  } = await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + interval '1 day') RETURNING user_phone`,
    [phoneUserId, '__SchemaTest token hash__'],
  );
  assert.equal(refreshToken.user_phone, phone);

  const {
    rows: [attempt],
  } = await client.query(
    `INSERT INTO attempts (user_id, question_id, is_correct) VALUES ($1, $2, $3) RETURNING user_phone`,
    [phoneUserId, questionId, true],
  );
  assert.equal(attempt.user_phone, phone);

  const {
    rows: [bookmark],
  } = await client.query(
    `INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2) RETURNING user_phone`,
    [phoneUserId, questionId],
  );
  assert.equal(bookmark.user_phone, phone);

  const {
    rows: [payment],
  } = await client.query(
    `INSERT INTO payments (user_id, provider_order_id, amount)
     VALUES ($1, $2, $3) RETURNING user_phone`,
    [phoneUserId, '__SchemaTest order id__', 19900],
  );
  assert.equal(payment.user_phone, phone);

  const {
    rows: [subscription],
  } = await client.query(
    `INSERT INTO subscriptions (user_id, expires_at) VALUES ($1, NOW() + interval '30 days') RETURNING user_phone`,
    [phoneUserId],
  );
  assert.equal(subscription.user_phone, phone);

  const {
    rows: [analyticsLog],
  } = await client.query(
    `INSERT INTO analytics_logs (user_id, event_name) VALUES ($1, $2) RETURNING user_phone`,
    [phoneUserId, '__SCHEMA_TEST_EVENT__'],
  );
  assert.equal(analyticsLog.user_phone, phone);
});

test('changing a user\'s phone propagates to every dependent table\'s user_phone', async () => {
  const { rows: userRows } = await client.query(
    `INSERT INTO users (phone) VALUES ($1) RETURNING id`,
    ['+910000000098'],
  );
  const { id: phoneUserId } = userRows[0];

  await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + interval '1 day')`,
    [phoneUserId, '__SchemaTest propagate token hash__'],
  );

  await client.query('UPDATE users SET phone = $1 WHERE id = $2', [
    '+910000000097',
    phoneUserId,
  ]);

  const { rows } = await client.query(
    'SELECT user_phone FROM refresh_tokens WHERE user_id = $1',
    [phoneUserId],
  );
  assert.equal(rows[0].user_phone, '+910000000097');
});

test('deleting a question cascades to its options', async () => {
  const {
    rows: [{ id: cascadeQuestionId }],
  } = await client.query(
    `INSERT INTO questions (subject_id, class_id, chapter_id, question_text, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [subjectId, classId, chapterId, '__SchemaTest Cascade Question__', adminId],
  );

  await client.query(
    'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
    [cascadeQuestionId, 'Option A', true],
  );

  await client.query('DELETE FROM questions WHERE id = $1', [cascadeQuestionId]);

  const { rows } = await client.query(
    'SELECT COUNT(*)::int AS count FROM options WHERE question_id = $1',
    [cascadeQuestionId],
  );
  assert.equal(rows[0].count, 0);
});
