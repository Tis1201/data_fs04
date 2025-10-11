import type { Connection, ConnectionMeta } from '../interfaces/connection';
import { ConnectionManager } from '../core/connectionManager';
import { subscriptionRegistry } from '../core/subscriptionRegistry';
import { publisher } from '../core/publisher';
import { MessageFactory } from '../interfaces/message';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import { getPresenceManager } from '$lib/server/pushpin/middleware';
import { getAdminPrisma } from '$lib/server/prisma';
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
    private static readonly PING_TIMEOUT_MS = 60000; // 60 seconds timeout
    private pingInterval: NodeJS.Timeout | null = null;
    private pingTimeout: NodeJS.Timeout | null = null;
    private keepAliveInterval: NodeJS.Timeout | null = null;
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
        logger.info(`[PushpinConnection] Created connection for device ${this.meta.deviceId || this.meta.id}`);
        
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

        // Set up timeout detection
        this.resetPingTimeout();
    }

    private resetPingTimeout(): void {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
        }
        
        this.pingTimeout = setTimeout(() => {
            if (this.isAlive) {
                logger.warn(`[PushpinConnection] Ping timeout after ${PushpinConnection.PING_TIMEOUT_MS}ms, cleaning up connection`);
                this.cleanup();
            }
        }, PushpinConnection.PING_TIMEOUT_MS);
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
            meta: {
                connectionId: this.meta.id,
                deviceId: this.meta.deviceId
            }
        });

        // Publish to per-device channel so sidecar can relay to Pushpin
        const channel = `device:${this.meta.deviceId}`;
        await this.publishFn(channel, pingResponse);

        // Reset timeout on successful ping
        this.resetPingTimeout();
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
            // Filter out status/data updates for device connections (they don't need their own status echoed back)
            const messageType = (payload as any)?.type;
            if (this.meta.deviceId === this.meta.id && 
                (messageType === 'device:statusUpdate' || messageType === 'device:dataUpdate')) {
                logger.debug(`[PushpinConnection] Skipping ${messageType} for device connection ${this.meta.id}`);
                return;
            }

            const data = {
                ...(payload as object),
                timestamp: new Date().toISOString()
            };

            // Publish to per-device channel so sidecar can relay to Pushpin
            await this.publishFn(`device:${this.meta.deviceId}`, data);

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
            const channel = `device:${this.meta.deviceId}`;
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

            // Reset alive flag on any message and reset timeout
            this.isAlive = true;
            this.resetPingTimeout();
        } catch (error) {
            logger.error(`[PushpinConnection] Error handling message: ${error}`);
        }
    }

    close(): void {
        this.cleanup().catch(error => {
            logger.error(`[PushpinConnection] Error during cleanup: ${String(error)}`);
        });
    }

    setKeepAliveInterval(interval: NodeJS.Timeout): void {
        this.keepAliveInterval = interval;
    }

    private async cleanup(): Promise<void> {
        if (!this.isAlive) return;
        this.isAlive = false;

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }

        const deviceId = this.meta.deviceId || this.meta.id;

        // Update device status to offline
        try {
            const prisma = getAdminPrisma();
            await prisma.device.update({
                where: { id: deviceId },
                data: {
                    connected: false,
                    disconnectedAt: new Date()
                }
            });

            // Update presence tracking
            const presenceManager = getPresenceManager();
            if (presenceManager) {
                await presenceManager.setDeviceOffline(deviceId);
            }

            // Publish disconnection event directly to UI (bypassing dispatcher)
            const disconnectionMessage = MessageFactory.createSystemMessage(
                'device:connection',
                `subscription:device:${deviceId}`,
                {
                    deviceId: deviceId,
                    connected: false,
                    disconnectedAt: new Date().toISOString(),
                    protocol: 'pushpin'
                },
                this.meta.userInfo || null,
                { echoToSender: false }
            );

            logger.info(`[PushpinConnection] Publishing disconnect event for device ${deviceId}`);
            await publisher.publish(disconnectionMessage);
            logger.info(`[PushpinConnection] Disconnect event published successfully for device ${deviceId}`);

            // Remove device subscriptions
            const connectionScope = `subscriber:connection:${this.meta.id || deviceId}`;
            const subscriptions = await subscriptionRegistry.getByScope(connectionScope);
            
            for (const sub of subscriptions) {
                try {
                    await subscriptionRegistry.removeSubscription(sub.key, connectionScope);
                } catch (err) {
                    logger.error(`[PushpinConnection] Failed to remove subscription ${sub.key}: ${String(err)}`);
                }
            }

            logger.info(`[PushpinConnection] Device ${deviceId} disconnected and status updated`);
        } catch (error) {
            logger.error(`[PushpinConnection] Failed to update device status on disconnect: ${String(error)}`);
        }

        ConnectionManager.unregisterConnection(this.meta.id || deviceId);
        logger.debug(`[PushpinConnection] Connection closed: ${this.meta.id || deviceId}`);
    }
}