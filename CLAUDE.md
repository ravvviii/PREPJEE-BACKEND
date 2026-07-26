# PrepJEE Backend — Standing Conventions

Conventions established during the build that aren't obvious from any single
file. Read this before adding new tables or migrations.

## Every table with a `user_id` reference also gets `user_phone`

Any table with `user_id UUID REFERENCES users (id)` must also have:

- `user_phone TEXT` column
- `CREATE INDEX <table>_user_phone_idx ON <table> (user_phone);`
- The table added to `set_user_phone_on_insert()`'s trigger list (populates
  `user_phone` on insert) and to `propagate_user_phone_update()`'s trigger
  list (keeps it in sync if a user's phone ever changes)

Both trigger functions live in
`migrations/1785093520861_add-user-phone-denormalization.sql`. Extend them
in-place in a new migration (`CREATE OR REPLACE FUNCTION ...` + add the new
table's trigger) rather than creating parallel logic elsewhere — there
should only ever be one insert-populate function and one propagate-update
function, shared by every table.

This is a denormalization for admin/support convenience (see which phone a
row belongs to without a JOIN when browsing the DB directly). It's
maintained entirely by triggers, not application code, so no
repository/service ever needs to pass `user_phone` explicitly — insert
`user_id` as normal and the column fills itself in.

Currently applied to: `refresh_tokens`, `attempts`, `bookmarks`,
`subscriptions`, `payments`, `analytics_logs`.
