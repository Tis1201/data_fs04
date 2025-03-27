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

cp seed.ts prisma/

# Optional: Run database migrations if needed
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
  
  # Optional: Run seed script after migrations if needed
  if [ "$RUN_SEED" = "true" ]; then
    echo "Running database seed script..."
    # Check if seed.ts exists before running
    if [ -f "seed.ts" ]; then
      echo "Found seed.ts file, running with tsx..."
      npx tsx seed.ts
    else
      echo "Error: seed.ts file not found in prisma directory!"
      ls -la prisma/
    fi
  fi
fi

# Set production environment
export NODE_ENV=production

# Start the server
echo "Starting production server..."
node prodServer.js
