// Cursor is an opaque, base64url-encoded (createdAt, id) pair. Every future
// "List" endpoint (classes, chapters, questions, ...) reuses this same
// helper instead of re-inventing cursor encoding per module.
export const encodeCursor = (row) =>
  Buffer.from(JSON.stringify({ createdAt: row.created_at, id: row.id })).toString('base64url');

export const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

// Fetch limit+1 rows from the repository, then call this to split into the
// actual page + the next cursor (non-null only if that extra row existed).
export const paginate = (rows, limit) => {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
};
