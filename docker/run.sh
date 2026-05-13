#!/bin/bash
set -e

# Configuration
IMAGE_NAME="fs04-web-app"
CONTAINER_NAME="fs04-web-app"
PORT=80

# Display banner
echo "====================================="
echo "FS04 Web App Docker Runner"
echo "====================================="

# Functions
function show_help {
  echo "Usage: ./run.sh [OPTION]"
  echo ""
  echo "Options:"
  echo "  start         Start the container (without migrations)"
  echo "  start:init    Start the container with migrations (recommended for first run)"
  echo "  start:migrate Start the container with migrations (same as start:init)"
  echo "  start:seed    Start the container with migrations and seed data (creates admin user)"
  echo "  debug         Run the container in foreground for debugging"
  echo "  debug:init    Run in foreground with migrations (recommended for first run)"
  echo "  debug:migrate Run in foreground with migrations (same as debug:init)"
  echo "  debug:seed    Run in foreground with migrations and seed data (creates admin user)"
  echo "  stop          Stop the running container"
  echo "  logs          View container logs"
  echo "  shell         Open a shell in the running container"
  echo "  restart       Restart the container"
  echo "  status        Check container status"
  echo "  help          Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./run.sh start:seed    # First run: Start with migrations and create admin user"
  echo "  ./run.sh start:init    # First run: Start with migrations only"
  echo "  ./run.sh start         # Subsequent runs: Start without migrations"
  echo "  ./run.sh debug:seed    # Debug with migrations and admin user creation"
  echo "  ./run.sh debug         # Debug without migrations"
}

function run_container {
  MIGRATE=$1
  SEED=$2
  FOREGROUND=$3
  
  # Stop container if already running
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm $CONTAINER_NAME 2>/dev/null || true
  
  # Get the script's directory
  SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
  # Get the project root directory (parent of script directory)
  PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." &> /dev/null && pwd )"
  
  # Set environment variables
  ENV_OPTS=""
  if [ "$MIGRATE" = "true" ]; then
    ENV_OPTS="$ENV_OPTS -e RUN_MIGRATIONS=true"
  fi
  if [ "$SEED" = "true" ]; then
    ENV_OPTS="$ENV_OPTS -e RUN_SEED=true"
  fi
  
  # Check if .env file exists
  ENV_FILE="$PROJECT_ROOT/.env"
  if [ -f "$ENV_FILE" ]; then
    echo "Found .env file at $ENV_FILE"
    ENV_FILE_OPT="--env-file $ENV_FILE"
  else
    echo "Warning: .env file not found. Using default environment variables."
    ENV_FILE_OPT=""
  fi
  
  # Set up volume mounts for database persistence
  VOLUME_OPTS=""
  
  # Mount the .env file directly
  if [ -f "$ENV_FILE" ]; then
    VOLUME_OPTS="$VOLUME_OPTS -v $ENV_FILE:/app/.env:ro"
  fi
  
  # Create a volume for the database if it doesn't exist
  DB_VOLUME="${CONTAINER_NAME}_db_data"
  docker volume inspect $DB_VOLUME >/dev/null 2>&1 || docker volume create $DB_VOLUME
  VOLUME_OPTS="$VOLUME_OPTS -v $DB_VOLUME:/app/prisma"
  
  echo "Starting container: $CONTAINER_NAME"
  echo "Port mapping: $PORT:$PORT"
  if [ "$MIGRATE" = "true" ]; then
    echo "Running with migrations enabled"
  fi
  if [ "$SEED" = "true" ]; then
    echo "Running with seed data enabled"
    echo "IMPORTANT: This will create an admin user (admin@example.com / admin123)"
    echo "IMPORTANT: Save the API key displayed in the logs for WebSocket testing!"
  fi
  
  if [ "$FOREGROUND" = "true" ]; then
    echo "Running container in foreground mode for debugging..."
    docker run --rm --name $CONTAINER_NAME \
      -p $PORT:$PORT \
      $ENV_FILE_OPT \
      $ENV_OPTS \
      $VOLUME_OPTS \
      $IMAGE_NAME
  else
    docker run -d --name $CONTAINER_NAME \
      -p $PORT:$PORT \
      $ENV_FILE_OPT \
      $ENV_OPTS \
      $VOLUME_OPTS \
      $IMAGE_NAME
    
    echo "Container started!"
    echo "Access the application at: http://localhost"
    echo "To view logs: ./run.sh logs"
  fi
}

function stop_container {
  echo "Stopping container: $CONTAINER_NAME"
  docker stop $CONTAINER_NAME 2>/dev/null || echo "Container not running"
}

function view_logs {
  echo "Viewing logs for container: $CONTAINER_NAME"
  docker logs -f $CONTAINER_NAME
}

function open_shell {
  echo "Opening shell in container: $CONTAINER_NAME"
  docker exec -it $CONTAINER_NAME /bin/sh
}

function restart_container {
  echo "Restarting container: $CONTAINER_NAME"
  docker restart $CONTAINER_NAME 2>/dev/null || echo "Container not running"
}

function check_status {
  echo "Checking status of container: $CONTAINER_NAME"
  RUNNING=$(docker ps -q -f name=$CONTAINER_NAME)
  if [ -n "$RUNNING" ]; then
    echo "Container is running"
    docker ps -f name=$CONTAINER_NAME
  else
    echo "Container is not running"
    STOPPED=$(docker ps -a -q -f name=$CONTAINER_NAME)
    if [ -n "$STOPPED" ]; then
      echo "Container exists but is stopped:"
      docker ps -a -f name=$CONTAINER_NAME
    else
      echo "Container does not exist"
    fi
  fi
}

# Make script executable
chmod +x "$0"

# Process arguments
case "$1" in
  start)
    run_container "false" "false" "false"
    ;;
  start:init|start:migrate)
    run_container "true" "false" "false"
    ;;
  start:seed)
    run_container "true" "true" "false"
    ;;
  debug)
    run_container "false" "false" "true"
    ;;
  debug:init|debug:migrate)
    run_container "true" "false" "true"
    ;;
  debug:seed)
    run_container "true" "true" "true"
    ;;
  stop)
    stop_container
    ;;
  logs)
    view_logs
    ;;
  shell)
    open_shell
    ;;
  restart)
    restart_container
    ;;
  status)
    check_status
    ;;
  help|*)
    show_help
    ;;
esac
