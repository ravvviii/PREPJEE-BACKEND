-- Up Migration

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX subjects_name_key ON subjects (name);

CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX classes_name_key ON classes (name);

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX years_value_key ON years (value);

CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX exams_name_key ON exams (name);

CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Deferred from the users_and_admins migration: users.class_id / target_exam_id
-- need classes/exams to exist first.
ALTER TABLE users
  ADD COLUMN class_id UUID REFERENCES classes (id),
  ADD COLUMN target_exam_id UUID REFERENCES exams (id);

CREATE INDEX users_class_id_idx ON users (class_id);
CREATE INDEX users_target_exam_id_idx ON users (target_exam_id);

-- Down Migration

ALTER TABLE users
  DROP COLUMN IF EXISTS class_id,
  DROP COLUMN IF EXISTS target_exam_id;

DROP TABLE IF EXISTS exams;
DROP TABLE IF EXISTS years;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS subjects;
