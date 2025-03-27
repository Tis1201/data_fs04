#!/bin/bash

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js before running this script."
    exit 1
fi

# Set production environment
export NODE_ENV=production

# Start the server
echo "Starting production server..."
node ./prodServer.js
