import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';

/********************************************************************************************
 * Message Queue for cross-process communication
 * 
 * This allows API routes (running in SvelteKit server) to queue MQTT messages
 * that will be sent by the worker process (which has the MQTT connection).
 ********************************************************************************************/

const MQTT_QUEUE_CHANNEL = 'mqtt:outgoing:queue';

export interface QueuedNotification {
    prismaConfig?: {
        // Connection info if needed
    };
    sub: string;
    recipient: string;
    type: string;
    flowId: string;
    params?: Record<string, unknown>;
    expiresIn?: string | number;
}

/**
 * Queue an MQTT notification to be sent by the worker
 * Called from API routes in the SvelteKit server process
 */
export async function queueNotification(notification: QueuedNotification): Promise<void> {
    if (!redis) {
        throw new Error('Redis is not configured');
    }
    
    try {
        const message = JSON.stringify(notification);
        await redis.publish(MQTT_QUEUE_CHANNEL, message);
        
        logger.debug(`[MQTT Queue] Queued notification: type=${notification.type}, recipient=${notification.recipient}`);
    } catch (error) {
        logger.error(`[MQTT Queue] Failed to queue notification: ${String(error)}`);
        throw error;
    }
}

/** Type for action-log broadcast (same Redis queue, worker does MQTT publish) */
export const ACTION_LOG_BROADCAST_TYPE = 'actionLog:broadcast';

/**
 * Queue an action-log broadcast. Worker will load the log and publish via MQTT
 * (same flow as device actions: web app queues, worker publishes).
 */
export async function queueActionLogBroadcast(logId: string, eventType: 'created' | 'updated'): Promise<void> {
    const crypto = await import('node:crypto');
    await queueNotification({
        sub: '',
        recipient: ACTION_LOG_BROADCAST_TYPE,
        type: ACTION_LOG_BROADCAST_TYPE,
        flowId: crypto.randomUUID(),
        params: { logId, eventType }
    });
}

/**
 * Subscribe to queued notifications (called by worker)
 * The worker processes queued messages and sends them via MQTT
 */
export async function subscribeToQueue(
    handler: (notification: QueuedNotification) => Promise<void>
): Promise<void> {
    if (!redis) {
        throw new Error('Redis is not configured');
    }
    
    const subscriber = redis.duplicate();
    
    // Set up message handler before subscribing
    subscriber.on('message', async (channel: string, message: string) => {
        if (channel !== MQTT_QUEUE_CHANNEL) return;
        
        try {
            const notification: QueuedNotification = JSON.parse(message);
            logger.debug(`[MQTT Queue] Processing queued notification: type=${notification.type}`);
            await handler(notification);
        } catch (error) {
            logger.error(`[MQTT Queue] Error processing queued notification: ${String(error)}`);
        }
    });
    
    // Subscribe to the channel
    await subscriber.subscribe(MQTT_QUEUE_CHANNEL);
    
    logger.info(`[MQTT Queue] Subscribed to ${MQTT_QUEUE_CHANNEL}`);
}

