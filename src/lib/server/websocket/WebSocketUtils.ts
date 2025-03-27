import { parse } from 'url';
import { WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import type { Server, WebSocket as WebSocketBase } from 'ws';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { WEBRTC_MESSAGE_TYPES, handleWebRTCMessage, leaveRoom } from '../webrtc/WebrtcSignalingUtils';

export const GlobalThisWSS = Symbol.for('fs01.wss');

// Extended WebSocket interface with custom properties
export interface ExtendedWebSocket extends WebSocketBase {
    socketId: string;
    userId?: string;
    userRole?: string;
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
    const wss = new WebSocketServer({ noServer: true }) as ExtendedWebSocketServer;
    (globalThis as ExtendedGlobal)[GlobalThisWSS] = wss;
    return wss;
};

export const onHttpServerUpgrade = (req: IncomingMessage, sock: Duplex, head: Buffer) => {
    const pathname = req.url ? parse(req.url).pathname : null;
    if (pathname !== '/websocket') return;

    const wss = (globalThis as ExtendedGlobal)[GlobalThisWSS];
    if (!wss) {
        console.error('[wss:global] WebSocket server not initialized');
        sock.destroy();
        return;
    }

    wss.handleUpgrade(req, sock, head, (ws) => {
        console.debug('[handleUpgrade] creating new connection');
        wss.emit('connection', ws, req);
    });
};

export function startupWebsocketServer() {
    if (wssInitialized) return;
    
    createWSSGlobalInstance();
    wssInitialized = true;
    
    console.debug('WebSocket server initialized');
}
