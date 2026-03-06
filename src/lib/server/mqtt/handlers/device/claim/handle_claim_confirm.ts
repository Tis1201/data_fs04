import { ClaimStatus } from '@prisma/client';
import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import { checkDeviceLimit, LimitExceededError } from '$lib/server/entitlements';
import { markPreclaimSetCompletedIfAllClaimed } from '$lib/server/device/devicePreclaim';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { decodeNotificationTicket, sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../../core/publish';

/********************************************************************************************
 * Device-side claim confirm handler: finalizes claim and provisions a real device.
 ********************************************************************************************/
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
        networkInfo?: {
            mac?: string | null;
            wifiMac?: string | null;
            lanMac?: string | null;
            hostname?: string | null;
            localIp?: string | null;
            publicIp?: string | null;
        };
        // allow extra fields without typing them all now
        [key: string]: unknown;
    };
    result?: Record<string, unknown>;
}

export async function handleClaimConfirm(
    params: DeviceClaimConfirmParams,
    { topic, sub, prisma }: RpcHandlerArgs
): Promise<{ status: string; deviceId: string; apiKey: string; accountId: string | null }> {
    const handlerStartTime = Date.now();
    logger.info(`[DeviceClaimConfirm] Handler started at ${new Date().toISOString()}`);

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

    // Check device limit before creating device (skip for admins)
    // TODO - enable it later
    // if (account && user.systemRole !== 'ADMIN') {
    //     try {
    //         await checkDeviceLimit(account.id);
    //     } catch (e) {
    //         if (e instanceof LimitExceededError) {
    //             logger.warn(`[DeviceClaimConfirm] Device limit reached for account ${account.id}`);
    //             throw new Error(`Device limit reached (${e.current}/${e.max}). Upgrade your plan to add more devices.`);
    //         }
    //         throw e;
    //     }
    // } else if (account && user.systemRole === 'ADMIN') {
    //     logger.info(`[DeviceClaimConfirm] Skipping device limit check for admin user ${user.id}`);
    // }

    const now = new Date();
    const preclaimDeviceId = ctx.params?.preclaimDeviceId as string | undefined;

    // Extract MAC addresses from deviceInfo — do not override wifiMac with lanMac when wifi is null
    const networkInfo = deviceInfo?.networkInfo;
    const networkMac = networkInfo?.mac;
    const rawWifiMac = typeof networkInfo?.wifiMac === 'string' ? networkInfo.wifiMac.trim() : null;
    const rawLanMac = typeof networkInfo?.lanMac === 'string' ? networkInfo.lanMac.trim() : null;
    const wifiMac = rawWifiMac && rawWifiMac.length > 0 ? rawWifiMac : null;
    const lanMac = rawLanMac && rawLanMac.length > 0 ? rawLanMac : null;
    // Primary MAC for identity/name/dedup: prefer lanMac, then wifiMac, then legacy networkInfo.mac
    const macAddress = lanMac ?? wifiMac ?? (typeof networkMac === 'string' && networkMac ? networkMac : null);

    // Check if device with same MAC address is already claimed (following MQTT flow)
    const orConditions: Array<{ macAddress?: string; wifiMac?: string; lanMac?: string }> = [
        ...(macAddress ? [{ macAddress }] : []),
        ...(wifiMac ? [{ wifiMac }] : []),
        ...(lanMac ? [{ lanMac }] : [])
    ];
    if (orConditions.length > 0) {
        const existingDevice = await prisma.device.findFirst({
            where: {
                OR: orConditions,
                claimedAt: { not: null } // Only check claimed devices
            },
            select: {
                id: true,
                name: true,
                claimedBy: true,
                accountId: true
            }
        });

        if (existingDevice) {
            logger.warn(
                `[DeviceClaimConfirm] Device with MAC ${macAddress} is already claimed: deviceId=${existingDevice.id}, claimedBy=${existingDevice.claimedBy}, accountId=${existingDevice.accountId ?? 'n/a'}`
            );
            throw new Error(`Device with MAC address ${macAddress} is already claimed`);
        }
    }

    const apiKey = generateId(128);

    // Device name format: "device - MAC-address" (e.g., "device - 82:B4:D5:BF:10:EB")
    // Always use MAC address for device name; fallback to generic name if MAC is missing
    const deviceName = macAddress ? `device - ${macAddress}` : 'device - unknown';

    let preclaimSetIdToComplete: string | null = null;

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
                macAddress: macAddress,
                wifiMac: wifiMac,
                lanMac: lanMac,
                apiKey,
                apiKeyCreatedAt: now,
                claimedAt: now
            }
        });

        // Only set hardwareFingerprint if:
        // 1. It's not already set on this factory device
        // 2. No other factory device already has this MAC as hardwareFingerprint
        let hardwareFingerprintToSet = factoryDevice.hardwareFingerprint;
        if (!hardwareFingerprintToSet && macAddress) {
            // Check if another factory device already has this MAC as hardwareFingerprint
            const existingFactoryDevice = await tx.factoryDevice.findFirst({
                where: {
                    hardwareFingerprint: macAddress,
                    id: { not: factoryDevice.id }
                },
                select: { id: true }
            });

            // Only set it if no other factory device has it
            if (!existingFactoryDevice) {
                hardwareFingerprintToSet = macAddress;
            }
        }

        await tx.factoryDevice.update({
            where: { id: factoryDevice.id },
            data: {
                claimedAt: now,
                claimedDeviceId: created.id,
                accountId: account?.id ?? factoryDevice.accountId ?? null,
                // Update hardwareFingerprint with MAC address if safe to do so
                hardwareFingerprint: hardwareFingerprintToSet
            }
        });

        // If this claim originated from a preclaim ticket, fulfill the preclaim row as well.
        if (preclaimDeviceId) {
            const preclaim = await tx.preclaimDevice.findUnique({
                where: { id: preclaimDeviceId }
            });

            if (!preclaim) {
                logger.warn(
                    `[DeviceClaimConfirm] Preclaim ${preclaimDeviceId} not found while confirming device ${created.id}; skipping preclaim update`
                );
            } else if (preclaim.status !== ClaimStatus.PENDING || preclaim.claimedAt) {
                logger.warn(
                    `[DeviceClaimConfirm] Preclaim ${preclaimDeviceId} no longer pending (status=${preclaim.status}); skipping preclaim update`
                );
            } else {
                await tx.preclaimDevice.update({
                    where: { id: preclaim.id },
                    data: {
                        status: ClaimStatus.FULFILLED,
                        claimedAt: now,
                        claimedBy: user.id,
                        deviceId: created.id
                    }
                });
                preclaimSetIdToComplete = preclaim.setId;
            }
        }

        return created;
    });

    if (preclaimSetIdToComplete) {
        try {
            await markPreclaimSetCompletedIfAllClaimed(prisma, preclaimSetIdToComplete);
        } catch (err) {
            logger.warn(
                `[DeviceClaimConfirm] Failed to mark preclaim set ${preclaimSetIdToComplete} completed: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

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

    // Flip the sub and recipient for REPLY and log notification send outcome
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
            accountId: account?.id ?? null
        },
        expiresIn: '5m'
    })
        .then(() => {
            logger.info(
                `[DeviceClaimConfirm] Sent claim reply notification for device ${createdDevice.id} to ${ctx.sub}`
            );
        })
        .catch((notifyErr) => {
            logger.error(
                `[DeviceClaimConfirm] Failed to send claim reply notification for device ${createdDevice.id}: ${notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
                }`
            );
        });

    // Return device credentials and account context to the device; a separate flow can notify the user.
    // Note: The result will be wrapped by the RPC handler in index.ts, so return the inner object directly
    const handlerDuration = Date.now() - handlerStartTime;
    logger.info(`[DeviceClaimConfirm] Handler completed in ${handlerDuration}ms, returning result at ${new Date().toISOString()}`);

    return {
        status: 'ok',
        deviceId: createdDevice.id,
        apiKey,
        accountId: account?.id ?? null
    };
}
