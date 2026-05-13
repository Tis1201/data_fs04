#!/bin/bash
set -e

# Configuration
REGISTRY="registry.gitlab.com/fs040/web"
IMAGE_NAME="fs04-web-mqtt-worker"
TAG="${1:-latest}"

# Get the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Get the project root directory
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"

cd "$PROJECT_ROOT"

# 1. Build the image
echo "Building local image: $IMAGE_NAME:$TAG..."
# We use the existing build command logic
docker build --platform linux/amd64 -t $IMAGE_NAME:$TAG -f docker/mqtt-worker/Dockerfile .

# 2. Tag for remote registry
REMOTE_IMAGE="$REGISTRY/$IMAGE_NAME:$TAG"
echo "Tagging as $REMOTE_IMAGE..."
docker tag $IMAGE_NAME:$TAG $REMOTE_IMAGE

# 3. Push to registry
echo "Pushing to $REMOTE_IMAGE..."
docker push $REMOTE_IMAGE

echo "Successfully published $REMOTE_IMAGE"
