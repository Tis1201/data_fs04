import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import type { RpcHandlerArgs } from '../index';
import { resolveDeviceClaimContextFromTicket } from '../../core/claims';

interface DeviceClaimConfirmParams {
    ticket?: string;
    deviceInfo?: {
        id?: string | null;
        deviceType?: string | null;
        model?: string | null;
        osVersion?: string | null;
        hostname?: string | null;
        pin?: string | null;
        senderId?: string | null;
        // allow extra fields without typing them all now
        [key: string]: unknown;
    };
    result?: Record<string, unknown>;
}

export async function handleClaimConfirm(
    params: DeviceClaimConfirmParams,
    { topic, sub, prisma }: RpcHandlerArgs
): Promise<{ status: string; deviceId: string; apiKey: string; accountId: string | null }> {
    const { ticket, deviceInfo } = params;

    if (!ticket) {
        throw new Error('Missing ticket');
    }

    const ctx = await resolveDeviceClaimContextFromTicket({ prisma, ticket, topic });

    logger.info(
        `[DeviceClaimConfirm] Received claim confirmation from ${sub ?? 'unknown'} on topic ${topic} for user ${ctx.user.id} account ${ctx.account?.id ?? 'n/a'} and factoryDevice ${ctx.factoryDevice.id} with claims ${JSON.stringify(
            ctx.ticket
        )}`
    );

    // Convert factory device to actual device and generate an API key.
    const now = new Date();
    const apiKey = generateId(128);
    const nameFromHost =
        deviceInfo && typeof deviceInfo.hostname === 'string' && deviceInfo.hostname
            ? deviceInfo.hostname
            : undefined;
    const deviceName = nameFromHost ?? `Device ${ctx.factoryDevice.id.slice(0, 8)}`;

    const device = await prisma.$transaction(async (tx) => {
        // Prevent double-claiming the same factory device.
        if (ctx.factoryDevice.claimedDeviceId) {
            throw new Error('Factory device already claimed');
        }

        const created = await tx.device.create({
            data: {
                name: deviceName,
                createdBy: ctx.user.id,
                accountId: ctx.account?.id ?? null,
                deviceType:
                    deviceInfo && typeof deviceInfo.deviceType === 'string'
                        ? deviceInfo.deviceType
                        : null,
                model:
                    deviceInfo && typeof deviceInfo.model === 'string' ? deviceInfo.model : null,
                osVersion:
                    deviceInfo && typeof deviceInfo.osVersion === 'string'
                        ? deviceInfo.osVersion
                        : null,
                apiKey,
                apiKeyCreatedAt: now,
                claimedAt: now
            }
        });

        await tx.factoryDevice.update({
            where: { id: ctx.factoryDevice.id },
            data: {
                claimedAt: now,
                claimedDeviceId: created.id,
                accountId: ctx.account?.id ?? ctx.factoryDevice.accountId ?? null
            }
        });

        return created;
    });

    logger.info(
        `[DeviceClaimConfirm] Created device ${device.id} for user ${ctx.user.id} account ${ctx.account?.id ?? 'n/a'} from factoryDevice ${ctx.factoryDevice.id}`
    );

    // Return device credentials and account context to the device; a separate flow can notify the user.
    return { status: 'ok', deviceId: device.id, apiKey, accountId: ctx.account?.id ?? null };
}
