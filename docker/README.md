# FS04 Web App Docker Setup

This directory contains the Docker configuration for running the FS04 Web Application.

## Docker Compose Setup

The Docker Compose setup provides an easy way to run the application with all necessary dependencies.

### Prerequisites

- Docker and Docker Compose installed
- A valid `.env` file in the project root

### Running with Docker Compose

From the project root, start everything with the compose file in `docker/`:

```bash
# Build and start in the background
docker compose -f docker/docker-compose.yml up --build -d

# Or run in the foreground
docker compose -f docker/docker-compose.yml up --build
```

This will:
1. Build the Docker image if needed
2. Load environment from your project `.env`
3. Run Prisma migrations automatically (via entrypoint)
4. Start the app on port 3000 (`http://localhost:3000`)
5. Start Nginx proxy on ports 80/443 (optional access at `http://localhost`)

### Seeding the Database (admin user)

Option A (recommended on first run): enable seeding via environment

1) Edit `docker/docker-compose.yml` and uncomment `SEED=true` under `fs04-web-app.environment`.
2) Start (or restart) the stack:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

Option B: run the seed script manually in the running container

```bash
docker exec -it fs04-web-app bash -lc 'npm run db:seed'
```

The seed creates an admin user (default credentials are defined by your seed script) and may print useful test keys to the logs.

### Managing the Containers

```bash
# View app logs
docker compose -f docker/docker-compose.yml logs -f fs04-web-app

# View all logs
docker compose -f docker/docker-compose.yml logs -f

# Stop and remove containers
docker compose -f docker/docker-compose.yml down

# Restart the app container
docker compose -f docker/docker-compose.yml restart fs04-web-app
```

## Standalone Docker Setup

If you prefer to use the standalone Docker setup instead of Docker Compose:

```bash
sh docker/build.sh build

sh docker/run.sh start:init

sh docker/run.sh start:seed

sh docker/run.sh debug:init
```

## Notes

- Ensure your project `.env` contains a valid `DATABASE_URL` (e.g. Postgres) and any required app settings (e.g. `PUBLIC_BASE_URL`).
- Migrations run automatically on startup if `DATABASE_URL` is set.
- Seeding only runs when `SEED=true` is provided (Option A) or when you run the seed script manually (Option B).

## Environment Variables

All environment variables are loaded from the `.env` file in the project root. This file is mounted into the container at runtime.
