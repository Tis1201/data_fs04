#!/bin/bash
set -e

# Configuration
PROJECT_NAME="fs04-web"

# Display banner
echo "====================================="
echo "FS04 Web App Docker Compose Runner"
echo "====================================="

# Functions
function show_help {
  echo "Usage: ./compose.sh [OPTION]"
  echo ""
  echo "Options:"
  echo "  up           Start the containers in detached mode"
  echo "  up:dev       Start the containers in development mode"
  echo "  up:seed      Start with migrations and seed data"
  echo "  down         Stop and remove containers"
  echo "  logs         View container logs"
  echo "  ps           Show container status"
  echo "  build        Rebuild the containers"
  echo "  restart      Restart the containers"
  echo "  exec         Execute a command in the container"
  echo "  help         Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./compose.sh up:seed    # Start with migrations and create admin user"
  echo "  ./compose.sh up         # Start the containers"
  echo "  ./compose.sh down       # Stop and remove containers"
  echo "  ./compose.sh logs       # View container logs"
  echo "  ./compose.sh exec bash  # Open a shell in the container"
}

# Check if .env file exists
if [ ! -f "../.env" ]; then
  echo "Error: .env file not found in the project root directory."
  echo "Please create an .env file before running this script."
  exit 1
fi

# Process command line arguments
case "$1" in
  up)
    echo "Starting containers in detached mode..."
    docker-compose -p $PROJECT_NAME up -d
    ;;
  up:dev)
    echo "Starting containers in development mode..."
    docker-compose -p $PROJECT_NAME up
    ;;
  up:seed)
    echo "Starting containers with migrations and seed data..."
    echo "IMPORTANT: This will create an admin user (admin@example.com / admin123)"
    echo "IMPORTANT: Save the API key displayed in the logs for WebSocket testing!"
    docker-compose -p $PROJECT_NAME up -d
    docker-compose -p $PROJECT_NAME exec fs04-web-app bash -c "RUN_MIGRATIONS=true RUN_SEED=true ./start.sh"
    ;;
  down)
    echo "Stopping and removing containers..."
    docker-compose -p $PROJECT_NAME down
    ;;
  logs)
    echo "Viewing container logs..."
    docker-compose -p $PROJECT_NAME logs -f
    ;;
  ps)
    echo "Showing container status..."
    docker-compose -p $PROJECT_NAME ps
    ;;
  build)
    echo "Rebuilding containers..."
    docker-compose -p $PROJECT_NAME build
    ;;
  restart)
    echo "Restarting containers..."
    docker-compose -p $PROJECT_NAME restart
    ;;
  exec)
    if [ -z "$2" ]; then
      echo "Error: Command to execute is required."
      echo "Usage: ./compose.sh exec COMMAND"
      exit 1
    fi
    echo "Executing command in container: $2"
    docker-compose -p $PROJECT_NAME exec fs04-web-app ${@:2}
    ;;
  help)
    show_help
    ;;
  *)
    show_help
    exit 1
    ;;
esac

exit 0
