import { logger } from '$lib/server/logger';
import type { RpcHandlerArgs } from '../index';

interface ClaimDeviceParams {
    pin?: string;
}

/**
 * Web-side claim handler.
 *
 * Called via MQTT RPC with op: 'web.claim.device' on a topic like:
 *   user:<id>/requests
 *
 * For now this is intentionally minimal: it just checks that the
 * provided PIN matches an existing factoryDevice.registrationPin
 * and returns that device's id so you can wire up the rest of the
 * claim flow without impacting other code paths.
 */
export async function handleClaimDevice(
    params: ClaimDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<{ deviceId: string } | never> {
    const pin = params.pin?.trim();

    if (!pin) {
        throw new Error('PIN is required');
    }

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    logger.info(`[WebClaim] User ${sub} attempting to claim device with PIN ${pin}`);

    // Look up a factory device by registrationPin
    const factoryDevice = await prisma.factoryDevice.findFirst({
        where: { registrationPin: pin }
    });

    if (!factoryDevice) {
        throw new Error('Invalid or expired PIN');
    }

    // For now, just return the device id. Full claim logic (linking
    // to a user account, clearing the PIN, etc.) can be added later.
    logger.info(
        `[WebClaim] PIN ${pin} matched factory device ${factoryDevice.id} for user ${sub}`
    );

    return { deviceId: factoryDevice.id };
}

