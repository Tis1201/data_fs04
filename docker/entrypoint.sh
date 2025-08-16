#!/usr/bin/env bash
set -euo pipefail

# Fail safe defaults
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"

echo "[entrypoint] Environment: NODE_ENV=$NODE_ENV PORT=$PORT"
# Compose now injects env via env_file; do not source /app/.env directly

# If DATABASE_URL is set, wait for the DB to be reachable to avoid crash loops
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] Parsing DATABASE_URL to wait for DB..."
  # If DB host is localhost/127.0.0.1, rewrite to host.docker.internal so container can reach host DB
  NEW_DB_URL=$(node -e "try{const u=new URL(process.env.DATABASE_URL);if(['localhost','127.0.0.1','::1'].includes(u.hostname)){u.hostname='host.docker.internal';process.stdout.write(u.toString())}}catch(e){process.exit(0)}")
  if [ -n "$NEW_DB_URL" ]; then
    export DATABASE_URL="$NEW_DB_URL"
    echo "[entrypoint] Rewrote DATABASE_URL to use host.docker.internal"
  fi
  DB_HOST=$(node -e "try{const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.hostname)}catch(e){process.exit(1)}" || true)
  DB_PORT=$(node -e "try{const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.port|| (u.protocol==='postgresql:'?'5432':''))}catch(e){process.exit(1)}" || true)
  if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    echo "[entrypoint] Waiting for database at $DB_HOST:$DB_PORT ..."
    ATTEMPTS=0
    until timeout 1 bash -c "</dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null; do
      ATTEMPTS=$((ATTEMPTS+1))
      if [ $ATTEMPTS -ge 60 ]; then
        echo "[entrypoint] Database not reachable after 60s. Continuing; migrations may fail."
        break
      fi
      sleep 1
    done
  else
    echo "[entrypoint] Warning: Unable to parse DATABASE_URL; skipping DB wait."
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] Warning: DATABASE_URL is not set. Prisma migrate will be skipped."
else
  echo "[entrypoint] Running Prisma migrations..."
  if ! npx prisma migrate deploy; then
    echo "[entrypoint] Prisma migrate failed. Falling back to prisma db push to sync schema."
    npx prisma db push
  fi
fi

if [ "${SEED:-false}" = "true" ]; then
  echo "[entrypoint] Seeding database..."
  npm run db:seed || echo "[entrypoint] Seed step failed or is not configured; continuing"
fi

echo "[entrypoint] Starting SvelteKit production server"
exec node build









