#!/bin/bash

# ClickHouse Setup Script for FS04
# This script sets up ClickHouse for local development

set -e

echo "=========================================="
echo "ClickHouse Setup for FS04"
echo "=========================================="

# Configuration
CLICKHOUSE_CONTAINER="clickhouse-server"
CLICKHOUSE_PASSWORD="clickhouse123"
CLICKHOUSE_DATA_DIR="$HOME/clickhouse-data"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if ClickHouse container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CLICKHOUSE_CONTAINER}$"; then
    echo "⚠️  ClickHouse container already exists."
    
    # Check if it's running
    if docker ps --format '{{.Names}}' | grep -q "^${CLICKHOUSE_CONTAINER}$"; then
        echo "✅ ClickHouse is already running."
    else
        echo "🔄 Starting existing ClickHouse container..."
        docker start $CLICKHOUSE_CONTAINER
        echo "✅ ClickHouse started."
    fi
else
    echo "📦 Creating ClickHouse data directory..."
    mkdir -p "$CLICKHOUSE_DATA_DIR"

    echo "🚀 Starting ClickHouse container..."
    docker run -d \
        --name $CLICKHOUSE_CONTAINER \
        -p 8123:8123 \
        -p 9000:9000 \
        -v "$CLICKHOUSE_DATA_DIR:/var/lib/clickhouse" \
        -e CLICKHOUSE_USER=default \
        -e CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD \
        -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
        clickhouse/clickhouse-server:latest

    echo "⏳ Waiting for ClickHouse to be ready..."
    sleep 5
fi

# Wait for ClickHouse to be ready
echo "⏳ Checking ClickHouse connection..."
for i in {1..30}; do
    if docker exec $CLICKHOUSE_CONTAINER clickhouse-client --password $CLICKHOUSE_PASSWORD -q "SELECT 1" > /dev/null 2>&1; then
        echo "✅ ClickHouse is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ ClickHouse failed to start. Check logs with: docker logs $CLICKHOUSE_CONTAINER"
        exit 1
    fi
    sleep 1
done

# Initialize database and tables
echo "📊 Initializing database and tables..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
docker exec -i $CLICKHOUSE_CONTAINER clickhouse-client --password $CLICKHOUSE_PASSWORD < "$SCRIPT_DIR/clickhouse-init.sql"

echo ""
echo "=========================================="
echo "✅ ClickHouse Setup Complete!"
echo "=========================================="
echo ""
echo "Connection Details:"
echo "  URL:      http://localhost:8123"
echo "  User:     default"
echo "  Password: $CLICKHOUSE_PASSWORD"
echo "  Database: fs04"
echo ""
echo "Add these to your .env file:"
echo ""
echo "  CLICKHOUSE_URL=http://localhost:8123"
echo "  CLICKHOUSE_USER_NAME=default"
echo "  CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD"
echo "  CLICKHOUSE_DATABASE=fs04"
echo ""
echo "To check ClickHouse status:"
echo "  docker logs $CLICKHOUSE_CONTAINER"
echo ""
echo "To stop ClickHouse:"
echo "  docker stop $CLICKHOUSE_CONTAINER"
echo ""
echo "To remove ClickHouse completely:"
echo "  docker rm -f $CLICKHOUSE_CONTAINER"
echo "  rm -rf $CLICKHOUSE_DATA_DIR"
echo ""
