# Build stage — Docker Desktop needs at least 8 GB memory for this build
FROM node:20.9.0-bookworm-slim AS build
WORKDIR /app
ARG PUBLIC_VANNA_API_URL
ENV PUBLIC_VANNA_API_URL=$PUBLIC_VANNA_API_URL
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_OPTIONS=--max-old-space-size=4096

# Install build tools and native deps for node-canvas and prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates bash git python3 make g++ pkg-config \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev libfreetype6-dev \
  openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy package files (keep lockfile for deterministic, lower-memory installs)
COPY package*.json ./

# Install dependencies using lockfile
RUN npm ci --legacy-peer-deps

# Copy source files
COPY src ./src
COPY static ./static
COPY prisma ./prisma
COPY schema.zmodel ./
COPY svelte.config.js ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY scripts ./scripts
COPY prodServer.js ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY docker/entrypoint.sh ./entrypoint.sh

# Create .svelte-kit directory
RUN mkdir -p .svelte-kit && echo '{"compilerOptions":{}}' > .svelte-kit/tsconfig.json

# Generate Prisma and ZenStack clients
RUN npx prisma generate
RUN npx zenstack generate

# Build the application (__BUILDING=1 prevents Redis connection attempts during build)
RUN __BUILDING=1 npm run build

# Production stage
FROM node:20.9.0-bookworm-slim
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_ENV=production

# Install runtime libraries for node-canvas and system deps
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
COPY --from=build /app/scripts/processes ./scripts/processes

# Copy Prisma schema, migrations, and seed
COPY --from=build /app/prisma/schema.prisma ./prisma/
COPY --from=build /app/prisma/migrations ./prisma/migrations
COPY --from=build /app/prisma/seed.ts ./prisma/seed.ts

COPY --from=build /app/entrypoint.sh ./entrypoint.sh

# Copy node_modules (includes devDeps needed at runtime: prisma CLI, tsx)
COPY --from=build /app/node_modules ./node_modules

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENV PORT=3000

CMD ["./entrypoint.sh"]
