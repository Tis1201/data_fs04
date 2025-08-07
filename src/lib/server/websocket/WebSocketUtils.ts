import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import type { Server, WebSocket as WebSocketBase } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WEBRTC_MESSAGE_TYPES, handleWebRTCMessage, leaveRoom } from '../webrtc/WebrtcSignalingUtils';
import { logger } from '../logger';

export const GlobalThisWSS = Symbol.for('fs01.wss');

// Extended WebSocket interface with custom properties
export interface ExtendedWebSocket extends WebSocketBase {
    socketId: string;
    userId?: string;
    userRole?: string;
    sessionId?: string;
}

// Extended WebSocket server interface
export interface ExtendedWebSocketServer extends Server<ExtendedWebSocket> {
    clients: Set<ExtendedWebSocket>;
}

// Global type extension
export interface ExtendedGlobal {
    [GlobalThisWSS]: ExtendedWebSocketServer;
}

export let wssInitialized = false;

export const createWSSGlobalInstance = () => {
    logger.info(`[WebSocket] Creating WebSocket server instance`);
    const wss = new WebSocketServer({ noServer: true }) as ExtendedWebSocketServer;
    (globalThis as ExtendedGlobal)[GlobalThisWSS] = wss;
    logger.info(`[WebSocket] WebSocket server instance created and stored globally`);
    return wss;
};

export const onHttpServerUpgrade = (req: IncomingMessage, sock: Duplex, head: Buffer) => {
    logger.info(`[WebSocket] Upgrade handler called`);
    const pathname = req.url ? parse(req.url).pathname : null;
    logger.info(`[WebSocket] Upgrade request for path: ${pathname}`);
    
    if (pathname !== '/websocket') {
        logger.info(`[WebSocket] Ignoring upgrade request for path: ${pathname}`);
        return;
    }

    logger.info(`[WebSocket] Processing upgrade request for /websocket`);
    const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
    if (!wss) {
        logger.error('[wss:global] WebSocket server not initialized');
        sock.destroy();
        return;
    }

    logger.info(`[WebSocket] WebSocket server found, handling upgrade`);
    logger.info(`[WebSocket] WebSocket server instance: ${wss}`);
    wss.handleUpgrade(req, sock, head, (ws) => {
        logger.debug('[handleUpgrade] creating new connection');
        logger.info(`[WebSocket] About to emit 'connection' event`);
        wss.emit('connection', ws, req);
        logger.info(`[WebSocket] 'connection' event emitted`);
    });
};

export function startupWebsocketServer() {
    if (wssInitialized) {
        logger.info(`[WebSocket] WebSocket server already initialized`);
        return;
    }
    
    logger.info(`[WebSocket] Starting WebSocket server`);
    createWSSGlobalInstance();
    wssInitialized = true;
    
    logger.info('WebSocket server initialized');
}
