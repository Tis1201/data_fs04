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
export interface ExtendedWebSocketServer extends Server {
    clients: Set<ExtendedWebSocket>;
}

// Global type extension
export interface ExtendedGlobal {
    [GlobalThisWSS]: ExtendedWebSocketServer;
}

export let wssInitialized = false;

export const createWSSGlobalInstance = () => {
    logger.info(`[WebSocket] Creating WebSocket server instance`);
    const wss = new WebSocketServer({ noServer: true }) as unknown as ExtendedWebSocketServer;
    (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS] = wss;
    logger.info(`[WebSocket] WebSocket server instance created and stored globally`);
    return wss;
};

// Import connection handler setup function
let connectionHandlerSetup: (() => void) | null = null;

export function setConnectionHandlerSetup(setupFn: () => void) {
    connectionHandlerSetup = setupFn;
    logger.info(`[WebSocket] Connection handler setup function registered`);
    
    // If WebSocket server already exists, set up handler immediately
    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];
    if (wss) {
        const hasHandler = (wss as any).listenerCount && (wss as any).listenerCount('connection') > 0;
        if (!hasHandler) {
            logger.info(`[WebSocket] Setting up connection handler immediately`);
            setupFn();
        }
    }
}

export const onHttpServerUpgrade = (req: IncomingMessage, sock: Duplex, head: Buffer) => {
    const pathname = req.url ? parse(req.url).pathname : null;
    
    if (pathname !== '/websocket') {
        return;
    }

    const wss = (globalThis as unknown as ExtendedGlobal)[GlobalThisWSS];
    if (!wss) {
        logger.error('[WebSocket] WebSocket server not initialized');
        sock.destroy();
        return;
    }

    // Ensure connection handler is set up
    const hasHandler = (wss as any).listenerCount && (wss as any).listenerCount('connection') > 0;
    if (!hasHandler && connectionHandlerSetup) {
        connectionHandlerSetup();
    } else if (!hasHandler) {
        logger.warn(`[WebSocket] No connection handler set up`);
    }

    (wss as any).handleUpgrade(req, sock, head, (ws: any) => {
        (wss as any).emit('connection', ws, req);
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
