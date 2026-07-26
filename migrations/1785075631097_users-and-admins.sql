-- Up Migration

-- Every session against this database (the app's pool, migrations, DBeaver,
-- psql) defaults to IST unless it explicitly overrides — so timestamps are
-- always readable as IST without manual conversion. Columns stay `timestamptz`
-- (a real UTC instant) regardless; this only changes *display* timezone.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Kolkata');
END $$;

-- Shared by every table below with an `updated_at` column, so it's never
-- forgotten in application code. Uses clock_timestamp(), not NOW() — NOW()
-- is frozen at transaction start, so two UPDATEs in the same transaction
-- would otherwise get an identical, stale updated_at.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TYPE admin_role AS ENUM ('admin', 'super_admin');

CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role admin_role NOT NULL DEFAULT 'admin',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX admins_email_key ON admins (email);

CREATE TRIGGER trg_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  google_id TEXT,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  -- target_exam_id / class_id reference tables created in the next migration;
  -- added as nullable FKs there via ALTER TABLE once those tables exist.
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_phone_key ON users (phone);
CREATE UNIQUE INDEX users_google_id_key ON users (google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX users_email_key ON users (email) WHERE email IS NOT NULL;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS admins;
DROP TYPE IF EXISTS admin_role;
DROP FUNCTION IF EXISTS set_updated_at();
