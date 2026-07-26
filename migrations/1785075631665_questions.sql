-- Up Migration

-- Keep in sync with DIFFICULTY_LEVELS in src/constants/roles.constants.js —
-- that array is the app-side source of truth this enum mirrors.
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects (id),
  class_id UUID NOT NULL REFERENCES classes (id),
  chapter_id UUID NOT NULL REFERENCES chapters (id),
  year_id UUID REFERENCES years (id),
  exam_id UUID REFERENCES exams (id),
  difficulty difficulty_level NOT NULL DEFAULT 'medium',
  question_text TEXT NOT NULL,
  question_image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES admins (id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX questions_subject_class_chapter_idx ON questions (subject_id, class_id, chapter_id);
CREATE INDEX questions_year_id_idx ON questions (year_id);
CREATE INDEX questions_exam_id_idx ON questions (exam_id);
CREATE INDEX questions_difficulty_idx ON questions (difficulty);
CREATE INDEX questions_is_published_idx ON questions (is_published);
CREATE INDEX questions_created_by_idx ON questions (created_by);

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS questions;
DROP TYPE IF EXISTS difficulty_level;
