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
# bundle:process uses scripts/processes/bundle-process.ts
COPY scripts ./scripts
COPY prodServer.js ./
COPY postcss.config.js ./
COPY tailwind.config.js ./

# Generate SvelteKit config (including tsconfig paths)
RUN npx svelte-kit sync

# Generate Prisma and ZenStack clients
RUN npx prisma generate
RUN npx zenstack generate

# Production stage
FROM node:20.9.0-bookworm-slim
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_ENV=production

# Install runtime libraries for node-canvas and system deps
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
  apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates bash \
  libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 libpixman-1-0 libfreetype6 \
  openssl

# Copy everything from build stage (tsx needs source and deps)
COPY --from=build /app ./

CMD ["npm", "run", "bundle:process"]
