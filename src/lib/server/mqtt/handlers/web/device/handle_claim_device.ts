import { deviceHasActiveRadarSensor } from '$lib/server/device/radarRegistrationGuards';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcResponse, RpcHandlerArgs } from '../../index';

interface ClaimDeviceParams {
    pin?: string;
}

function normalizeRegistrationPin(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s/g, '');
}

/********************************************************************************************
 * Web-side claim handler: validates PINs and kicks off factory notification flow.
 *
 * - Fresh factory row → notify factory client to device.claim.confirm.
 * - Already linked Device with no radar controller → send reply:claim immediately so the user
 *   can finish the Radar wizard (HTTP ?/create partial failure or MQTT confirm without step 2).
 * - Device with radar → reject (fully registered).
 ********************************************************************************************/
export async function handleClaimDevice(
    params: ClaimDeviceParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ factoryDeviceId: string }> | never> {
    const pinRaw = params.pin?.trim();
    if (!pinRaw) {
        throw new Error('PIN is required');
    }
    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    const pin = normalizeRegistrationPin(pinRaw);
    if (!pin) {
        throw new Error('PIN is required');
    }

    logger.info(`[WebClaim] User ${sub} attempting to claim device with PIN ${pin}`);

    const factoryDevice = await prisma.factoryDevice.findFirst({
        where: { registrationPin: pin }
    });

    if (!factoryDevice) {
        throw new Error('Invalid or expired PIN');
    }

    if (factoryDevice.expiresAt && factoryDevice.expiresAt <= new Date()) {
        throw new Error('This registration code has expired');
    }

    const subParts = sub.split(':');
    if (subParts[0] !== 'user' || !subParts[1]) {
        throw new Error('Invalid user subject for claim');
    }
    const userId = subParts[1];
    const accountIdFromSub = subParts[2] ?? null;

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });
    if (!user) {
        throw new Error('User not found');
    }

    const flowId = crypto.randomUUID();

    if (factoryDevice.claimedDeviceId) {
        const claimedDevice = await prisma.device.findUnique({
            where: { id: factoryDevice.claimedDeviceId },
            include: {
                controllers: {
                    where: { type: 'radar', isDeleted: false },
                    include: { sensors: { where: { type: 'radar' } } }
                }
            }
        });

        if (!claimedDevice) {
            logger.error(
                `[WebClaim] Factory ${factoryDevice.id} has stale claimedDeviceId=${factoryDevice.claimedDeviceId}`
            );
            throw new Error('Invalid registration state for this code. Contact support.');
        }

        if (deviceHasActiveRadarSensor(claimedDevice.controllers)) {
            throw new Error(
                'This device is already registered. Open the Radar screen under Controllers to manage it.'
            );
        }

        if (claimedDevice.accountId) {
            if (accountIdFromSub && claimedDevice.accountId !== accountIdFromSub) {
                throw new Error('This device is already claimed by another account.');
            }
            if (!accountIdFromSub && claimedDevice.createdBy !== userId) {
                throw new Error('This device is already claimed. Select the correct account and try again.');
            }
        }

        await sendNotificationWithTicket({
            prisma,
            sub: `factory:${factoryDevice.id}`,
            recipient: sub,
            type: `reply:${DeviceNotificationType.Claim}`,
            flowId,
            params: {
                deviceId: claimedDevice.id,
                factoryDeviceId: factoryDevice.id,
                accountId: claimedDevice.accountId ?? null
            },
            expiresIn: '5m'
        });
        logger.info(
            `[WebClaim] Resume: device ${claimedDevice.id} has no radar sensor; sent reply:claim to ${sub}`
        );
        return { flowId, result: { factoryDeviceId: factoryDevice.id } };
    }

    if (factoryDevice.claimedAt) {
        throw new Error('Invalid factory device state. Contact support.');
    }

    logger.info(`[WebClaim] PIN ${pin} matched factory device ${factoryDevice.id} for user ${sub}`);

    try {
        await sendNotificationWithTicket({
            prisma,
            sub,
            recipient: `factory:${factoryDevice.id}`,
            type: DeviceNotificationType.Claim,
            flowId,
            params: {
                factoryDeviceId: factoryDevice.id,
                pin
            },
            expiresIn: '5m'
        });
    } catch (err) {
        logger.error(
            `[WebClaim] Failed to publish claim notification to factory:${factoryDevice.id}: ${
                err instanceof Error ? err.message : String(err)
            }`
        );
        throw new Error('Unable to reach the device for registration. Try again in a moment.');
    }

    return { flowId, result: { factoryDeviceId: factoryDevice.id } };
}
