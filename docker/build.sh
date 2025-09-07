#!/bin/bash
set -e

# Configuration
IMAGE_NAME="fs04-web-app"
CONTAINER_NAME="fs04-web-app"
PORT=80

# Display banner
echo "====================================="
echo "FS04 Web App Docker Build & Run Tool"
echo "====================================="

# Functions
function show_help {
  echo "Usage: ./build.sh [OPTION]"
  echo ""
  echo "Options:"
  echo "  build         Build the Docker image"
  echo "  prune         Clean up Docker system (removes unused images, containers, etc.)"
  echo "  run           Run the container (without migrations)"
  echo "  run:migrate   Run the container with migrations"
  echo "  run:seed      Run the container with migrations and seed data"
  echo "  stop          Stop the running container"
  echo "  clean         Remove the container and image"
  echo "  help          Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./build.sh build         # Build the Docker image"
  echo "  ./build.sh prune         # Clean up Docker system"
  echo "  ./build.sh run           # Run the container"
  echo "  ./build.sh run:migrate   # Run with migrations"
  echo "  ./build.sh run:seed      # Run with migrations and seed data"
}

function build_image {
  echo "Building Docker image: $IMAGE_NAME"
  # Get the script's directory
  SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
  # Get the project root directory (parent of script directory)
  PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
  
  # Build from the project root using the absolute path to Dockerfile
  cd "$PROJECT_ROOT"
  echo "Building with --no-cache to ensure clean build"
  docker build --no-cache -t $IMAGE_NAME -f "$SCRIPT_DIR/Dockerfile" .
  echo "Build complete!"
}

function run_container {
  MIGRATE=$1
  SEED=$2
  
  # Stop container if already running
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm $CONTAINER_NAME 2>/dev/null || true
  
  # Set environment variables
  ENV_OPTS=""
  if [ "$MIGRATE" = "true" ]; then
    ENV_OPTS="$ENV_OPTS -e RUN_MIGRATIONS=true"
  fi
  if [ "$SEED" = "true" ]; then
    ENV_OPTS="$ENV_OPTS -e RUN_SEED=true"
  fi
  
  # Get the script's directory
  SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
  # Get the project root directory (parent of script directory)
  PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
  
  # Check if .env file exists
  ENV_FILE="$PROJECT_ROOT/.env"
  if [ -f "$ENV_FILE" ]; then
    ENV_FILE_OPT="--env-file $ENV_FILE"
  else
    echo "Warning: .env file not found. Using default environment variables."
    ENV_FILE_OPT=""
  fi
  
  echo "Starting container: $CONTAINER_NAME"
  echo "Port mapping: $PORT:3000"
  if [ "$MIGRATE" = "true" ]; then
    echo "Running with migrations enabled"
  fi
  if [ "$SEED" = "true" ]; then
    echo "Running with seed data enabled"
    echo "IMPORTANT: Save the API key displayed in the logs!"
  fi
  
  docker run -d --name $CONTAINER_NAME \
    -p $PORT:3000 \
    $ENV_FILE_OPT \
    $ENV_OPTS \
    $IMAGE_NAME
  
  echo "Container started! Showing logs:"
  docker logs -f $CONTAINER_NAME
}

function stop_container {
  echo "Stopping container: $CONTAINER_NAME"
  docker stop $CONTAINER_NAME 2>/dev/null || echo "Container not running"
}

function clean {
  echo "Cleaning up..."
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm $CONTAINER_NAME 2>/dev/null || true
  docker rmi $IMAGE_NAME 2>/dev/null || true
  echo "Cleanup complete!"
}

# Make script executable
chmod +x "$0"

function prune_docker {
  echo "Cleaning up Docker system..."
  echo "Removing unused containers..."
  docker container prune -f
  echo "Removing unused images..."
  docker image prune -f
  echo "Removing build cache..."
  docker builder prune -f
  echo "Removing unused volumes..."
  docker volume prune -f
  echo "Docker system cleanup complete!"
}

# Process arguments
case "$1" in
  build)
    build_image
    ;;
  prune)
    prune_docker
    ;;
  run)
    run_container "false" "false"
    ;;
  run:migrate)
    run_container "true" "false"
    ;;
  run:seed)
    run_container "true" "true"
    ;;
  stop)
    stop_container
    ;;
  clean)
    clean
    ;;
  help|*)
    show_help
    ;;
esac
