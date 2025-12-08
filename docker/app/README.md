# fs04_web Docker App

Production Docker configuration for the fs04_web SvelteKit application.

## Prerequisites

- Docker 20+
- Docker Compose v2+
- Valid `.env` file in project root

## Quick Start

```bash
# Prepare environment (replaces localhost → host.docker.internal)
./prepare-env.sh

# Build
docker compose build

# Run
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Versioning

Tag images using the `TAG` environment variable:

```bash
# Build with version
TAG=v1.0.0 docker compose build

# Run specific version
TAG=v1.0.0 docker compose up -d
```

## Build Details

The Dockerfile uses a **multi-stage build**:

1. **Build Stage**: Installs dependencies, generates Prisma/ZenStack clients, builds SvelteKit app
2. **Production Stage**: Minimal runtime with only necessary files

### Key Features

- ZenStack + Prisma client generation at build time
- Node-canvas native dependencies included
- Database migration on container startup (via `entrypoint.sh`)
- Health check on `/api/health`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TAG` | `latest` | Image version tag |
| `PORT` | `3000` | Host port mapping |

Environment variables are loaded from `../../.env`.

## Files

```
docker/app/
├── Dockerfile           # Multi-stage build
├── docker-compose.yaml  # Compose configuration
└── README.md            # This file
```
