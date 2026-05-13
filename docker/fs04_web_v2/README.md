# fs04_web_v2 Docker Build

Production Docker configuration for fs04_web v2 (from `feature/mqtt-replace` branch).

## Prerequisites

- Docker 20+
- Docker Compose v2+
- Valid `.env` file in project root

## Quick Start

```bash
# Build
./build.sh

# Run locally (port 3001)
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Push to Registry

```bash
# Push with default tag (v2-latest)
./publish.sh

# Push with custom tag
./publish.sh v2.0.0
```

## Files

```
docker/fs04_web_v2/
├── Dockerfile           # Multi-stage SvelteKit build
├── docker-compose.yaml  # Local development compose
├── build.sh             # Local build script
├── publish.sh           # Push to GitLab registry
└── README.md            # This file
```

## Image Tags

| Tag | Description |
|-----|-------------|
| `v2-latest` | Latest v2 build |
| `v2.x.x` | Versioned releases |
