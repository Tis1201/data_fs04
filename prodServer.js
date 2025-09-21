// Production server with proper WebSocket upgrade handling
import { createServer } from 'http';
import { handler } from './build/handler.js';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';

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
    const { onHttpServerUpgrade } = await import(hooksPath);
    
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
const PORT = process.env.PORT || 3000;
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