import type { Handle } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import redis from "$lib/server/redis";
import { building } from "$app/environment";
import { whatsAppAccountManager } from "$lib/server/whatsapp/WhatsAppAccountManager";
import { authMiddleware } from "$lib/server/auth/middleware";
import { pushpinMiddleware } from "$lib/server/pushpin/middleware";
import { websocketMiddleware } from "$lib/server/websocket/middleware";
import { startupWebsocketServer, onHttpServerUpgrade } from "$lib/server/websocket/WebSocketUtils";
import { logger } from "$lib/server/logger";
import { ensureActiveSetting } from "$lib/server/settings";
import prisma from "$lib/server/prisma";
import { startBundleAutoPublishScheduler } from "$lib/server/scheduler/bundleScheduler";
import { _publishBundleDirect } from "./routes/api/admin/iot/bundles/[id]/publish/+server";
import { startFileStatusPoller, cleanupFileStatusPoller } from "$lib/server/scheduler/fileStatusPoller";

// Initialize WhatsApp clients on server startup (not during build)
// Use a self-executing async function to avoid blocking the main thread
if (!building) {
    logger.info('STARTING WHATSAPP CLIENT INITIALIZATION FROM HOOKS');

    // Use a non-blocking approach with Promise
    (async () => {
        try {
            // Delay initialization without blocking
            await new Promise(resolve => setTimeout(resolve, 1000));

            logger.info('DELAYED WHATSAPP CLIENT INITIALIZATION');

            // Initialize WhatsApp clients from database
            logger.info('Loading WhatsApp clients from database...');
            await whatsAppAccountManager.initializeClientsFromDatabase();

            await ensureActiveSetting();
            logger.info('WhatsAppAccountManager is ready');

            // Start bundle auto-publish scheduler
            try {
                startBundleAutoPublishScheduler(prisma as any, async (bundleId: string) => _publishBundleDirect(prisma as any, bundleId));
                logger.info('Bundle auto-publish scheduler started');
            } catch (e:any) {
                logger.warn(`Failed to start auto-publish scheduler: ${e?.message || String(e)}`);
            }

            // Start file-backed status poller (ClickHouse simulation)
            try {
                await startFileStatusPoller();
                logger.info('File status poller started');
            } catch (e:any) {
                logger.warn(`Failed to start file status poller: ${e?.message || String(e)}`);
            }
        } catch (error: unknown) {
            const e = error as any;
            logger.error('Error in WhatsApp initialization process', { error: e?.message, stack: e?.stack });
        }
    })();
}

// Device manager middleware to add deviceManager to locals
// const deviceManagerMiddleware: Handle = async ({ event, resolve }) => {
//     // Add deviceManager to locals
//     event.locals.deviceManager = DeviceManager;

//     return resolve(event);
// };

// Custom body size limit (in bytes) - respect BODY_SIZE_LIMIT environment variable
const getMaxBodySize = () => {
    const envLimit = process.env.BODY_SIZE_LIMIT;
    if (envLimit === '0') {
        return 0; // No limit
    }
    if (envLimit) {
        // Parse environment variable (e.g., "10mb", "20MB", "1048576")
        const match = envLimit.match(/^(\d+(?:\.\d+)?)\s*(mb|kb|gb|b)?$/i);
        if (match) {
            const value = parseFloat(match[1]);
            const unit = (match[2] || 'b').toLowerCase();
            switch (unit) {
                case 'gb': return value * 1024 * 1024 * 1024;
                case 'mb': return value * 1024 * 1024;
                case 'kb': return value * 1024;
                case 'b': return value;
                default: return 1000 * 1024 * 1024;
            }
        }
    }
    return 1000 * 1024 * 1024;
};

const MAX_BODY_SIZE = getMaxBodySize();

// Combine middleware functions
export const handle: Handle = async ({ event, resolve }) => {
    // Custom body size check for large payloads (like screenshots)
    // Skip check if BODY_SIZE_LIMIT=0 (no limit) or for WebSocket upgrade requests
    if (MAX_BODY_SIZE > 0 && !event.request.headers.get('upgrade')) {
        const contentLength = event.request.headers.get('content-length');
        if (contentLength) {
            const length = parseInt(contentLength, 10);
            if (length > MAX_BODY_SIZE) {
                logger.warn(`Request body too large: ${length} bytes (max: ${MAX_BODY_SIZE} bytes)`);
                throw error(413, 'Request body too large');
            }
        }
    }

    // Handle .well-known/appspecific routes
    if (event.url.pathname.startsWith('/.well-known/appspecific')) {
        // Return an empty response for any .well-known/appspecific path
        // This avoids the 404 error for chrome devtools and similar requests
        return new Response('', {
            status: 200,
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    }

    // Add redis client to locals if available
    if (redis) {
        event.locals.redis = redis;
    }

    const forwardedFor = event.request.headers.get('x-forwarded-for');
    const ip = forwardedFor?.split(',')[0]?.trim() || event.getClientAddress();
    (event.locals as any).ipAddress = ip;

    // Chain the middleware functions properly
    // First apply auth middleware, then pushpin middleware if enabled
    return authMiddleware({
        event,
        resolve: async (authEvent) => {
            // Respect REALTIME_TRANSPORT env for enabling Pushpin
            const enablePushpin = String(process.env.REALTIME_TRANSPORT || 'sse').toLowerCase() === 'pushpin';
            if (redis && enablePushpin) {
                return pushpinMiddleware({
                    event: authEvent,
                    resolve: async (pushpinEvent) => {
                        // After pushpin middleware, apply WebSocket middleware
                        return websocketMiddleware({
                            event: pushpinEvent,
                            resolve
                        });
                    }
                });
            }
            // If Pushpin disabled or no Redis, apply WebSocket middleware directly after auth
            return websocketMiddleware({
                event: authEvent,
                resolve
            });
        }
    });



    // Use auth middleware
    return authMiddleware({event, resolve});
};

// Export WebSocket utilities for use in production server
export { startupWebsocketServer, onHttpServerUpgrade };
