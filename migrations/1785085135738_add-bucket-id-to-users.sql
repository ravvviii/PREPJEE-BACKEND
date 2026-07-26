-- Up Migration

-- A/B testing bucket: a random 0-99 assigned once per user, used to gate
-- experimental features by cohort (e.g. "show new feature to bucket_id < 10").
-- Not a foreign key despite the "_id" name — just a fixed random number.
-- random() is volatile, so adding this column rewrites the table and
-- evaluates it once per existing row too (each user gets a distinct value,
-- not the same one repeated).
ALTER TABLE users
  ADD COLUMN bucket_id SMALLINT NOT NULL DEFAULT floor(random() * 100)::smallint;

ALTER TABLE users
  ADD CONSTRAINT users_bucket_id_range CHECK (bucket_id >= 0 AND bucket_id <= 99);

CREATE INDEX users_bucket_id_idx ON users (bucket_id);

-- Down Migration

DROP INDEX IF EXISTS users_bucket_id_idx;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_bucket_id_range;
ALTER TABLE users DROP COLUMN IF EXISTS bucket_id;
