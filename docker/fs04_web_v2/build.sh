#!/bin/bash
set -e

# Configuration
TAG="${1:-latest}"

echo "Building fs04_web_v2 with tag: $TAG"
echo "Using docker-compose.yaml with context ../.."

# Get the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"

echo "Exporting PUBLIC_VANNA_API_URL for build..."
export PUBLIC_VANNA_API_URL=$(grep PUBLIC_VANNA_API_URL "$PROJECT_ROOT/.env" | cut -d '=' -f2)

# Run docker compose build
TAG=$TAG docker compose -f "$SCRIPT_DIR/docker-compose.yaml" build

echo "✓ Successfully built fs04_web_v2:$TAG"
