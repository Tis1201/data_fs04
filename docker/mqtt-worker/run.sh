#!/bin/bash
set -e

# Configuration
IMAGE_NAME="fs04-web-mqtt-worker"
CONTAINER_NAME="fs04-web-mqtt-worker"

# Get the script's directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"

# Check if .env file exists
ENV_FILE="$PROJECT_ROOT/.env"
ENV_OPTS="--env LOG_LEVEL=debug"

if [ -f "$ENV_FILE" ]; then
  echo "Found .env file at $ENV_FILE"
  
  # Initialize array for options
  ENV_OPTS=("--env-file" "$ENV_FILE")

  # Grep for localhost/127.0.0.1, replace with host.docker.internal, and append as -e overrides
  while IFS= read -r line; do
    # Strip carriage returns (CR) if present, handling Windows line endings
    line="${line//$'\r'/}"
    
    if [[ ! "$line" =~ ^# ]] && [[ "$line" == *"localhost"* || "$line" == *"127.0.0.1"* ]]; then
        # Split into key and value
        key="${line%%=*}"
        value="${line#*=}"
        
        # Strip surrounding quotes from value if present
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"
        
        # Replace localhost/127.0.0.1
        value="${value//localhost/host.docker.internal}"
        value="${value//127.0.0.1/host.docker.internal}"
        
        echo "Overriding: $key=$value"
        ENV_OPTS+=("-e" "$key=$value")
    fi
  done < <(grep -E 'localhost|127.0.0.1' "$ENV_FILE")
  
  # Also force LOG_LEVEL=debug for now
  ENV_OPTS+=("-e" "LOG_LEVEL=debug")

else
  echo "Warning: .env file not found."
  ENV_OPTS=("-e" "LOG_LEVEL=debug")
fi

echo "Starting container: $CONTAINER_NAME"

# Stop previous
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Run
docker run -d --name $CONTAINER_NAME \
  --add-host host.docker.internal:host-gateway \
  "${ENV_OPTS[@]}" \
  $IMAGE_NAME

echo "Container started."
docker logs -f $CONTAINER_NAME
