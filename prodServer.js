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

// Start the server
const PORT = process.env.PORT || 5173;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server started at http://localhost:${PORT}`);
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
