import type { Handle, HandleServerError } from "@sveltejs/kit";
import { error } from "@sveltejs/kit";
import redis from "$lib/server/redis";
import { building } from "$app/environment";
import { authMiddleware } from "$lib/server/auth/middleware";
// Pushpin middleware removed - all device communication now uses MQTT
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
import { getRouteModuleConfig, getActionForMethod } from "$lib/constants/routeModuleMap";
import { hasModulePermission, getUserModulePermissions } from "$lib/server/security/modulePermissions";

// Environment flag to enable/disable hooks-level module permission checking
// Set to 'true' to enable early route protection at hooks level
const ENABLE_HOOKS_MODULE_CHECK = process.env.ENABLE_HOOKS_MODULE_CHECK === 'true';

import { ensureDefaultAdmin } from "$lib/server/setup/admin";

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
            await ensureDefaultAdmin();
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
    // Apply auth middleware (Pushpin middleware removed - all devices use MQTT)
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

                    // Optional: Check module permissions at hooks level
                    // This provides an early catch-all protection layer
                    // Individual routes still have their own guards for more specific control
                    if (ENABLE_HOOKS_MODULE_CHECK && session.user.systemRole !== 'ADMIN') {
                        const path = authEvent.url.pathname;
                        const method = authEvent.request.method;
                        const accountId = (authEvent.locals as any).currentAccount?.account?.id;

                        // Only check for protected routes (/user/* and /admin/*)
                        if ((path.startsWith('/user/') || path.startsWith('/admin/')) && accountId) {
                            const routeConfig = getRouteModuleConfig(path);

                            if (routeConfig && !routeConfig.skipCheck) {
                                const action = getActionForMethod(method, routeConfig);

                                const hasAccess = await hasModulePermission({
                                    userId: session.user.id,
                                    accountId,
                                    module: routeConfig.module,
                                    action
                                });

                                if (!hasAccess) {
                                    logger.warn('Module permission denied at hooks level', {
                                        requestId: requestContext.requestId,
                                        userId: session.user.id,
                                        accountId,
                                        module: routeConfig.module,
                                        action,
                                        path
                                    });
                                    throw error(403, `Access denied: ${routeConfig.module}/${action}`);
                                }
                            }
                        }
                    }

                    // Preload user's module permissions and attach to locals for use in routes
                    // This avoids repeated database queries in route guards
                    const accountId = (authEvent.locals as any).currentAccount?.account?.id;
                    if (accountId && session.user.systemRole !== 'ADMIN') {
                        try {
                            const modulePermissions = await getUserModulePermissions(
                                session.user.id,
                                accountId
                            );
                            (authEvent.locals as any).modulePermissions = modulePermissions;
                        } catch (err) {
                            logger.warn('Failed to preload module permissions', {
                                requestId: requestContext.requestId,
                                error: err
                            });
                        }
                    }
                }
            }

            // Resolve directly (Pushpin removed, devices use MQTT, SSE handled by routes)
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

/** Log server errors and preserve message in dev so the error page shows the real cause */
export const handleError: HandleServerError = async ({ error: err, status, message }) => {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    logger.error('Server error', {
        status,
        message: errMessage,
        stack: errStack,
        originalMessage: message
    });
    // In dev, surface the real error message so the UI shows it
    if (process.env.NODE_ENV !== 'production' && errMessage && errMessage !== message) {
        return { message: errMessage };
    }
    return { message };
};
