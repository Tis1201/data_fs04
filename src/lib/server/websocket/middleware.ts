import type { Handle } from "@sveltejs/kit";
import { GlobalThisWSS, type ExtendedWebSocket, type ExtendedGlobal, startupWebsocketServer, wssInitialized } from "$lib/server/websocket/WebSocketUtils";
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

export const websocketMiddleware: Handle = async ({ event, resolve }) => {

  logger.info(`[WS Middleware] Called for path: ${event.url.pathname}`);

  logger.debug(`[WS Middleware]: ${event.url.pathname}`); 

  if (event.url.pathname.startsWith('/auth/')) {
    logger.info(`[WS Middleware] Skipping auth path`);
    return await resolve(event);
  }

  logger.info(`[WS Middleware] Processing non-auth path: ${event.url.pathname}`);

  if (!wssInitialized) {
    logger.info(`[WS Middleware] Initializing WebSocket server`);
    startupWebsocketServer();

    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];

    if (wss !== undefined) {
      logger.info(`[WS Middleware] WebSocket server initialized, setting up connection handler`);
      logger.info(`[WS Middleware] WebSocket server instance: ${wss}`);
      wss.on('connection', async (ws: ExtendedWebSocket, request) => {
        logger.info(`[WS Middleware] New WebSocket connection attempt`);
        
        const rawCookieHeader = request.headers.cookie || '';
        logger.debug(`[WS] Raw Cookie header: ${rawCookieHeader}`);

        const parsed = cookie.parse(rawCookieHeader);

        // 3) Look up the Lucia session cookie by its configured name
        const currentSessionId = parsed[lucia.sessionCookieName];
        const currentAccountId = parsed['current_account_id'];
        logger.debug(`[WS] Extracted Lucia session ID: ${currentSessionId}, currentAccountId: ${currentAccountId}`);

        if (!currentSessionId) {
          logger.warn(`[wss:kit] Unable to get Lucia session ID from cookie`);
          ws.close(1008, "Unable to get Lucia session ID from cookie");
          return;
        }
        // const currentSessionId = event.cookies.get(lucia.sessionCookieName);
        // logger.debug(`[WS Middleware] [validate()] Session ID from cookie: ${currentSessionId}`);
        

        const userInfo = await extractUserInfoFromRequest(request, event);

        if ('error' in userInfo) {
          logger.warn(`[wss:kit] ${userInfo.error}`);
          ws.close(1008, userInfo.error);
          return;
        }

        const meta = {
          userInfo: userInfo,
          nodeId: 'node-1',
          protocol: 'websocket',
          connectedAt: Date.now(),
          socketId: ws.socketId,
        };

        const connection = new WSConnection(meta, ws);
        ConnectionManager.registerConnection(connection);

        // WebSocketManager.getInstance().addClient(ws);
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
          ws.removeListener('close', onClose);
          ws.removeListener('error', onClose);

          // WebSocketManager.getInstance().removeClient(ws);
        };
        
        // Add error handler for the connection
        const onError = (error: Error) => {
            logger.error(`[WS] Connection error for client ${clientId}:`, error);
        };
        
        ws.on('error', onError);
        
        // Clean up all listeners when connection is closed
        const cleanup = () => {
            ws.off('close', onClose);
            ws.off('error', onError);
            ws.off('error', onClose);
        };
        
        ws.on('close', () => {
            cleanup();
            onClose();
        });
        
        // Remove the simple message handler that overrides WSConnection
        // The WSConnection will handle messages properly
        
        try {
            connection.start(); // start event listeners inside WSConnection
            logger.info(`[WS] Successfully started connection for client ${clientId}`);
        } catch (error) {
            logger.error(`[WS] Failed to start connection for client ${clientId}:`, error);
            ws.close(1011, 'Internal server error');
        }
      });
    }
  }

  if (!building) {
    const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
    if (wss !== undefined) {
      event.locals.wss = wss;
    }
  }

  return await resolve(event);
};
