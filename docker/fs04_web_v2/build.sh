#!/bin/bash
set -e

# Configuration
TAG="${1:-v2-latest}"
GIT_BRANCH="${2:-feature/mqtt-replace}"
SUBMODULE_PATH="src/lib/components/ui_components_sveltekit"

# Get the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"
BUILD_DIR="$SCRIPT_DIR/.build"

echo "Building fs04_web_v2 with tag: $TAG"
echo "Branch: $GIT_BRANCH"
echo "Build dir: $BUILD_DIR"
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

# Copy submodule from the main working directory (already checked out there)
echo "Copying submodule from local working directory..."
cd "$BUILD_DIR"
rm -rf "$SUBMODULE_PATH"
cp -r "$PROJECT_ROOT/$SUBMODULE_PATH" "$SUBMODULE_PATH"
# Remove .git file/folder from copied submodule
rm -rf "$SUBMODULE_PATH/.git"

# Build the image from the worktree directory
echo "Building Docker image..."
docker build \
  -t fs04_web_v2:$TAG \
  -f "$SCRIPT_DIR/Dockerfile" \
  "$BUILD_DIR"

# Clean up worktree
cd "$PROJECT_ROOT"
git worktree remove "$BUILD_DIR" --force

echo "✓ Successfully built fs04_web_v2:$TAG"
