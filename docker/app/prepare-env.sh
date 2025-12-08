#!/bin/bash
# prepare-env.sh - Copies .env and replaces localhost with host.docker.internal

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET_ENV="$SCRIPT_DIR/.env.docker"

# Copy and transform
sed -e 's/localhost/host.docker.internal/g' \
    -e 's/127\.0\.0\.1/host.docker.internal/g' \
    "$ROOT_DIR/.env" > "$TARGET_ENV"

echo "Created $TARGET_ENV with localhost -> host.docker.internal"
echo "Run: docker compose --env-file .env.docker up"
