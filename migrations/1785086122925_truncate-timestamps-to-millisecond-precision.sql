-- Up Migration

-- Postgres's timestamptz has microsecond precision; Node's `pg` driver parses
-- it into a JS Date, which only has millisecond precision — silently
-- truncating anything finer. This broke cursor pagination: two rows sharing
-- a timestamp (e.g. seeded via one multi-row INSERT, so NOW() ran once for
-- all of them) could round-trip through a JS Date and come back LARGER than
-- their own original value, making a row satisfy `created_at > cursor`
-- against itself. Capping every timestamp column at TIMESTAMPTZ(3) (millisecond
-- precision) makes Postgres and JS agree exactly, for every table, so this
-- can't recur as more "list" endpoints (classes, chapters, questions, ...)
-- reuse the same cursor-pagination pattern established in Phase 7.

ALTER TABLE admins
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE subjects
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE classes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE years
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

ALTER TABLE exams
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE chapters
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE questions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE options
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

ALTER TABLE solutions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE attempts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

ALTER TABLE bookmarks
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

ALTER TABLE subscriptions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE payments
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ(3);

ALTER TABLE otp_codes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

ALTER TABLE refresh_tokens
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

ALTER TABLE analytics_logs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3);

-- Down Migration

ALTER TABLE admins
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE users
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE subjects
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE classes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE years
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE exams
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE chapters
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE questions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE options
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE solutions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE attempts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE bookmarks
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE subscriptions
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE payments
  ALTER COLUMN created_at TYPE TIMESTAMPTZ,
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ;

ALTER TABLE otp_codes
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE refresh_tokens
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;

ALTER TABLE analytics_logs
  ALTER COLUMN created_at TYPE TIMESTAMPTZ;
