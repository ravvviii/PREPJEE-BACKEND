-- Up Migration

-- Denormalized user_phone on every table that references users(id), so an
-- admin/support query or a raw DB browse can see "which phone" without a
-- JOIN. Kept in sync by trigger (not application code) in both directions:
--   1. set_user_phone_on_insert()  — populates NEW.user_phone from users.phone
--      whenever a row is inserted with a user_id. No repository/service code
--      needs to know this column exists.
--   2. propagate_user_phone_update() — if users.phone is ever changed, pushes
--      the new value out to every dependent table immediately. The app
--      currently never allows phone to change (PUT /users/profile ignores
--      it), so this trigger is dormant today, but it exists so the
--      denormalized copy can never silently go stale if that changes later.
--
-- Convention going forward: any new table with a `user_id UUID REFERENCES
-- users(id)` column also gets a `user_phone TEXT` column, an index on it, and
-- is added to both trigger functions below (insert list + propagate list).

ALTER TABLE refresh_tokens ADD COLUMN user_phone TEXT;
ALTER TABLE attempts ADD COLUMN user_phone TEXT;
ALTER TABLE bookmarks ADD COLUMN user_phone TEXT;
ALTER TABLE subscriptions ADD COLUMN user_phone TEXT;
ALTER TABLE payments ADD COLUMN user_phone TEXT;
ALTER TABLE analytics_logs ADD COLUMN user_phone TEXT;

UPDATE refresh_tokens t SET user_phone = u.phone FROM users u WHERE u.id = t.user_id;
UPDATE attempts t SET user_phone = u.phone FROM users u WHERE u.id = t.user_id;
UPDATE bookmarks t SET user_phone = u.phone FROM users u WHERE u.id = t.user_id;
UPDATE subscriptions t SET user_phone = u.phone FROM users u WHERE u.id = t.user_id;
UPDATE payments t SET user_phone = u.phone FROM users u WHERE u.id = t.user_id;
UPDATE analytics_logs t SET user_phone = u.phone FROM users u WHERE u.id = t.user_id;

CREATE INDEX refresh_tokens_user_phone_idx ON refresh_tokens (user_phone);
CREATE INDEX attempts_user_phone_idx ON attempts (user_phone);
CREATE INDEX bookmarks_user_phone_idx ON bookmarks (user_phone);
CREATE INDEX subscriptions_user_phone_idx ON subscriptions (user_phone);
CREATE INDEX payments_user_phone_idx ON payments (user_phone);
CREATE INDEX analytics_logs_user_phone_idx ON analytics_logs (user_phone);

CREATE OR REPLACE FUNCTION set_user_phone_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT phone INTO NEW.user_phone FROM users WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_tokens_set_user_phone
  BEFORE INSERT ON refresh_tokens
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE TRIGGER attempts_set_user_phone
  BEFORE INSERT ON attempts
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE TRIGGER bookmarks_set_user_phone
  BEFORE INSERT ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE TRIGGER subscriptions_set_user_phone
  BEFORE INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE TRIGGER payments_set_user_phone
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE TRIGGER analytics_logs_set_user_phone
  BEFORE INSERT ON analytics_logs
  FOR EACH ROW EXECUTE FUNCTION set_user_phone_on_insert();

CREATE OR REPLACE FUNCTION propagate_user_phone_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE refresh_tokens SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE attempts SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE bookmarks SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE subscriptions SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE payments SET user_phone = NEW.phone WHERE user_id = NEW.id;
    UPDATE analytics_logs SET user_phone = NEW.phone WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_propagate_phone
  AFTER UPDATE OF phone ON users
  FOR EACH ROW EXECUTE FUNCTION propagate_user_phone_update();

-- Down Migration

DROP TRIGGER IF EXISTS users_propagate_phone ON users;
DROP FUNCTION IF EXISTS propagate_user_phone_update();

DROP TRIGGER IF EXISTS refresh_tokens_set_user_phone ON refresh_tokens;
DROP TRIGGER IF EXISTS attempts_set_user_phone ON attempts;
DROP TRIGGER IF EXISTS bookmarks_set_user_phone ON bookmarks;
DROP TRIGGER IF EXISTS subscriptions_set_user_phone ON subscriptions;
DROP TRIGGER IF EXISTS payments_set_user_phone ON payments;
DROP TRIGGER IF EXISTS analytics_logs_set_user_phone ON analytics_logs;
DROP FUNCTION IF EXISTS set_user_phone_on_insert();

ALTER TABLE refresh_tokens DROP COLUMN user_phone;
ALTER TABLE attempts DROP COLUMN user_phone;
ALTER TABLE bookmarks DROP COLUMN user_phone;
ALTER TABLE subscriptions DROP COLUMN user_phone;
ALTER TABLE payments DROP COLUMN user_phone;
ALTER TABLE analytics_logs DROP COLUMN user_phone;
