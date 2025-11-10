import { getMessageRelay } from '$lib/server/pushpin/middleware';
import { logger } from '$lib/server/logger';

export interface DeviceRegistrationData {
    id: string;
    apiKey: string;
    accountId: string;
    claimedBy: string;
    name?: string;
    deviceType?: string;
    status?: string;
    claimedAt?: string;
    [key: string]: any;
}

/**
 * Sends standardized device registration message to device via Redis Pub/Sub
 * 
 * ARCHITECTURE (Scalable - follows redis_pushpin.md):
 * - Device is connected to Pushpin (not backend directly)
 * - Backend publishes to Redis Pub/Sub channel (REDIS_PUSHPIN_CHANNEL_NAME)
 * - Sidecars subscribe to Redis and relay messages to their local Pushpin instances
 * - Pushpin delivers message to device
 * - This enables horizontal scaling (100k+ devices)
 */
export async function sendDeviceRegistrationMessage(
    deviceId: string, 
    deviceData: DeviceRegistrationData
): Promise<void> {
    const messageRelay = getMessageRelay();
    
    if (!messageRelay) {
        logger.error(`[Redis Pub/Sub] MessageRelay not initialized - cannot send registration message to device ${deviceId}`);
        throw new Error('MessageRelay not initialized - Redis service may not be available');
    }
    
    // Create message payload
    const message = {
        type: 'device',
        payload: {
            action: 'registered',
            ...deviceData,
            claimedAt: deviceData.claimedAt || new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    };
    
    logger.info(`[Redis Pub/Sub] Publishing registration message for device ${deviceId}`);
    logger.debug(`[Redis Pub/Sub] Registration message payload: ${JSON.stringify(message)}`);
    
    try {
        // Publish to Redis Pub/Sub - sidecars will relay to Pushpin
        // Channel format: device:{deviceId} (matches Pushpin channel)
        await messageRelay.publishToDevice(deviceId, message);
        logger.info(`[Redis Pub/Sub] ✓ Device registration message successfully published for device ${deviceId}`);
    } catch (error) {
        logger.error(`[Redis Pub/Sub] ✗ Failed to publish registration message for device ${deviceId}:`, error);
        throw error; // Re-throw to ensure caller knows it failed
    }
}

/**
 * Common device claiming flow for both PIN and preclaim
 */
export interface ClaimDeviceOptions {
    userId: string;
    accountId: string;
    preclaimId?: string;
    deviceMeta?: any;
}

export function createClaimOptions(
    userInfo: any, 
    accountId?: string, 
    preclaimId?: string,
    deviceMeta?: any
): ClaimDeviceOptions {
    // Handle both full userInfo objects and simplified preclaim objects
    const actualUserId = userInfo.id || userInfo.userId;
    const actualAccountId = accountId || userInfo.currentAccount?.account?.id || userInfo.accountId;
    
    if (!actualUserId || !actualAccountId) {
        throw new Error('User ID and Account ID are required for device claiming');
    }
    
    return {
        userId: actualUserId,
        accountId: actualAccountId,
        preclaimId,
        deviceMeta
    };
}
