# Build stage
FROM node:20.9.0-bookworm-slim AS build
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_OPTIONS=--max-old-space-size=5632

# Install build tools and native deps for node-canvas and prisma
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
  apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates bash git python3 make g++ pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev libfreetype6-dev \
  openssl

# Copy package files
COPY package*.json ./

# Fix duplicate keys in package.json if any (legacy issue helper)
COPY package.json ./package.json.original
RUN grep -v '"preview": "vite preview",' ./package.json.original | grep -v '"start": "NODE_ENV=production node build",' > ./package.json

# Install dependencies
# Remove Mac-specific lockfile issues if any, ensuring clean linux resolution
# Install dependencies
# Remove Mac-specific lockfile issues if any, ensuring clean linux resolution
RUN --mount=type=cache,target=/root/.npm \
  rm -f package-lock.json && npm install --legacy-peer-deps

# Copy source files
COPY src ./src
COPY static ./static
COPY prisma ./prisma
COPY schema.zmodel ./
COPY svelte.config.js ./
COPY vite.config.ts ./
COPY tsconfig.json ./
# Scripts needed for runtime (if any, but job:worker script uses src/worker/jobs/index.ts)
COPY scripts ./scripts
COPY prodServer.js ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

# Generate SvelteKit config (including tsconfig paths)
RUN npx svelte-kit sync

# Generate Prisma and ZenStack clients
RUN npx prisma generate
RUN npx zenstack generate

# No need to run 'npm run build' as we are using tsx/ts-node for the worker.
# However, if there are shared TS files that need transpilation or verification, 
# 'npm run check' could be useful, but for now we rely on tsx.

# Production stage
FROM node:20.9.0-bookworm-slim
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_ENV=production

# Install runtime libraries for node-canvas and system deps
# Install runtime libraries for node-canvas and system deps
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
  apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates bash \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 libpixman-1-0 libfreetype6 \
  openssl

# Copy everything from build stage because tsx/ts-node needs source files and dev dependencies
# We cannot do a "production only" install for dependencies easily with this setup unless we separate build
# But for now, we follow the pattern of having a fat container for simplicity and compatibility with tsx
COPY --from=build /app ./

CMD ["npm", "run", "job:worker"]
