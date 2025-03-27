# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Install OpenSSL and other dependencies
RUN apk add --no-cache openssl bash

# Copy package files
COPY package*.json ./

# Fix duplicate keys in package.json
COPY package.json ./package.json.original
RUN grep -v '"preview": "vite preview",' ./package.json.original | grep -v '"start": "NODE_ENV=production node build",' > ./package.json

# Install dependencies
RUN npm ci

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
COPY postcss.config.js ./
COPY tailwind.config.js ./

# Create .svelte-kit directory with empty tsconfig.json
RUN mkdir -p .svelte-kit
RUN echo '{"compilerOptions":{}}' > .svelte-kit/tsconfig.json

# Generate ZenStack and Prisma files before building
RUN npx zenstack generate
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app

# Install OpenSSL and other dependencies
RUN apk add --no-cache openssl bash

# Copy built app and necessary files from build stage
COPY --from=build /app/build ./build
COPY --from=build /app/static ./static
COPY --from=build /app/package*.json ./
COPY --from=build /app/schema.zmodel ./

# Copy Prisma schema and migrations but not the database
COPY --from=build /app/prisma/schema.prisma ./prisma/
COPY --from=build /app/prisma/migrations ./prisma/migrations


# Copy startup scripts
COPY --from=build /app/scripts/build/start.sh ./start.sh
COPY --from=build /app/prodServer.js ./

# Make start.sh executable
RUN chmod +x ./start.sh

# Install all dependencies (not just production) to ensure all packages are available
RUN npm ci

# Install tsx globally for running TypeScript files directly
RUN npm install -g tsx

# Generate Prisma client and ZenStack files in the production environment
RUN npx zenstack generate
RUN npx prisma generate


COPY --from=build /app/prisma/seed.ts ./seed.ts


# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["/bin/bash", "-c", "./start.sh"]