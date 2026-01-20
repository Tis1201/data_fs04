#!/bin/bash
set -e

# Configuration
REGISTRY="registry.gitlab.com/fs040/web/fs04-web-job-worker"
TAG="${1:-latest}"

echo "Publishing fs04-web-job-worker:$TAG to $REGISTRY"


# Image name defined in docker-compose.yaml
LOCAL_IMAGE="fs04-web-job-worker:${TAG}"

# Tag for remote registry
REMOTE_IMAGE="$REGISTRY:$TAG"
echo "Tagging $LOCAL_IMAGE as $REMOTE_IMAGE..."
docker tag $LOCAL_IMAGE $REMOTE_IMAGE

# Push to registry
echo "Pushing to $REMOTE_IMAGE..."
docker push $REMOTE_IMAGE

echo "✓ Successfully published $REMOTE_IMAGE"
