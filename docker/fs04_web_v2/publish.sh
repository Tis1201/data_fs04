#!/bin/bash
set -e

# Configuration
REGISTRY="registry.gitlab.com/fs040/web"
TAG="${1:-v2-latest}"
GIT_BRANCH="${2:-feature/mqtt-replace}"

# Get the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "Building and publishing fs04_web_v2 with tag: $TAG"
echo "Branch: $GIT_BRANCH"
echo "(Your local working branch will NOT be affected)"
echo ""

# Clean up previous build dir and worktree
rm -rf "$BUILD_DIR"
cd "$PROJECT_ROOT"

# Remove any stale worktree reference
git worktree prune 2>/dev/null || true

# Create a worktree for the target branch
echo "Creating worktree for $GIT_BRANCH..."
git worktree add "$BUILD_DIR" "$GIT_BRANCH"

# Initialize and update submodules in the worktree
echo "Initializing submodules..."
cd "$BUILD_DIR"
git submodule update --init --recursive

# Build the image from the worktree directory
echo "Building Docker image..."
docker build \
  -t fs04_web_v2:$TAG \
  -f "$SCRIPT_DIR/Dockerfile" \
  "$BUILD_DIR"

# Tag for remote registry
REMOTE_IMAGE="$REGISTRY:$TAG"
echo "Tagging as $REMOTE_IMAGE..."
docker tag fs04_web_v2:$TAG $REMOTE_IMAGE

# Push to registry
echo "Pushing to $REMOTE_IMAGE..."
docker push $REMOTE_IMAGE

# Clean up worktree
cd "$PROJECT_ROOT"
git worktree remove "$BUILD_DIR" --force

echo "✓ Successfully published $REMOTE_IMAGE"
