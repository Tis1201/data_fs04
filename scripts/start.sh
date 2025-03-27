#!/bin/bash
set -e

# Display startup banner
echo "===================================="
echo "Starting FS04 Web Application Server"
echo "===================================="

# Check Node.js version
NODE_VERSION=$(node -v)
echo "Using Node.js version: $NODE_VERSION"

# Generate ZenStack files (always do this before Prisma)
echo "Generating ZenStack files..."
npx zenstack generate

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Optional: Run database migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Set production environment
export NODE_ENV=production

# Start the server
echo "Starting production server..."
node prodServer.js
