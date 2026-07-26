# syntax=docker/dockerfile:1

# ---- deps: production dependencies only, in their own layer so `npm ci`
# only reruns when package*.json actually changes, not on every source edit.
FROM node:22-slim AS deps
WORKDIR /app
# bcrypt is a native addon — node-pre-gyp ships prebuilt binaries for most
# platforms, but these build tools are the fallback if none matches this
# image's exact glibc/arch combination.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime: only what's needed to run the app, nothing used to build it.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds

# Runs as a non-root user — the image has no reason to run as root, and this
# limits blast radius if the process is ever compromised.
RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 4000

# Node's own signal handling is enough here (no shell wrapper, no extra init
# process) — `node src/server.js` is already PID 1 and handles SIGTERM directly.
CMD ["node", "src/server.js"]
