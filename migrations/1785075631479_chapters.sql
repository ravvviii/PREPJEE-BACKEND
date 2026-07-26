-- Up Migration

CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id),
  class_id UUID NOT NULL REFERENCES classes (id),
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chapters_subject_id_idx ON chapters (subject_id);
CREATE INDEX chapters_class_id_idx ON chapters (class_id);
CREATE UNIQUE INDEX chapters_subject_class_name_key ON chapters (subject_id, class_id, name);

CREATE TRIGGER trg_chapters_updated_at
  BEFORE UPDATE ON chapters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS chapters;
