#!/bin/bash
set -e

# Configuration
# User requested to adapt to fs04_web_v2:latest pattern
REGISTRY="registry.gitlab.com/fs040/web/fs04-web-v2"
TAG="${1:-latest}"

echo "Publishing fs04_web_v2:$TAG to $REGISTRY"

# Tag for remote registry
REMOTE_IMAGE="$REGISTRY:$TAG"
echo "Tagging as $REMOTE_IMAGE..."
docker tag fs04_web_v2:$TAG $REMOTE_IMAGE

# Push to registry
echo "Pushing to $REMOTE_IMAGE..."
docker push $REMOTE_IMAGE

echo "✓ Successfully published $REMOTE_IMAGE"
