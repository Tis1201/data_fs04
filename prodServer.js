// Simple production server that works with SvelteKit and WebSockets
import { createServer } from 'http';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the handler from the build directory
const { handler: svelteHandler } = await import('./build/handler.js');

// Create a custom handler with security headers and CSRF protection
const handler = (req, res) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Only set strict CSP for non-WebSocket requests
  if (req.headers.upgrade !== 'websocket') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
  }
  
  // Skip CSRF checks for WebSocket connections and non-mutating methods
  const isWebSocketRequest = req.headers.upgrade === 'websocket';
  const isSafeMutation = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
  
  if (isWebSocketRequest || isSafeMutation) {
    return svelteHandler(req, res);
  }
  
  // Simple CSRF check for mutating requests (POST, PUT, DELETE, etc.)
  // This checks if the origin header matches the host header
  const origin = req.headers.origin;
  const host = req.headers.host;
  
  if (origin) {
    // Extract hostname from origin
    const originHost = new URL(origin).host;
    
    // Allow same-origin requests
    if (originHost === host) {
      return svelteHandler(req, res);
    }
    
    // Reject cross-origin requests
    res.statusCode = 403;
    res.end('CSRF validation failed: Origin does not match host');
    return;
  }
  
  // Pass to SvelteKit handler for requests without origin header
  // This handles API requests from non-browser clients
  return svelteHandler(req, res);
};

// Create HTTP server
const server = createServer(handler);

// Initialize WebSocket server if available
let wsInitialized = false;
try {
  // Try to dynamically find WebSocket utilities
  let webSocketUtils;
  let importError;
  
  // First, try to find WebSocket utilities in the build directory
  try {
    const fs = await import('fs');
    const buildChunksDir = './build/server/chunks';
    
    if (fs.existsSync(buildChunksDir)) {
      // Find any file with WebSocket in the name
      const files = fs.readdirSync(buildChunksDir)
        .filter(file => file.includes('WebSocket') && file.endsWith('.js'));
      
      if (files.length > 0) {
        const wsPath = `${buildChunksDir}/${files[0]}`;
        console.log(`Found WebSocket utilities in build: ${wsPath}`);
        webSocketUtils = await import(wsPath);
      }
    }
  } catch (e) {
    console.log('Error finding WebSocket utilities in build:', e.message);
  }
  
  // Only use the build directory, no fallbacks
  if (!webSocketUtils) {
    console.log('WebSocket utilities not found in build directory');
    throw new Error('WebSocket utilities not found in build directory');
  }
  
  if (!webSocketUtils) {
    console.log('Import error details:', importError);
    throw new Error('Could not find WebSocket utilities in any expected location');
  }
  
  // Initialize WebSocket server
  // Handle both original and bundled export formats
  if (webSocketUtils.createWSSGlobalInstance) {
    // Original source format
    webSocketUtils.createWSSGlobalInstance();
    server.on('upgrade', webSocketUtils.onHttpServerUpgrade);
    wsInitialized = true;
  } else if (webSocketUtils.s) {
    // Bundled format - s is startupWebsocketServer
    webSocketUtils.s();
    
    // We need to manually set up the upgrade handler since it's not exported
    // Use the global instance from the symbol
    const wss = global[webSocketUtils.G];
    if (wss) {
      server.on('upgrade', (req, socket, head) => {
        const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : null;
        if (pathname !== '/websocket') return;
        
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      });
      wsInitialized = true;
    }
  }
  
  if (wsInitialized) {
    console.log('WebSocket server initialized successfully');
  } else {
    throw new Error('Could not initialize WebSocket server with the available exports');
  }
} catch (error) {
  console.log('WebSocket initialization failed:', error.message);
  console.log('Continuing without WebSocket support');
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server started at http://localhost:${PORT}`);
  if (wsInitialized) {
    console.log(`WebSocket server available at ws://localhost:${PORT}/websocket`);
  } else {
    console.log('WebSocket server is NOT available - running in HTTP-only mode');
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
