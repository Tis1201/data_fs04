// Simple production server that works with SvelteKit and WebSockets
import { createServer } from 'http';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Import the handler from the build directory
const { handler: svelteHandler } = await import('./build/handler.js');

// Simple handler - let nginx and SvelteKit handle everything
const handler = (req, res) => {
  // Just pass everything to SvelteKit - nginx handles security and proxying
  return svelteHandler(req, res);
};

// Create HTTP server
const server = createServer(handler);

// Initialize WebSocket server - SIMPLE APPROACH
let wsInitialized = false;
try {
  console.log('[WS] Initializing WebSocket server...');
  
  // Import WebSocket utilities directly from the hooks.server file
  const fs = await import('fs');
  const buildChunksDir = './build/server/chunks';
  
  // Find the hooks.server file
  const files = fs.readdirSync(buildChunksDir);
  const hooksFile = files.find(file => file.includes('hooks.server'));
  
  if (hooksFile) {
    console.log(`[WS] Found hooks.server file: ${hooksFile}`);
    
    try {
      // Import the hooks.server file which contains WebSocket utilities
      const hooksPath = `${buildChunksDir}/${hooksFile}`;
      const webSocketUtils = await import(hooksPath);
      
      console.log('[WS] WebSocket utilities imported:', Object.keys(webSocketUtils).join(', '));
      
      // Try to find the WebSocket functions in the imported module
      if (webSocketUtils.startupWebsocketServer) {
        console.log('[WS] Using startupWebsocketServer function');
        webSocketUtils.startupWebsocketServer();
        
        // Set up upgrade handler
        if (webSocketUtils.onHttpServerUpgrade) {
          server.on('upgrade', webSocketUtils.onHttpServerUpgrade);
          wsInitialized = true;
          console.log('[WS] WebSocket server initialized successfully');
        }
      } else {
        console.log('[WS] startupWebsocketServer function not found, trying alternative approach');
        
        // Alternative: Set up basic WebSocket server manually
        const { WebSocketServer } = await import('ws');
        const wss = new WebSocketServer({ noServer: true });
        
        server.on('upgrade', (req, socket, head) => {
          const pathname = req.url ? new URL(req.url, 'http://localhost').pathname : null;
          console.log(`[WS] Upgrade request for: ${pathname}`);
          
          if (pathname !== '/websocket') return;
          
          wss.handleUpgrade(req, socket, head, (ws) => {
            console.log('[WS] WebSocket connection established');
            
            ws.on('message', (data) => {
              console.log('[WS] Received message:', data.toString());
            });
            
            ws.on('close', () => {
              console.log('[WS] WebSocket connection closed');
            });
            
            ws.on('error', (err) => {
              console.error('[WS] WebSocket error:', err.message);
            });
          });
        });
        
        wsInitialized = true;
        console.log('[WS] Basic WebSocket server initialized successfully');
      }
    } catch (err) {
      console.error('[WS] Failed to import hooks.server:', err.message);
    }
  } else {
    console.log('[WS] hooks.server file not found');
  }
  
} catch (error) {
  console.log('[WS] WebSocket initialization failed:', error.message);
  console.log('[WS] Continuing without WebSocket support');
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


