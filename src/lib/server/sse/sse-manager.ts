import { logger } from '../logger';
import type { ReadableStreamDefaultController } from 'node:stream/web';

export class SSEManager {
    private static instance: SSEManager;
    private clients: Map<string, ReadableStreamDefaultController>;

    private constructor() {
        this.clients = new Map();
    }

    public static getInstance(): SSEManager {
        if (!SSEManager.instance) {
            SSEManager.instance = new SSEManager();
        }
        return SSEManager.instance;
    }

    addClient(userId: string, controller: ReadableStreamDefaultController) {
        this.clients.set(userId, controller);
        // Only log total client count changes
        if (this.clients.size === 1 || this.clients.size % 5 === 0) {
            logger.debug('SSE clients:', { totalClients: this.clients.size });
        }
    }

    removeClient(userId: string) {
        this.clients.delete(userId);
        // Only log total client count changes
        if (this.clients.size === 0 || this.clients.size % 5 === 0) {
            logger.debug('SSE clients:', { totalClients: this.clients.size });
        }
    }

    sendMessage(userId: string, event: string, data: unknown) {
        const controller = this.clients.get(userId);
        if (controller) {
            try {
                controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                // Remove debug logging for individual messages
                return true;
            } catch (error) {
                logger.error('Failed to send SSE message:', { userId, event, error });
                this.removeClient(userId);
                return false;
            }
        }
        return false;
    }

    broadcast(event: string, data: unknown) {
        // Only log broadcasts if there are actually clients
        if (this.clients.size > 0) {
            logger.debug('Broadcasting SSE message:', { event, clientCount: this.clients.size });
        }
        const deadClients: string[] = [];

        for (const [userId, controller] of this.clients.entries()) {
            try {
                controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (error) {
                logger.error('Failed to broadcast SSE message:', { userId, event, error });
                deadClients.push(userId);
            }
        }

        // Clean up dead clients after iteration
        deadClients.forEach(userId => this.removeClient(userId));
    }
}

export const sseManager = SSEManager.getInstance();
