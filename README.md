# PrepJEE Backend

API backend for PrepJEE, a JEE exam-prep platform: question bank, practice
attempts, progress tracking, subscriptions/payments, and admin content
management.

Node.js + Fastify + PostgreSQL (raw SQL via `pg`, no ORM), Redis, JWT auth,
Cloudflare R2 for images, Razorpay for payments, Amplitude for analytics.

## Architecture

Route → Controller → Service → Repository. Controllers only parse the
request and call a service; all business logic lives in services; all SQL
lives in repositories. See `CLAUDE.md` for schema conventions that apply to
every table (e.g. every table with a `user_id` reference also carries a
denormalized, trigger-synced `user_phone`).

```
src/
  routes/        Fastify route definitions + JSON Schema validation
  controllers/   Parse request → call service → shape response
  services/      Business logic
  repositories/  All SQL (parameterized queries only)
  middlewares/   Auth guards
  plugins/       Fastify plugin wiring (security, docs, multipart, raw-body)
  modules/       Self-contained integrations (OTP provider, Amplitude)
  utils/         Shared helpers (pagination, caching, JWT, hashing, ...)
  constants/     Every magic string/number, grouped by concern
  config/        Env loading, DB pool, Redis client
migrations/      node-pg-migrate, SQL format, one file per change
seeds/           Idempotent reference-data seeding
tests/           node:test — integration tests against real Postgres/Redis
```

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- Redis 6+
- A Cloudflare R2 bucket, a Razorpay account, and (optionally) an Amplitude
  project — see the environment variable reference below

## Local setup

```bash
npm install
cp .env.example .env   # then fill in real values — see reference below
npm run migrate:up
npm run seed
npm run dev
```

`GET /health` should return `{ success: true, data: { status: "ok" } }`.
`GET /docs` (Swagger UI) is available in development, disabled in production
— see the note under "API documentation" below.

## Scripts

| Command                | What it does                                          |
| ----------------------- | ------------------------------------------------------ |
| `npm run dev`           | Start the API with nodemon (auto-restart on file change) |
| `npm start`             | Start the API (production entrypoint, no nodemon)      |
| `npm test`              | Run the full test suite (`node:test`, real Postgres/Redis) |
| `npm run lint`          | ESLint                                                 |
| `npm run format`        | Prettier, writes in place                              |
| `npm run migrate:create -- <name>` | Create a new migration file (SQL format)   |
| `npm run migrate:up`    | Apply all pending migrations                           |
| `npm run migrate:down`  | Roll back the most recent migration                    |
| `npm run seed`          | Run every `seeds/*.seed.js` file (idempotent)           |

Tests need their own reachable Postgres/Redis (same `DATABASE_URL`/`REDIS_URL`
as dev works fine locally) and run with `NODE_ENV=test` automatically, which
caps each test file's DB pool size to avoid exhausting `max_connections` when
many test files run concurrently.

## Environment variables

Copy `.env.example` to `.env` and fill in real values locally. In
production, set these directly in your hosting platform (see
[Deployment](#deployment)) — never commit real secrets.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `development` \| `test` \| `production`. Several behaviors key off this — see below. |
| `PORT` | no (default `4000`) | Most PaaS providers (including Render) inject their own `PORT` — don't hardcode one in production. |
| `CORS_ORIGIN` | yes | A specific origin in production — **the app refuses to boot if this is `*` and `NODE_ENV=production`** (see Phase 18's hardening). `*` is fine for local dev. |
| `APP_VERSION` | no | Cosmetic — shown in the Swagger spec. |
| `DATABASE_URL` | yes | `postgres://user:pass@host:port/db` |
| `REDIS_URL` | yes | `redis://host:port` |
| `JWT_ACCESS_SECRET` | yes | Long random string. Rotate per environment — never reuse the dev value in production. |
| `JWT_REFRESH_SECRET` | yes | Same as above, must differ from `JWT_ACCESS_SECRET`. |
| `JWT_ACCESS_EXPIRY` | no (default `15m`) | User access token lifetime. |
| `JWT_REFRESH_EXPIRY` | no (default `30d`) | User refresh token lifetime. |
| `ADMIN_JWT_EXPIRY` | no (default `12h`) | Admins get one longer-lived token, no refresh/rotation. |
| `GOOGLE_CLIENT_ID` | no | Blank until Google sign-in is wired up. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | yes | Cloudflare R2 credentials for question/solution image uploads. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | yes | Use `rzp_test_*` keys outside production. |
| `AMPLITUDE_API_KEY` | no | Analytics are silently disabled (logged, not sent) if left blank — safe to omit in any environment. |

Generate a JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Per-environment notes

- **Development**: `CORS_ORIGIN=*` and an empty `AMPLITUDE_API_KEY` are both
  fine — nothing enforces stricter values outside production.
- **Test** (`NODE_ENV=test`, set automatically by `npm test`): needs the same
  variables as development; a real Postgres/Redis are required (no mocks).
- **Production**: `CORS_ORIGIN` must be your real frontend origin,
  `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` must be live (not `rzp_test_*`)
  keys, and every JWT/DB/Redis secret should be distinct from whatever's used
  in development.

## API documentation

Swagger UI is mounted at `/docs`, generated from the same JSON Schemas used
for request validation — it's always current, nothing to hand-maintain. It's
**only mounted outside production** (`NODE_ENV !== production`): the
underlying static-file plugin (`@fastify/static`, via `@fastify/swagger-ui`)
has an open path-traversal CVE with no non-breaking fix available upstream
yet, and exposing the full API surface (including every admin route)
publicly isn't something worth doing anyway. See `src/app.js` for the guard.

## Deployment

### Docker

```bash
docker build -t prepjee-backend .
docker run --env-file .env -p 4000:4000 prepjee-backend
```

The image is a two-stage build (`Dockerfile`): production dependencies only,
runs as a non-root user, and relies on Node's own signal handling for
graceful shutdown (`src/server.js` already drains the Fastify server, closes
the DB pool, and closes Redis on `SIGTERM`/`SIGINT` — no extra init process
needed in the container).

### Render

`render.yaml` is a Render Blueprint that provisions the web service plus its
own managed Postgres and Redis (Key Value) instance, wired together
automatically via `fromDatabase`/`fromService`. To deploy:

1. Push this repo to GitHub/GitLab (this repo isn't connected to a remote
   yet — see the note below).
2. In the Render dashboard: **New → Blueprint**, point it at the repo.
3. Render will prompt for every `sync: false` variable in `render.yaml`
   (JWT secrets, R2 credentials, Razorpay keys, `CORS_ORIGIN`, etc.) —
   fill those in with real production values.
4. After the first deploy, run migrations against the new database (Render
   Shell, or a one-off job): `npm run migrate:up`, then `npm run seed` if
   this is a fresh database.

> **Note:** this project directory is not currently a git repository. Render
> (and most PaaS deploy flows) deploy from a connected git remote, so you'll
> need to `git init`, commit, and push to GitHub/GitLab before a Blueprint
> deploy will work.

To run a staging environment, create a second Render service from the same
repo/branch with its own env var values (its own JWT secrets, its own
`rzp_test_*` Razorpay keys, etc.) rather than reusing production's.

## Database migrations

SQL-format migrations via `node-pg-migrate`, one file per logical change
(never edit a migration that's already been applied anywhere — write a new
one). Every migration has both an Up and a Down section.

```bash
npm run migrate:create -- add-some-column   # scaffolds a new migration file
npm run migrate:up                          # apply all pending
npm run migrate:down                        # roll back the most recent one
```
