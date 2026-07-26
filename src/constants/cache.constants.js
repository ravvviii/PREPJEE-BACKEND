export const CACHE = {
  // Subjects/classes/chapters are admin-written, rarely-changing reference
  // data — a longer TTL is safe.
  REFERENCE_LIST_TTL_SECONDS: 300,
  // Published questions change more often (publish/unpublish), so a shorter
  // window bounds how stale a student's list view can get.
  QUESTION_LIST_TTL_SECONDS: 60,
};
