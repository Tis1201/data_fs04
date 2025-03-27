# FS04 Web App Docker Setup

This directory contains the Docker configuration for running the FS04 Web Application.

## Docker Compose Setup

The Docker Compose setup provides an easy way to run the application with all necessary dependencies.

### Prerequisites

- Docker and Docker Compose installed
- A valid `.env` file in the project root

### Running with Docker Compose

To start the application using Docker Compose:

```bash
# From the project root directory
docker compose up
```

This will:
1. Build the Docker image if needed
2. Create a persistent volume for the database
3. Mount the .env file for configuration
4. Run database migrations automatically
5. Start the application on port 3000

To run in detached mode:

```bash
docker compose up -d
```

### Seeding the Database

To seed the database with an admin user:

```bash
# Start the container
docker compose up -d

# Run the seed script
docker exec fs04-web-app bash -c "RUN_SEED=true ./start.sh"
```

This will create:
- An admin user with email `admin@example.com` and password `admin123`
- An API key for WebSocket testing (displayed in the logs)

### Managing the Container

```bash
# View logs
docker compose logs -f

# Stop the container
docker compose down

# Restart the container
docker compose restart
```

## Standalone Docker Setup

If you prefer to use the standalone Docker setup instead of Docker Compose:

```bash
# Build the image
sh docker/build.sh

# Run the container with migrations
sh docker/run.sh start:init

# Run with migrations and seed data
sh docker/run.sh start:seed

# Run in debug mode
sh docker/run.sh debug:init
```

## Volume Management

The application uses a Docker volume for database persistence. This ensures that your data is preserved even when the container is stopped or removed.

## Environment Variables

All environment variables are loaded from the `.env` file in the project root. This file is mounted into the container at runtime.
