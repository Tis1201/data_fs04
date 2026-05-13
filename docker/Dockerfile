# Build stage
FROM node:20.9.0-bookworm-slim AS build
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_OPTIONS=--max-old-space-size=4096

# Install build tools and native deps for node-canvas and prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates bash git python3 make g++ pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev libfreetype6-dev \
  openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files (keep lockfile for faster builds)
COPY package*.json ./

# Install dependencies using lockfile, skip platform-specific optional deps
RUN npm ci --legacy-peer-deps --omit=optional

# Copy only necessary files for build
COPY src ./src
COPY static ./static
COPY prisma ./prisma
# Ensure seed.ts is explicitly copied
COPY prisma/seed.ts ./prisma/
COPY schema.zmodel ./
COPY svelte.config.js ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY scripts ./scripts
COPY prodServer.js ./
# Ensure process scripts are available (needed for bundle and cleanup processes)
COPY scripts/processes ./scripts/processes
COPY postcss.config.js ./
COPY tailwind.config.js ./
 # Build the application (no pre-built build directory in CI/CD)

# Create .svelte-kit directory with empty tsconfig.json
RUN mkdir -p .svelte-kit
RUN echo '{"compilerOptions":{}}' > .svelte-kit/tsconfig.json

# Generate Prisma client first, then ZenStack
RUN npx prisma generate
RUN npx zenstack generate

# Copy entrypoint into build stage so it's available for later stages
COPY docker/entrypoint.sh ./entrypoint.sh

# Build the application (__BUILDING=1 prevents Redis connection attempts during build)
RUN __BUILDING=1 npm run build

# Keep dev dependencies so prisma CLI and tsx are available at runtime
# (Do NOT prune dev deps; entrypoint runs migrations/seed using prisma/tsx)

# Production stage
FROM node:20.9.0-bookworm-slim
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1

# Install runtime libraries for node-canvas and system deps
# Also install binutils (ar), xz-utils (xz), and tar (needed for DEB file parsing)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates bash \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 libpixman-1-0 libfreetype6 \
  openssl \
  binutils \
  xz-utils \
  tar \
  && rm -rf /var/lib/apt/lists/*

# Copy built app and necessary files from build stage
COPY --from=build /app/build ./build
COPY --from=build /app/static ./static
COPY --from=build /app/package*.json ./
COPY --from=build /app/schema.zmodel ./
COPY --from=build /app/prodServer.js ./prodServer.js
# Copy process scripts (needed for bundle and cleanup processes)
COPY --from=build /app/scripts/processes ./scripts/processes

# Copy Prisma schema and migrations
COPY --from=build /app/prisma/schema.prisma ./prisma/
COPY --from=build /app/prisma/migrations ./prisma/migrations


# Copy entrypoint script from build stage
COPY --from=build /app/entrypoint.sh ./entrypoint.sh

# Ensure seed file exists at expected path for Prisma
COPY --from=build /app/prisma/seed.ts ./prisma/seed.ts

# Copy node_modules from build stage (includes dev deps for prisma/tsx)
COPY --from=build /app/node_modules ./node_modules

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start using entrypoint that runs migrations/seed then launches server
CMD ["/bin/bash", "-c", "./entrypoint.sh"]
