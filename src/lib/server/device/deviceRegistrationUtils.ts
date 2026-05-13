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
 * Sends standardized device registration message to device via MQTT
 * 
 * @deprecated Device registration is now handled via MQTT claim flow.
 * The device receives registration credentials (deviceId, apiKey, accountId) 
 * directly from the MQTT claim confirm handler response.
 * 
 * See: src/lib/server/mqtt/handlers/device/claim/handle_claim_confirm.ts
 * 
 * This function is kept for backward compatibility but does nothing.
 * All calls to this function should be removed.
 */
export async function sendDeviceRegistrationMessage(
    deviceId: string, 
    deviceData: DeviceRegistrationData
): Promise<void> {
    // No-op: Device registration now handled via MQTT claim flow
    // The device receives credentials directly from handle_claim_confirm response
    logger.debug(`[DeviceRegistration] Legacy sendDeviceRegistrationMessage called for device ${deviceId} - no-op (MQTT claim flow handles registration)`);
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
