import type { Handle } from "@sveltejs/kit";
import redis from "$lib/server/redis";
import { building } from "$app/environment";
import { whatsAppAccountManager } from "$lib/server/whatsapp/WhatsAppAccountManager";
import { authMiddleware } from "$lib/server/auth/middleware";
import { pushpinMiddleware } from "$lib/server/pushpin/middleware";
import { websocketMiddleware } from "$lib/server/websocket/middleware";
import { logger } from "$lib/server/logger";
import { ensureActiveSetting } from "$lib/server/settings";

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
        } catch (error) {
            logger.error('Error in WhatsApp initialization process', { error: error.message, stack: error.stack });
        }
    })();
}

// Device manager middleware to add deviceManager to locals
// const deviceManagerMiddleware: Handle = async ({ event, resolve }) => {
//     // Add deviceManager to locals
//     event.locals.deviceManager = DeviceManager;

//     return resolve(event);
// };

// Combine middleware functions
export const handle: Handle = async ({ event, resolve }) => {
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
    event.locals.ipAddress = ip;

    // Chain the middleware functions properly
    // First apply auth middleware, then pushpin middleware if needed
    return authMiddleware({
        event,
        resolve: async (authEvent) => {
            // After auth middleware, apply pushpin middleware if Redis is available
            if (redis) {
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
            // If no Redis, apply WebSocket middleware directly after auth
            return websocketMiddleware({
                event: authEvent,
                resolve
            });
        }
    });



    // Use auth middleware
    return authMiddleware({event, resolve});
};
