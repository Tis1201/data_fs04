import type { Handle } from "@sveltejs/kit";
import { GlobalThisWSS, type ExtendedWebSocket, type ExtendedGlobal, startupWebsocketServer, wssInitialized, setConnectionHandlerSetup } from "$lib/server/websocket/WebSocketUtils";
import { building } from "$app/environment";
import { logger } from "$lib/server/logger";
import { WSConnection } from "../messaging/connections/ws_connection";
import { ConnectionManager } from "$lib/server/messaging/core/connectionManager";
import { extractUserInfoFromRequest } from '$lib/server/security/auth-utils';
import { lucia } from "$lib/server/auth/lucia";
import cookie from 'cookie';
// import { WebSocketManager } from "./WebSocketManager";
import prisma, { getEnhancedPrisma } from "$lib/server/prisma";
import { addClient, removeClient } from './WSManager';

// Connection handler function that will be called when WebSocket connections are established
function setupWebSocketConnectionHandler() {
    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];
    
    if (!wss) {
        logger.warn(`[WS Middleware] WebSocket server not available for handler setup`);
        return;
    }
    
    // Check if handler is already set up
    const hasHandler = (wss as any).listenerCount && (wss as any).listenerCount('connection') > 0;
    if (hasHandler) {
        return;
    }
    
    (wss as any).on('connection', async (ws: ExtendedWebSocket, request: any) => {
        logger.info(`[WS Middleware] New WebSocket connection from ${request.socket.remoteAddress}`);
        
        // Try to get session ID from query string first (for Pushpin compatibility)
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        let currentSessionId = url.searchParams.get('session') || url.searchParams.get(lucia.sessionCookieName);
        let currentAccountId = url.searchParams.get('account_id');
        
        // Fall back to cookies if not in query string
        if (!currentSessionId) {
          const rawCookieHeader = request.headers.cookie || '';
          logger.debug(`[WS] Raw Cookie header: ${rawCookieHeader}`);

          const parsed = cookie.parse(rawCookieHeader);

          // Look up the Lucia session cookie by its configured name
          currentSessionId = parsed[lucia.sessionCookieName];
          currentAccountId = parsed['current_account_id'];
        }
        
        if (!currentSessionId) {
          logger.warn(`[WS Middleware] No authentication method provided`);
          (ws as any).close(1008, "No authentication method provided");
          return;
        }

        const sessionValidation = await lucia.validateSession(currentSessionId);
        if (!sessionValidation.session || !sessionValidation.user) {
          logger.warn(`[WS Middleware] Invalid or expired session`);
          (ws as any).close(1008, "Invalid or expired session");
          return;
        }

        const memberships = await prisma.accountMembership.findMany({
          where: { userId: sessionValidation.user.id, role: { not: 'SYSTEM' } },
          include: {
            account: {
              select: { id: true, name: true, slug: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        let currentAccount = null;
        if (currentAccountId) {
          currentAccount = memberships.find(m => m.account.id === currentAccountId);
        }
        if (!currentAccount && memberships.length > 0) {
          currentAccount = memberships[0];
        }

        const userInfo = {
          id: sessionValidation.user.id,
          email: sessionValidation.user.email,
          name: null,
          systemRole: sessionValidation.user.systemRole,
          source: 'session' as const,
          memberships,
          currentAccount
        };

        const meta = {
          userInfo: userInfo,
          nodeId: 'node-1',
          protocol: 'websocket',
          connectedAt: Date.now(),
          socketId: ws.socketId,
        };

        const connection = new WSConnection(meta, ws);
        ConnectionManager.registerConnection(connection);
        logger.info(`[WS Middleware] WebSocket connection established: ${connection.meta.id} for user ${userInfo.id}`);

        ws.sessionId = currentSessionId;
        const clientId = addClient(ws, meta.userInfo?.id);

        
        // Set up cleanup on close
        const onClose = () => {
          if (clientId) {
            removeClient(clientId);
          }

          const connectionId = connection.meta.id;
          if (!connectionId) {
            logger.warn('[WS] Cannot unregister connection: missing connection ID');
            return;
          }
          
          logger.debug(`[WS] Cleaning up connection ${connectionId} for user ${meta.userInfo}`);
          ConnectionManager.unregisterConnection(connectionId);
          (ws as any).removeListener('close', onClose);
          (ws as any).removeListener('error', onClose);
        };
        
        // Add error handler for the connection
        const onError = (error: Error) => {
            logger.error(`[WS] Connection error for client ${clientId}:`, error);
        };
        
        (ws as any).on('error', onError);
        
        // Clean up all listeners when connection is closed
        const cleanup = () => {
            (ws as any).off('close', onClose);
            (ws as any).off('error', onError);
            (ws as any).off('error', onClose);
        };
        
        (ws as any).on('close', () => {
            cleanup();
            onClose();
        });
        
        try {
            connection.start();
        } catch (error: any) {
            logger.error(`[WS Middleware] Failed to start connection:`, error);
            (ws as any).close(1011, 'Internal server error');
        }
    });
}

// Register the connection handler setup function so it can be called from WebSocketUtils
if (!building) {
    setConnectionHandlerSetup(setupWebSocketConnectionHandler);
}

export const websocketMiddleware: Handle = async ({ event, resolve }) => {
  // Only process WebSocket upgrade requests
  if (event.request.headers.get('upgrade') !== 'websocket') {
    return await resolve(event);
  }

  if (event.url.pathname.startsWith('/auth/')) {
    return await resolve(event);
  }

  const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];
  
  if (!wssInitialized && wss === undefined) {
    startupWebsocketServer();
  }

  if (wss !== undefined) {
    const hasConnectionHandler = (wss as any).listenerCount && (wss as any).listenerCount('connection') > 0;
    if (!hasConnectionHandler) {
      setupWebSocketConnectionHandler();
    }
  } else {
    logger.warn(`[WS Middleware] WebSocket server not available`);
  }

  if (!building) {
    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];
    if (wss !== undefined) {
      event.locals.wss = wss;
    }
  }

  return await resolve(event);
};
