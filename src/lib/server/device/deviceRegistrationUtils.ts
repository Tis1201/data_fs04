import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
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
 * Sends standardized device registration message to device
 */
export async function sendDeviceRegistrationMessage(
    deviceId: string, 
    deviceData: DeviceRegistrationData
): Promise<void> {
    const message = MessageFactory.createSystemMessage(
        'device',
        `subscription:device:${deviceId}`,
        {
            action: 'registered',
            ...deviceData,
            claimedAt: deviceData.claimedAt || new Date().toISOString()
        },
        SystemUser,
        { 
            echoToSender: false,
            sudo: true 
        }
    );
    
    await publisher.publish(message);
    logger.info(`Device registration message sent for device ${deviceId}`);
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
