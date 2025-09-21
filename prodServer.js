// Production server with proper WebSocket upgrade handling
import { createServer } from 'http';
import { handler } from './build/handler.js';

// Import WebSocket utilities from the built chunks
import { onHttpServerUpgrade } from './build/server/chunks/hooks.server-CzJY9uOB.js';

// Create HTTP server
const server = createServer(handler);

// Set up WebSocket upgrade handler
// The middleware will handle WebSocket server initialization when needed
server.on('upgrade', onHttpServerUpgrade);

console.log('[WS] WebSocket upgrade handler set up');

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