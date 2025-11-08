import { getPushpinPublishService } from '$lib/server/pushpin/publishService';
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
 * Sends standardized device registration message to device via Pushpin
 * 
 * ARCHITECTURE:
 * - Device is connected to Pushpin (not backend directly)
 * - Backend publishes to Pushpin Control Port (5561)
 * - Pushpin delivers message to device
 * - No direct connection from backend to device
 */
export async function sendDeviceRegistrationMessage(
    deviceId: string, 
    deviceData: DeviceRegistrationData
): Promise<void> {
    const pushpinPublish = getPushpinPublishService();
    const channel = `device:${deviceId}`;
    
    // Publish via Pushpin Control Port
    await pushpinPublish.publishToChannel(channel, {
        type: 'device',
        payload: {
            action: 'registered',
            ...deviceData,
            claimedAt: deviceData.claimedAt || new Date().toISOString()
        },
        timestamp: new Date().toISOString()
    });
    
    logger.info(`[Pushpin] Device registration message sent for device ${deviceId} via Pushpin Control Port`);
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
