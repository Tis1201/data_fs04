import type { Handle } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import redis from "$lib/server/redis";
import { building } from "$app/environment";
import { whatsAppAccountManager } from "$lib/server/whatsapp/WhatsAppAccountManager";
import { authMiddleware } from "$lib/server/auth/middleware";
import { pushpinMiddleware } from "$lib/server/pushpin/middleware";
// WebSocket middleware removed - all communication now uses SSE
import { logger } from "$lib/server/logger";
import { ensureActiveSetting } from "$lib/server/settings";
import prisma from "$lib/server/prisma";
import { initializeMainProcess } from "$lib/server/processes/main";
import { 
    createRequestContext, 
    enrichRequestContext, 
    formatRequestLog,
    requestContextStore 
} from "$lib/server/context/requestContext";
import { handleDeprecatedEndpoint } from "$lib/server/api/deprecation";

// Initialize main application process (WhatsApp, Device Presence Monitor)
// Note: Bundle and cleanup processes run separately via npm scripts
if (!building) {
    logger.info('🚀 Starting main application process from hooks...');

    // Use a non-blocking approach with Promise
    (async () => {
        try {
            // Delay initialization without blocking
            await new Promise(resolve => setTimeout(resolve, 1000));
            await initializeMainProcess();
        } catch (error: unknown) {
            const e = error as any;
            logger.error('❌ Error in main process initialization', { 
                error: e?.message, 
                stack: e?.stack 
            });
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
    // Create request context for tracking and debugging
    const requestContext = createRequestContext(event);
    event.locals.requestId = requestContext.requestId;
    event.locals.requestContext = requestContext;
    
    // Store context for access in nested functions
    requestContextStore.set(requestContext.requestId, requestContext);

    // Log incoming request
    logger.info(`Incoming request: ${requestContext.method} ${requestContext.path}`, {
        requestId: requestContext.requestId,
        ip: requestContext.ip,
        userAgent: requestContext.userAgent
    });

    // Custom body size check for large payloads (like screenshots)
    // Skip check if BODY_SIZE_LIMIT=0 (no limit)
    if (MAX_BODY_SIZE > 0) {
        const contentLength = event.request.headers.get('content-length');
        if (contentLength) {
            const length = parseInt(contentLength, 10);
            if (length > MAX_BODY_SIZE) {
                logger.warn(`Request body too large: ${length} bytes (max: ${MAX_BODY_SIZE} bytes)`, {
                    requestId: requestContext.requestId
                });
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
                'Content-Type': 'text/plain',
                'X-Request-ID': requestContext.requestId
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
    const response = await authMiddleware({
        event,
        resolve: async (authEvent) => {
            // Enrich request context with user information after auth
            if (authEvent.locals.auth) {
                const session = await authEvent.locals.auth.validate().catch(() => null);
                if (session?.user) {
                    enrichRequestContext(
                        requestContext,
                        session.user.id,
                        (authEvent.locals as any).currentAccount?.account?.id,
                        session.user.systemRole
                    );
                }
            }

            // Respect REALTIME_TRANSPORT env for enabling Pushpin
            const enablePushpin = String(process.env.REALTIME_TRANSPORT || 'sse').toLowerCase() === 'pushpin';
            if (redis && enablePushpin) {
                return pushpinMiddleware({
                    event: authEvent,
                    resolve
                });
            }
            // If Pushpin disabled or no Redis, resolve directly (SSE is handled by routes)
            return resolve(authEvent);
        }
    });

    // Add request ID to response headers
    response.headers.set('X-Request-ID', requestContext.requestId);

    // Log request completion
    logger.info(formatRequestLog(requestContext), {
        requestId: requestContext.requestId,
        status: response.status
    });

    // Cleanup context from store (will be cleaned up by periodic cleanup as well)
    requestContextStore.delete(requestContext.requestId);

    // Handle deprecated endpoints (add deprecation headers if needed)
    return handleDeprecatedEndpoint(event, response);
};
