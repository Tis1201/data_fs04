import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import type { RoutingMessage } from '../interfaces/message';
import { logger } from '$lib/server/logger';
import {
    ResponseStatus,
    ResponseCategory,
    ResponseSeverity,
    createSuccessResponse,
    createSystemResponse,
    createErrorResponse,
    type BaseResponse
} from '$lib/shared/response_format';

// Type for the publish function
export type PushpinPublishFunction = (channel: string, message: any) => Promise<void>;

export class PushpinConnection implements Connection {
    private static readonly PING_INTERVAL_MS = 30000; // 30 seconds
    private pingInterval: NodeJS.Timeout | null = null;
    private isAlive = true;

    /**
     * Constructor for PushpinConnection
     * @param meta Connection metadata
     * @param publishFn Optional function to publish messages to Redis
     */
    constructor(
        public readonly meta: ConnectionMeta,
        private readonly publishFn?: PushpinPublishFunction
    ) {
        // Setup ping if we have a publish function
        if (this.publishFn) {
            this.setupPing();
        }
    }

    private setupPing(): void {
        // Send first ping immediately
        this.sendPing().catch(error => {
            logger.error(`[PushpinConnection] Initial ping failed: ${error}`);
        });

        // Set up regular pings
        this.pingInterval = setInterval(() => {
            if (!this.isAlive) {
                this.cleanup();
                return;
            }
            this.sendPing().catch(error => {
                logger.error(`[PushpinConnection] Ping failed: ${error}`);
                this.cleanup();
            });
        }, PushpinConnection.PING_INTERVAL_MS);
    }

    private async sendPing(): Promise<void> {
        if (!this.publishFn) {
            logger.warn(`[PushpinConnection] Cannot send ping: no publish function available`);
            return;
        }

        // Create a standardized system response for the ping
        const pingResponse = createSystemResponse({
            event: 'ping',
            message: 'Connection heartbeat',
            status: ResponseStatus.SUCCESS,
            severity: ResponseSeverity.INFO,
            category: ResponseCategory.SYSTEM,
            meta: {
                connectionId: this.meta.id,
                deviceId: this.meta.deviceId
            }
        });

        // Use the channel format expected by Pushpin
        const channel = `messages`;
        await this.publishFn(channel, {
            channel: this.meta.deviceId,
            payload: pingResponse
        });
    }

    /**
     * Send a message using the legacy format (for backward compatibility)
     */
    async send(payload: unknown): Promise<void> {
        if (!this.isAlive) {
            throw new Error('Connection is closed');
        }

        if (!this.publishFn) {
            logger.warn(`[PushpinConnection] Cannot send message: no publish function available`);
            throw new Error('No publish function available');
        }

        try {
            const data = {
                ...(payload as object),
                timestamp: new Date().toISOString()
            };

            // Use the channel format expected by Pushpin
            await this.publishFn("messages", {
                channel: this.meta.deviceId,
                payload: data
            });

        } catch (error) {
            logger.error(`[PushpinConnection] Failed to send message: ${error}`);
            throw error;
        }
    }

    /**
     * Send a message using the standardized response format
     */
    async sendStandardized(response: BaseResponse): Promise<void> {
        if (!this.isAlive) {
            throw new Error('Connection is closed');
        }

        if (!this.publishFn) {
            logger.warn(`[PushpinConnection] Cannot send standardized message: no publish function available`);
            throw new Error('No publish function available');
        }

        try {
            // Use the channel format expected by Pushpin
            const channel = `device:${this.meta.deviceId}:messages`;
            await this.publishFn(channel, response);
        } catch (error) {
            logger.error(`[PushpinConnection] Failed to send standardized message: ${error}`);
            throw error;
        }
    }

    async handleMessage(raw: string | Buffer): Promise<void> {
        if (!this.isAlive) return;

        try {
            const message = typeof raw === 'string' ? raw : raw.toString();
            logger.debug(`[PushpinConnection] Received message: ${JSON.stringify(message)}`);

            // Reset alive flag on any message
            this.isAlive = true;
        } catch (error) {
            logger.error(`[PushpinConnection] Error handling message: ${error}`);
        }
    }

    close(): void {
        this.cleanup();
    }

    private cleanup(): void {
        if (!this.isAlive) return;
        this.isAlive = false;

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        ConnectionManager.unregisterConnection(this.meta.id);
        logger.debug(`[PushpinConnection] Connection closed: ${this.meta.id}`);
    }
}