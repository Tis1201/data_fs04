import type { Handle } from "@sveltejs/kit";
import { GlobalThisWSS, type ExtendedGlobal, type ExtendedWebSocket, startupWebsocketServer, wssInitialized } from "$lib/server/websocket/WebSocketUtils";
import { building } from "$app/environment";
import { logger } from "$lib/server/logger";
import { WSConnection } from "../messaging/connections/ws_connection";
import { ConnectionManager } from "$lib/server/messaging/core/connectionManager";
import { extractUserInfoFromRequest } from '$lib/server/security/auth-utils';
import { lucia } from "$lib/server/auth/lucia";
import cookie from 'cookie';
export const websocketMiddleware: Handle = async ({ event, resolve }) => {

  logger.debug(`[WS Middleware]: ${event.url.pathname}`); 

  if (event.url.pathname.startsWith('/auth/')) {
    return await resolve(event);
  }

  if (!wssInitialized) {
    startupWebsocketServer();

    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];

    if (wss !== undefined) {
      wss.on('connection', async (ws: ExtendedWebSocket, request) => {
        
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
          connectedAt: Date.now()
        };

        const connection = new WSConnection(meta, ws);
        ConnectionManager.registerConnection(connection);
        connection.start(); // start event listeners inside WSConnection

        
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
