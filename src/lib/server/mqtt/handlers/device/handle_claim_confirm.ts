import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import type { RpcHandlerArgs, RpcResponse } from '../index';
import { resolveDeviceClaimContextFromTicket } from '../../core/claims';
import { decodeNotificationTicket, NotificationEventType, sendUserNotificationWithTicket } from '../../core/publish';
import type { NotificationTicketEnvelope } from '../../core/envelope';

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
): Promise<RpcResponse> {
    const { ticket, deviceInfo } = params;

    if (!ticket) {
        throw new Error('Missing ticket');
    }

    const ctx: NotificationTicketEnvelope = await decodeNotificationTicket(prisma, ticket);

    const device = ctx.recipient;
    const device_parts = device?.split(":");
    const device_type = device_parts?.[0];
    const device_id = device_parts?.[1];

    logger.info(`Device Claim Confirm: ${device_type}:${device_id}`);
   
    const owner = ctx.sub;
    const owner_parts = owner?.split(":");
    const owner_type = owner_parts?.[0];
    const owner_id = owner_parts?.[1];
    const owner_account_id = owner_parts?.[2];

    logger.info(`Owner: ${owner_type}:${owner_id}:${owner_account_id}`);


    
    // Convert factory device to actual device and generate an API key.
    // const now = new Date();
    // const apiKey = generateId(128);
    // const nameFromHost =
    //     deviceInfo && typeof deviceInfo.hostname === 'string' && deviceInfo.hostname
    //         ? deviceInfo.hostname
    //         : undefined;
    // const deviceName = nameFromHost ?? `Device ${ctx.recipient.slice(0, 8)}`;

    // const device = await prisma.$transaction(async (tx) => {
        

    //     const created = await tx.device.create({
    //         data: {
    //             name: deviceName,
    //             createdBy: ctx.user.id,
    //             accountId: ctx.account?.id ?? null,
    //             deviceType:
    //                 deviceInfo && typeof deviceInfo.deviceType === 'string'
    //                     ? deviceInfo.deviceType
    //                     : null,
    //             model:
    //                 deviceInfo && typeof deviceInfo.model === 'string' ? deviceInfo.model : null,
    //             osVersion:
    //                 deviceInfo && typeof deviceInfo.osVersion === 'string'
    //                     ? deviceInfo.osVersion
    //                     : null,
    //             apiKey,
    //             apiKeyCreatedAt: now,
    //             claimedAt: now
    //         }
    //     });

    //     await tx.factoryDevice.update({
    //         where: { id: ctx.factoryDevice.id },
    //         data: {
    //             claimedAt: now,
    //             claimedDeviceId: created.id,
    //             accountId: ctx.account?.id ?? ctx.factoryDevice.accountId ?? null
    //         }
    //     });

    //     return created;
    // });

    // logger.info(
    //     `[DeviceClaimConfirm] Created device ${device.id} for user ${ctx.user.id} account ${ctx.account?.id ?? 'n/a'} from factoryDevice ${ctx.factoryDevice.id}`
    // );

    // // TODO: Send a notification to the user
    // await sendUserNotificationWithTicket({
    //     sub: ctx.ticket.sub,
    //     type: NotificationEventType.ClaimConfirmed,
    //     requestId: ctx.ticket.requestId ?? undefined,
    //     payload: {
    //         deviceId: device.id,
    //         factoryDeviceId: ctx.factoryDevice.id,
    //         accountId: ctx.account?.id ?? null
    //     }
    // });
    // });

    // Return device credentials and account context to the device; a separate flow can notify the user.
    // return { status: 'ok', deviceId: device.id, apiKey, accountId: ctx.account?.id ?? null };

    return {flowId, {}}
}
