#!/bin/bash
set -e

# Fail safe defaults
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"

echo "[entrypoint] Environment: NODE_ENV=$NODE_ENV PORT=$PORT"
# Compose now injects env via env_file; do not source /app/.env directly

# If DATABASE_URL is set, wait for the DB to be reachable to avoid crash loops
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] Parsing DATABASE_URL to wait for DB..."
  # If DB host is localhost/127.0.0.1, rewrite to host.docker.internal so container can reach host DB
  NEW_DB_URL=$(node -e "try{const u=new URL(process.env.DATABASE_URL);if(['localhost','127.0.0.1','::1'].includes(u.hostname)){u.hostname='host.docker.internal';process.stdout.write(u.toString())}}catch(e){process.exit(1)}" || true)
  if [ -n "$NEW_DB_URL" ]; then
    echo "[entrypoint] Rewrote DATABASE_URL to use host.docker.internal"
    export DATABASE_URL="$NEW_DB_URL"
  fi
  
  DB_HOST=$(node -e "try{const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.hostname)}catch(e){process.exit(1)}" || true)
  DB_PORT=$(node -e "try{const u=new URL(process.env.DATABASE_URL);process.stdout.write(u.port|| (u.protocol==='postgresql:'?'5432':''))}catch(e){process.exit(1)}" || true)
  if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    echo "[entrypoint] Waiting for database at $DB_HOST:$DB_PORT ..."
    # Use timeout with bash built-in /dev/tcp check instead of nc
    timeout 60 bash -c "until timeout 1 bash -c '</dev/tcp/$DB_HOST/$DB_PORT' 2>/dev/null; do sleep 1; done" || echo "[entrypoint] Database not reachable after 60s. Continuing; migrations may fail."
  fi
  
  echo "[entrypoint] Running Prisma migrations..."
  if ! npx prisma migrate deploy; then
    echo "[entrypoint] Prisma migrate failed. Falling back to prisma db push to sync schema."
    if ! npx prisma db push; then
      echo "[entrypoint] Prisma db push also failed due to foreign key constraints."
      echo "[entrypoint] Database has existing data that violates constraints."
      echo "[entrypoint] Options:"
      echo "[entrypoint]   1. Set RESET_DB=true in .env to reset database (WARNING: loses all data)"
      echo "[entrypoint]   2. Manually fix data in database to satisfy constraints"
      echo "[entrypoint]   3. Set SKIP_DB_SYNC=true to skip database operations (app may not work)"
      
      if [ "${RESET_DB:-false}" = "true" ]; then
        echo "[entrypoint] RESET_DB=true detected. Resetting database..."
        npx prisma migrate reset --force
        echo "[entrypoint] Database reset complete."
      elif [ "${SKIP_DB_SYNC:-false}" = "true" ]; then
        echo "[entrypoint] SKIP_DB_SYNC=true detected. Skipping database operations."
      else
        echo "[entrypoint] Neither RESET_DB nor SKIP_DB_SYNC set. Exiting to prevent crash loop."
        exit 1
      fi
    fi
  fi
fi

echo "[entrypoint] Starting application..."
exec node prodServer.js









