import { WebSocket } from 'ws';
import { logger } from '../logger';

type WSClient = WebSocket & {
    id: string;
    userId?: string;
    sessionId?: string;
};

const clients = new Map<string, WSClient>();
let connectionCounter = 0;

// Setup periodic logging
let logInterval: NodeJS.Timeout | null = null;

/**
 * Start logging client count every 5 seconds
 */
function startLogging() {
    if (logInterval) return; // Already running
    
    logInterval = setInterval(() => {
        logger.info(`[WS] Current connected clients: ${clients.size}`);
        
        // Log detailed client info in development
        if (process.env.NODE_ENV === 'development') {
            const clientList = Array.from(clients.values()).map(c => ({
                id: c.id,
                userId: c.userId,
                readyState: c.readyState,
                sessionId: c.sessionId
            }));
            // logger.debug(`[WS] Connected clients: ${clientList}`);
            for (const client of clientList) {
                logger.debug(`[WS] Client ${client.id} (session: ${client.sessionId})`);
            }

        }
    }, 5000);
    
    // Clean up interval on process exit
    process.on('exit', () => {
        if (logInterval) {
            clearInterval(logInterval);
            logInterval = null;
        }
    });
}

// Start logging when the module loads
startLogging();

/**
 * Add a new WebSocket client and return its ID
 */
export function addClient(ws: WebSocket & { sessionId?: string }, userId?: string): string {
    const clientId = `ws-${Date.now()}-${++connectionCounter}`;
    const client = Object.assign(ws, { id: clientId, userId, sessionId: ws.sessionId }) as WSClient;
    
    clients.set(clientId, client);
    logger.info(`[WS] Client connected: ${clientId}. Total: ${clients.size}`);
    
    // Handle client disconnection and errors
    const onClose = () => {
        if (clients.delete(clientId)) {
            logger.info(`[WS] Client disconnected: ${clientId}. Remaining: ${clients.size}`);
        }
    };
    
    const onError = (error: Error) => {
        logger.error(`[WS] Error with client ${clientId}:`, error);
    };
    
    ws.on('close', onClose);
    ws.on('error', onError);
    
    // Clean up listeners when client is removed
    ws.on('close', () => {
        ws.off('close', onClose);
        ws.off('error', onError);
    });
    
    return clientId;
}

/**
 * Get the number of connected clients
 */
export function getClientCount(): number {
    return clients.size;
}

/**
 * Get all connected client IDs
 */
export function getClientIds(): string[] {
    return Array.from(clients.keys());
}

/**
 * Get a client by ID
 */
export function getClient(clientId: string): WSClient | undefined {
    return clients.get(clientId);
}

/**
 * Remove a client by ID
 */
export function removeClient(clientId: string): void {
    clients.delete(clientId);
}

/**
 * Terminate all connections for a specific session ID
 */
export function terminateBySessionId(sessionId: string): number {
    let count = 0;
    
    for (const [id, client] of clients.entries()) {
        if (client.sessionId === sessionId) {
            // Close the WebSocket connection with a normal closure
            client.close(1000, 'Session terminated');
            clients.delete(id);
            count++;
            logger.info(`[WS] Terminated connection ${id} for session ${sessionId}`);
        }
    }
    
    return count;
}