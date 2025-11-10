// Production server with proper WebSocket upgrade handling
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Only load .env if USE_PUSHPIN is not set (dotenv-cli already loaded it)
if (!process.env.USE_PUSHPIN) {
    try {
        const dotenv = require('dotenv');
        dotenv.config();
        console.log('[Env] Environment variables loaded from .env file (fallback)');
    } catch (error) {
        console.warn('[Env] Could not load .env file:', error.message);
        console.warn('[Env] Make sure to run via "npm run prodServer" or set environment variables');
    }
}

console.log(`[Env] USE_PUSHPIN=${process.env.USE_PUSHPIN || 'not set'}`);

// Import modules (they will have access to env vars)
import { createServer } from 'http';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';

const { handler } = await import('./build/handler.js');

// Create HTTP server
const server = createServer(handler);

// Dynamically find and import WebSocket utilities
async function setupWebSocket() {
  try {
    // Find the hooks.server file (name changes with each build)
    const chunksDir = resolve('./build/server/chunks');
    const files = readdirSync(chunksDir);
    const hooksFile = files.find(file => file.startsWith('hooks.server-') && file.endsWith('.js'));
    
    if (!hooksFile) {
      console.log('[WS] hooks.server file not found, WebSocket will not be available');
      return;
    }
    
    console.log(`[WS] Found hooks.server file: ${hooksFile}`);
    
    // Import the WebSocket utilities using absolute path
    const hooksPath = join(chunksDir, hooksFile);
    const { startupWebsocketServer, onHttpServerUpgrade } = await import(hooksPath);
    
    // Initialize WebSocket server first (required before upgrade handler)
    console.log('[WS] Initializing WebSocket server...');
    startupWebsocketServer();
    console.log('[WS] WebSocket server initialized');
    
    // Set up WebSocket upgrade handler
    server.on('upgrade', onHttpServerUpgrade);
    console.log('[WS] WebSocket upgrade handler set up');
    
  } catch (error) {
    console.log('[WS] Failed to set up WebSocket:', error.message);
    console.log('[WS] WebSocket will not be available');
  }
}

// Set up WebSocket
await setupWebSocket();

// Start the server
const PORT = process.env.PORT || 5173;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server started at http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/websocket`);
});

// Handle graceful shutdown
process.once('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.once('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
