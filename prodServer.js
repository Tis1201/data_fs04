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
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;");
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

  // First, try to find WebSocket utilities in the build directory
  const fs = await import('fs');
  const buildDir = './build';

  async function findWebSocketUtilsPath(buildDir) {
    const buildChunksDir = `${buildDir}/server/chunks`;

    if (fs.existsSync(buildChunksDir)) {
      const files = fs.readdirSync(buildChunksDir);

      // First, try to find WebSocketUtils.js directly
      const exactMatch = files.find(file => file.startsWith('WebSocketUtils'));
      if (exactMatch) {
        return `${buildChunksDir}/${exactMatch}`;
      }

      // Otherwise, look for any file containing WebSocket
      for (const file of files) {
        if (file.includes('WebSocket') && file.endsWith('.js')) {
          try {
            const wsPath = `${buildChunksDir}/${file}`;
            const content = fs.readFileSync(wsPath, 'utf8');

            // Check if the file contains key WebSocket functions
            if (content.includes('startupWebsocketServer') ||
                content.includes('onHttpServerUpgrade') ||
                content.includes('GlobalThisWSS')) {
              return wsPath;
            }
          } catch (e) {
            console.error(`Error checking ${file}:`, e.message);
          }
        }
      }
    }

    return null;
  }

  async function findModulePath(buildDir, moduleName) {
    const buildChunksDir = `${buildDir}/server/chunks`;

    if (fs.existsSync(buildChunksDir)) {
      const files = fs.readdirSync(buildChunksDir);

      // First, try to find exact module name
      const exactMatch = files.find(file => file.startsWith(moduleName));
      if (exactMatch) {
        return `${buildChunksDir}/${exactMatch}`;
      }

      // Otherwise, look for any file containing the module name
      for (const file of files) {
        if (file.includes(moduleName) && file.endsWith('.js')) {
          try {
            const modulePath = `${buildChunksDir}/${file}`;
            const content = fs.readFileSync(modulePath, 'utf8');

            // Check if the file contains key functions or exports related to the module
            if (content.includes(`export function add${moduleName.replace('Manager', '')}`) ||
                content.includes(`export const ${moduleName.toLowerCase()}`) ||
                content.includes(`export * from './${moduleName}'`)) {
              return modulePath;
            }
          } catch (e) {
            console.error(`Error checking ${file}:`, e.message);
          }
        }
      }
    }

    return null;
  }

  // Find WebSocket utilities path
  const wsUtilsPath = await findWebSocketUtilsPath(buildDir);
  const wsManagerPath = await findModulePath(buildDir, 'WSManager');

  if (wsUtilsPath) {
    console.log(`Found WebSocket utilities at: ${wsUtilsPath}`);

    // Import the WebSocket utilities
    webSocketUtils = await import(wsUtilsPath);
    console.log('WebSocket utilities imported:', Object.keys(webSocketUtils).join(', '));
  } else {
    console.log('WebSocket utilities not found in build directory');
  }

  // Import WSManager if found
  if (wsManagerPath) {
    console.log(`Found WSManager at: ${wsManagerPath}`);
    try {
      const wsManager = await import(wsManagerPath);
      console.log('WSManager imported:', Object.keys(wsManager).join(', '));
    } catch (err) {
      console.error('Failed to import WSManager:', err);
    }
  }

  if (webSocketUtils && webSocketUtils.createWSSGlobalInstance) {
    console.log('Using original source format WebSocket utilities');
    webSocketUtils.createWSSGlobalInstance();
    server.on('upgrade', webSocketUtils.onHttpServerUpgrade);
    wsInitialized = true;
  } else if (webSocketUtils && webSocketUtils.s) {
    console.log('Using bundled format WebSocket utilities');
    // Bundled format - s is startupWebsocketServer
    webSocketUtils.s();

    // Find the global symbol
    const globalSymbol = webSocketUtils.G;
    console.log('Global symbol found:', !!globalSymbol);

    if (globalSymbol) {
      // We need to manually set up the upgrade handler
      const wss = global[globalSymbol];
      console.log('WebSocket server instance found:', !!wss);

      if (wss) {
        // Track WebSocket clients
        const wsClients = new Map();
        let wsClientCounter = 0;

        // Set up periodic logging of client count
        setInterval(() => {
          console.log(`[WS] Current connected clients: ${wsClients.size}`);

          // Log client details in verbose mode
          if (wsClients.size > 0) {
            for (const [id, client] of wsClients.entries()) {
              console.log(`[WS] Client ${id} (${client.sessionId || 'no-session'})`);
            }
          }
        }, 5000);

        server.on('upgrade', (req, socket, head) => {
          const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : null;
          console.log(`Upgrade request for: ${pathname}`);

          if (pathname !== '/websocket') return;

          wss.handleUpgrade(req, socket, head, (ws) => {
            // Add client tracking
            const clientId = `ws-${Date.now()}-${++wsClientCounter}`;

            // Extract session ID from cookies if available
            let sessionId = null;
            if (req.headers.cookie) {
              const cookies = req.headers.cookie.split(';').map(c => c.trim());
              const sessionCookie = cookies.find(c => c.startsWith('auth_session='));
              if (sessionCookie) {
                sessionId = sessionCookie.split('=')[1];
              }
            }

            // Add client to tracking map
            Object.assign(ws, { id: clientId, sessionId });
            wsClients.set(clientId, ws);

            // Attempt to register with WSManager directly
            // This is a workaround to ensure both tracking systems are in sync
            try {
              // WSManager expects clients to have these properties
              ws.userId = sessionId; // Use sessionId as userId for tracking

              // Access the global clients Map from WSManager
              // This is hacky but necessary to ensure proper tracking
              const globalClients = global.__WS_CLIENTS_MAP__;
              if (globalClients && typeof globalClients.set === 'function') {
                globalClients.set(clientId, ws);
                console.log(`[WS] Client ${clientId} registered with global WSManager`);
              } else {
                // Create global tracking if it doesn't exist
                global.__WS_CLIENTS_MAP__ = wsClients;
                console.log(`[WS] Created global WSManager tracking with ${wsClients.size} clients`);
              }
            } catch (err) {
              console.error(`[WS] Failed to register with WSManager:`, err);
            }

            console.log(`WebSocket connection established: ${clientId} (Total: ${wsClients.size})`);

            // Handle disconnection
            ws.on('close', () => {
              if (wsClients.delete(clientId)) {
                console.log(`WebSocket client disconnected: ${clientId} (Remaining: ${wsClients.size})`);

                // Also remove from global WSManager tracking if it exists
                try {
                  const globalClients = global.__WS_CLIENTS_MAP__;
                  if (globalClients && typeof globalClients.delete === 'function') {
                    globalClients.delete(clientId);
                    console.log(`[WS] Client ${clientId} unregistered from global WSManager (Remaining: ${globalClients.size})`);
                  }
                } catch (err) {
                  console.error(`[WS] Failed to unregister from WSManager:`, err);
                }
              }
            });

            // Handle errors
            ws.on('error', (err) => {
              console.error(`WebSocket error for client ${clientId}:`, err.message);
            });

            // Add message handler to log incoming messages
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                console.log(`[WS] Received message from client ${clientId}:`, JSON.stringify(message));
              } catch (err) {
                console.log(`[WS] Received non-JSON message from client ${clientId}:`, data.toString());
              }
            });

            // Emit the connection event
            wss.emit('connection', ws, req);
          });
        });
        wsInitialized = true;
      } else {
        throw new Error('WebSocket server instance not found in global');
      }
    } else {
      throw new Error('WebSocket global symbol not found');
    }
  } else {
    throw new Error('No valid WebSocket initialization method found');
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


