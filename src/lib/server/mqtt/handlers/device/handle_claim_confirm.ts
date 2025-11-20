import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import type { RpcHandlerArgs, RpcResponse } from '../index';
import { decodeNotificationTicket, sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../core/publish';

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
): Promise<RpcResponse<{ status: string; deviceId: string; apiKey: string; accountId: string | null }>> {

    const { ticket, deviceInfo} = params;

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
    if (!owner) {
        throw new Error('Invalid claim ticket: missing subject');
    }
    const owner_parts = owner?.split(":");
    const owner_type = owner_parts?.[0];
    const owner_id = owner_parts?.[1];
    const owner_account_id = owner_parts?.[2];

    logger.info(`Owner: ${owner_type}:${owner_id}:${owner_account_id}`);


    
    // Convert factory device to actual device and generate an API key.
    const factoryDeviceIdParam = ctx.params?.factoryDeviceId as string | undefined;
    const factoryDeviceId = factoryDeviceIdParam ?? device_id;

    if (!factoryDeviceId) {
        throw new Error('Missing factoryDeviceId in claim ticket');
    }

    if (owner_type !== 'user' || !owner_id) {
        throw new Error('Invalid ticket subject for device claim confirmation');
    }

    const user = await prisma.user.findUnique({ where: { id: owner_id } });
    if (!user) {
        throw new Error('User for claim ticket not found');
    }

    let account: { id: string } | null = null;
    if (owner_account_id) {
        account = await prisma.account.findUnique({ where: { id: owner_account_id }, select: { id: true } });
        if (!account) {
            throw new Error('Account for claim ticket not found');
        }
    }

    const factoryDevice = await prisma.factoryDevice.findUnique({ where: { id: factoryDeviceId } });
    if (!factoryDevice) {
        throw new Error('Factory device for claim ticket not found');
    }

    if (account && factoryDevice.accountId && factoryDevice.accountId !== account.id) {
        throw new Error('Ticket account does not match factory device account');
    }

    const now = new Date();
    const apiKey = generateId(128);
    const nameFromHost =
        deviceInfo && typeof deviceInfo.hostname === 'string' && deviceInfo.hostname
            ? deviceInfo.hostname
            : undefined;
    const deviceName = nameFromHost ?? `Device ${factoryDeviceId.slice(0, 8)}`;

    const createdDevice = await prisma.$transaction(async (tx) => {
        const created = await tx.device.create({
            data: {
                name: deviceName,
                createdBy: user.id,
                accountId: account?.id ?? null,
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
            where: { id: factoryDevice.id },
            data: {
                claimedAt: now,
                claimedDeviceId: created.id,
                accountId: account?.id ?? factoryDevice.accountId ?? null
            }
        });

        return created;
    });

    logger.info(
        `[DeviceClaimConfirm] Created device ${createdDevice.id} for user ${user.id} account ${account?.id ?? 'n/a'} from factoryDevice ${factoryDevice.id}`
    );

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

    //Flip the sub and reciepent for REPLY
    if (!ctx.sub) {
        throw new Error('Missing subject in claim ticket');
    }
    sendNotificationWithTicket({
        prisma,
        sub: ctx.recipient,
        recipient: ctx.sub,
        type: `reply:${ctx.type}`,
        flowId: ctx.flowId,
        params: {
            deviceId: createdDevice.id,
            factoryDeviceId: factoryDevice.id,
            accountId: account?.id ?? null,
        },
        expiresIn: '5m'
    })

    // Return device credentials and account context to the device; a separate flow can notify the user.
    return {
        result: {
            status: 'ok',
            deviceId: createdDevice.id,
            apiKey,
            accountId: account?.id ?? null
        }
    };
}
