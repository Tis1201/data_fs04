import type { Handle } from "@sveltejs/kit";
import { GlobalThisWSS, type ExtendedGlobal, type ExtendedWebSocket, startupWebsocketServer, wssInitialized } from "$lib/server/websocket/WebSocketUtils";
import { building } from "$app/environment";
import { nanoid } from 'nanoid';
import { validateApiKey, getUserIdFromApiKey, getUserInfoFromApiKey } from '$lib/server/auth/api-key-utils';
import { logger } from "$lib/server/logger";
import { WSConnection } from "../messaging/connections/ws_connection";
import { ConnectionManager } from "$lib/server/messaging/core/connectionManager";
import { extractUserInfoFromRequest } from '$lib/server/security/auth-utils';
import type { UserInfo } from '$lib/server/types/user';
import type { User } from "lucia";

export const websocketMiddleware: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/auth/')) {
    return await resolve(event);
  }

  if (!wssInitialized) {
    startupWebsocketServer();

    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];

    if (wss !== undefined) {
      wss.on('connection', async (ws: ExtendedWebSocket, request) => {
        // try {
        ws.socketId = nanoid();
        logger.debug(`[wss:kit] assigned socket ID: ${ws.socketId}`);

        const userInfo = await extractUserInfoFromRequest(request, event);

        if ('error' in userInfo) {
          logger.warn(`[wss:kit] ${userInfo.error}`);
          ws.close(1008, userInfo.error);
          return;
        }

        const meta = {
          id: ws.socketId,
          userInfo: userInfo,
          nodeId: 'node-1',
          protocol: 'websocket',
          connectedAt: Date.now()
        };

        const connection = new WSConnection(meta, ws);
        ConnectionManager.registerConnection(connection);
        connection.start(); // start event listeners inside WSConnection

        // ws.send(JSON.stringify({
        //   type: 'welcome',
        //   data: {
        //     message: `Hello ${apiKey ? 'API ' : ''}${new Date().toLocaleString()}`,
        //     socketId: ws.socketId,
        //     userId: ws.userId,
        //     role: ws.userRole,
        //     authMethod: apiKey ? 'apiKey' : 'session'
        //   }
        // }));

        // } catch (error) {
        //   logger.error('[wss:kit] authentication error:', error);
        //   ws.close(1008, 'Authentication failed');
        // }
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
