import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, checkDatabaseConnection, closeDatabase } from '../src/config/database.js';
import { withTransaction } from '../src/utils/transaction.js';

before(async () => {
  await pool.query('CREATE TABLE IF NOT EXISTS _phase2_tx_test (id serial PRIMARY KEY, label text)');
});

after(async () => {
  await pool.query('DROP TABLE IF EXISTS _phase2_tx_test');
  await closeDatabase();
});

test('database connection check succeeds against a real Postgres instance', async () => {
  assert.equal(await checkDatabaseConnection(), true);
});

test('withTransaction commits when the callback succeeds', async () => {
  await withTransaction((client) =>
    client.query("INSERT INTO _phase2_tx_test (label) VALUES ('commit-test')"),
  );

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM _phase2_tx_test WHERE label = 'commit-test'",
  );
  assert.equal(rows[0].count, 1);
});

test('withTransaction rolls back when the callback throws', async () => {
  await assert.rejects(
    withTransaction(async (client) => {
      await client.query("INSERT INTO _phase2_tx_test (label) VALUES ('rollback-test')");
      throw new Error('boom');
    }),
    /boom/,
  );

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM _phase2_tx_test WHERE label = 'rollback-test'",
  );
  assert.equal(rows[0].count, 0);
});
