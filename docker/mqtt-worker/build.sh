#!/bin/bash

# Ensure we are in the project root
cd "$(dirname "$0")/../.."

echo "Building fs04-web-mqtt-worker..."
docker build --platform linux/amd64 -t fs04-web-mqtt-worker:${TAG:-latest} -f docker/mqtt-worker/Dockerfile .
