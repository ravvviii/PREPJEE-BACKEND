-- Up Migration

-- questions_subject_class_chapter_idx (subject_id, class_id, chapter_id) only
-- helps queries that filter on subject_id (leftmost-prefix rule) — every
-- filter combination in question.repository.js's findPage is independently
-- optional, so a caller filtering by class_id or chapter_id alone (as
-- progress.repository.js and dashboard.repository.js's chapter-scoped
-- queries both do, joining/filtering on chapter_id with no subject_id in
-- sight) gets no help from that composite at all and falls back to a
-- sequential scan as the table grows.
CREATE INDEX questions_class_id_idx ON questions (class_id);
CREATE INDEX questions_chapter_id_idx ON questions (chapter_id);

-- Down Migration

DROP INDEX IF EXISTS questions_chapter_id_idx;
DROP INDEX IF EXISTS questions_class_id_idx;
