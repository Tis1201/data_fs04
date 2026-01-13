# Build stage
FROM node:20.9.0-bookworm-slim AS build
WORKDIR /app
ENV ROLLUP_SKIP_NODE_NATIVE=1
ENV NODE_OPTIONS=--max-old-space-size=5632

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

# Copy source files
# Copy source files
COPY src ./src
COPY prisma ./prisma
COPY schema.zmodel ./
COPY tsconfig.json ./
COPY scripts ./scripts
COPY prodServer.js ./
COPY docker/entrypoint.sh ./entrypoint.sh

# Create .svelte-kit directory
RUN mkdir -p .svelte-kit && echo '{"compilerOptions":{}}' > .svelte-kit/tsconfig.json

# Generate Prisma and ZenStack clients
RUN npx prisma generate
RUN npx zenstack generate

# Build the application
# RUN npm run build

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
  && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and dependencies
# COPY --from=build /app/build ./build
# Worker specific: Need src for tsx
COPY --from=build /app/src ./src
COPY --from=build /app/package*.json ./
COPY --from=build /app/schema.zmodel ./
COPY --from=build /app/prodServer.js ./prodServer.js
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/entrypoint.sh ./entrypoint.sh
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/.svelte-kit ./.svelte-kit

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "run", "mqtt:worker"]
