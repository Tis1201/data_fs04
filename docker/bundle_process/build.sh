#!/bin/bash
set -e

# Configuration
TAG="${1:-latest}"

echo "Building fs04-web-bundle-process with tag: $TAG"
echo "Using docker-compose.yaml with context ../.."

# Get the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"

# Run docker compose build
TAG=$TAG docker compose -f "$SCRIPT_DIR/docker-compose.yaml" build

echo "✓ Successfully built fs04-web-bundle-process:$TAG"
