#!/bin/bash

# Create necessary directories
mkdir -p prisma

# Start Docker Compose
docker compose -f docker-compose.yml up -d

# Wait for containers to start
echo "Waiting for containers to start..."
sleep 5

echo "Docker containers started successfully!"
