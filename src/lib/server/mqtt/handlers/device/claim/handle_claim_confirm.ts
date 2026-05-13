import { ClaimStatus } from '@prisma/client';
import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import {
    deviceDisplayNameFromMac,
    macHardwareFingerprint,
    macQueryVariants,
    normalizeMacForStorage
} from '$lib/utils/deviceUtils';
import { deviceHasActiveRadarSensor } from '$lib/server/device/radarRegistrationGuards';
import { checkDeviceLimit, LimitExceededError } from '$lib/server/entitlements';
import { markPreclaimSetCompletedIfAllClaimed } from '$lib/server/device/devicePreclaim';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { decodeNotificationTicket, sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../../core/publish';

/** Prefer local LAN IP; fallback public. Skip empty / placeholder values from devices. */
function normalizeClaimIpForStorage(localIp?: string | null, publicIp?: string | null): string | null {
    const invalid = (s: string) => s === '' || /^unknown$/i.test(s);
    for (const raw of [localIp, publicIp]) {
        if (typeof raw !== 'string') continue;
        const t = raw.trim();
        if (!t || invalid(t)) continue;
        return t;
    }
    return null;
}

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

    // All errors from this point forward have ctx.sub (the original user), so we can notify them.
    // Wrap the rest of the handler so any failure sends an error notification back to the user,
    // preventing the browser from waiting until timeout.
    try {
        return await _handleClaimConfirmInner(ctx, deviceInfo ?? {}, prisma, handlerStartTime);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`[DeviceClaimConfirm] Claim failed, notifying user ${ctx.sub}: ${errorMessage}`);

        // Notify the original user of the failure so their browser gets the error instead of timing out
        if (ctx.sub && ctx.recipient) {
            try {
                await sendNotificationWithTicket({
                    prisma,
                    sub: ctx.recipient,
                    recipient: ctx.sub,
                    type: `error:${ctx.type}`,
                    flowId: ctx.flowId,
                    params: { error: errorMessage },
                    expiresIn: '5m'
                });
            } catch (notifyErr) {
                logger.warn(`[DeviceClaimConfirm] Failed to send error notification to ${ctx.sub}: ${notifyErr}`);
            }
        }

        throw err;
    }
}

async function _handleClaimConfirmInner(
    ctx: NotificationTicketEnvelope,
    deviceInfo: NonNullable<DeviceClaimConfirmParams['deviceInfo']>,
    prisma: RpcHandlerArgs['prisma'],
    handlerStartTime: number
): Promise<{ status: string; deviceId: string; apiKey: string; accountId: string | null }> {

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
    const wifiMacRaw = rawWifiMac && rawWifiMac.length > 0 ? rawWifiMac : null;
    const lanMacRaw = rawLanMac && rawLanMac.length > 0 ? rawLanMac : null;
    const primaryMacRaw =
        lanMacRaw ?? wifiMacRaw ?? (typeof networkMac === 'string' && networkMac ? networkMac.trim() : null);

    // Dedup: same physical NIC may be stored as compact hex or colon form — match all variants
    const macOverlapOr: Array<{
        macAddress?: { equals: string; mode: 'insensitive' };
        wifiMac?: { equals: string; mode: 'insensitive' };
        lanMac?: { equals: string; mode: 'insensitive' };
    }> = [];
    const seenCompact = new Set<string>();
    for (const raw of [primaryMacRaw, wifiMacRaw, lanMacRaw]) {
        if (!raw?.trim()) continue;
        const vars = macQueryVariants(raw);
        if (!vars) continue;
        const compact = vars[1];
        if (seenCompact.has(compact)) continue;
        seenCompact.add(compact);
        for (const v of vars) {
            macOverlapOr.push(
                { macAddress: { equals: v, mode: 'insensitive' } },
                { wifiMac: { equals: v, mode: 'insensitive' } },
                { lanMac: { equals: v, mode: 'insensitive' } }
            );
        }
    }
    const macAddress = normalizeMacForStorage(primaryMacRaw);
    const wifiMac = normalizeMacForStorage(wifiMacRaw);
    const lanMac = normalizeMacForStorage(lanMacRaw);
    const ipAddressForDevice = normalizeClaimIpForStorage(networkInfo?.localIp, networkInfo?.publicIp);

    type MacMatchDevice = {
        id: string;
        name: string;
        claimedBy: string | null;
        accountId: string | null;
        apiKey: string | null;
        controllers: Array<{ type: string; isDeleted: boolean; sensors: { type: string }[] }>;
    };

    let adoptDevice: MacMatchDevice | null = null;

    if (macOverlapOr.length > 0) {
        const existingDevice = await prisma.device.findFirst({
            where: {
                OR: macOverlapOr,
                claimedAt: { not: null }
            },
            select: {
                id: true,
                name: true,
                claimedBy: true,
                accountId: true,
                apiKey: true,
                controllers: {
                    where: { type: 'radar', isDeleted: false },
                    select: {
                        type: true,
                        isDeleted: true,
                        sensors: { where: { type: 'radar' }, select: { type: true } }
                    }
                }
            }
        });

        if (existingDevice) {
            if (!account?.id) {
                throw new Error('Account context is required to complete registration.');
            }
            if (existingDevice.accountId !== account.id) {
                throw new Error('This device is already registered to another account.');
            }
            if (deviceHasActiveRadarSensor(existingDevice.controllers)) {
                throw new Error(
                    'This device already has a radar sensor. Open the Radar screen under Controllers to manage it.'
                );
            }
            adoptDevice = existingDevice;
            logger.info(
                `[DeviceClaimConfirm] Same-account MAC match, no radar yet - will adopt device ${existingDevice.id} (keep name/profile; wizard creates sensor only)`
            );
        }
    }

    let finalDeviceId: string;
    let finalApiKey: string;
    let preclaimSetIdToComplete: string | null = null;

    if (adoptDevice) {
        const fpCompact = macHardwareFingerprint(primaryMacRaw);

        const adoptResult = await prisma.$transaction(async (tx) => {
            const freshFactory = await tx.factoryDevice.findUnique({ where: { id: factoryDevice.id } });
            if (!freshFactory) {
                throw new Error('Factory device not found');
            }
            if (
                freshFactory.claimedDeviceId &&
                freshFactory.claimedDeviceId !== adoptDevice!.id
            ) {
                throw new Error('This registration code is already linked to another device.');
            }

            // claimedDeviceId is unique — clear other factory rows pointing at this device so this PIN can link
            await tx.factoryDevice.updateMany({
                where: {
                    claimedDeviceId: adoptDevice!.id,
                    id: { not: factoryDevice.id }
                },
                data: {
                    claimedDeviceId: null,
                    claimedAt: null,
                    accountId: null
                }
            });

            let hardwareFingerprintToSet = freshFactory.hardwareFingerprint;
            if (!hardwareFingerprintToSet && fpCompact) {
                const fpIn = macQueryVariants(primaryMacRaw) ?? [fpCompact];
                const conflicting = await tx.factoryDevice.findFirst({
                    where: {
                        hardwareFingerprint: { in: fpIn },
                        id: { not: factoryDevice.id }
                    },
                    select: { id: true }
                });
                if (!conflicting) {
                    hardwareFingerprintToSet = fpCompact;
                }
            }

            await tx.factoryDevice.update({
                where: { id: factoryDevice.id },
                data: {
                    claimedAt: now,
                    claimedDeviceId: adoptDevice!.id,
                    accountId: account!.id,
                    ...(hardwareFingerprintToSet ? { hardwareFingerprint: hardwareFingerprintToSet } : {})
                }
            });

            const deviceRow = await tx.device.findUnique({ where: { id: adoptDevice!.id } });
            if (deviceRow) {
                const macPatch: {
                    macAddress?: string;
                    wifiMac?: string;
                    lanMac?: string;
                    ipAddress?: string;
                } = {};
                if (macAddress && !deviceRow.macAddress) macPatch.macAddress = macAddress;
                if (wifiMac && !deviceRow.wifiMac) macPatch.wifiMac = wifiMac;
                if (lanMac && !deviceRow.lanMac) macPatch.lanMac = lanMac;
                if (ipAddressForDevice && !deviceRow.ipAddress) macPatch.ipAddress = ipAddressForDevice;
                if (Object.keys(macPatch).length > 0) {
                    await tx.device.update({ where: { id: adoptDevice!.id }, data: macPatch });
                }
            }

            let api = adoptDevice!.apiKey;
            if (!api) {
                api = generateId(128);
                await tx.device.update({
                    where: { id: adoptDevice!.id },
                    data: {
                        apiKey: api,
                        apiKeyCreatedAt: now,
                        apiKeyRotatedAt: now
                    }
                });
            }

            let txPreclaimSetId: string | null = null;
            if (preclaimDeviceId) {
                const preclaim = await tx.preclaimDevice.findUnique({
                    where: { id: preclaimDeviceId }
                });

                if (!preclaim) {
                    logger.warn(
                        `[DeviceClaimConfirm] Preclaim ${preclaimDeviceId} not found while adopting device ${adoptDevice!.id}; skipping preclaim update`
                    );
                } else if (preclaim.status !== ClaimStatus.PENDING || preclaim.claimedAt) {
                    logger.warn(
                        `[DeviceClaimConfirm] Preclaim ${preclaimDeviceId} no longer pending (status=${preclaim.status}); skipping preclaim update`
                    );
                } else if (preclaim.deviceId && preclaim.deviceId !== adoptDevice!.id) {
                    logger.warn(
                        `[DeviceClaimConfirm] Preclaim deviceId ${preclaim.deviceId} does not match adopted device ${adoptDevice!.id}; skipping preclaim update`
                    );
                } else {
                    await tx.preclaimDevice.update({
                        where: { id: preclaim.id },
                        data: {
                            status: ClaimStatus.FULFILLED,
                            claimedAt: now,
                            claimedBy: user.id,
                            deviceId: adoptDevice!.id
                        }
                    });
                    txPreclaimSetId = preclaim.setId;
                }
            }

            return { deviceId: adoptDevice!.id, apiKey: api, preclaimSetId: txPreclaimSetId };
        });

        finalDeviceId = adoptResult.deviceId;
        finalApiKey = adoptResult.apiKey;
        preclaimSetIdToComplete = adoptResult.preclaimSetId;
    } else {
        const apiKey = generateId(128);

        const deviceName = macAddress ? deviceDisplayNameFromMac(macAddress) : 'Unknown device';

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
                    ...(ipAddressForDevice ? { ipAddress: ipAddressForDevice } : {}),
                    apiKey,
                    apiKeyCreatedAt: now,
                    claimedAt: now
                }
            });

            let hardwareFingerprintToSet = factoryDevice.hardwareFingerprint;
            const fpCompactCreate = macHardwareFingerprint(primaryMacRaw);
            if (!hardwareFingerprintToSet && fpCompactCreate) {
                const fpIn = macQueryVariants(primaryMacRaw) ?? [fpCompactCreate];
                const existingFactoryDevice = await tx.factoryDevice.findFirst({
                    where: {
                        hardwareFingerprint: { in: fpIn },
                        id: { not: factoryDevice.id }
                    },
                    select: { id: true }
                });

                if (!existingFactoryDevice) {
                    hardwareFingerprintToSet = fpCompactCreate;
                }
            }

            await tx.factoryDevice.update({
                where: { id: factoryDevice.id },
                data: {
                    claimedAt: now,
                    claimedDeviceId: created.id,
                    accountId: account?.id ?? factoryDevice.accountId ?? null,
                    hardwareFingerprint: hardwareFingerprintToSet
                }
            });

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

        finalDeviceId = createdDevice.id;
        finalApiKey = apiKey;

        logger.info(
            `[DeviceClaimConfirm] Created device ${finalDeviceId} for user ${user.id} account ${account?.id ?? 'n/a'} from factoryDevice ${factoryDevice.id}`
        );
    }

    if (preclaimSetIdToComplete) {
        try {
            await markPreclaimSetCompletedIfAllClaimed(prisma, preclaimSetIdToComplete);
        } catch (err) {
            logger.warn(
                `[DeviceClaimConfirm] Failed to mark preclaim set ${preclaimSetIdToComplete} completed: ${err instanceof Error ? err.message : String(err)}`
            );
        }
    }

    if (adoptDevice) {
        logger.info(
            `[DeviceClaimConfirm] Adopted existing device ${finalDeviceId} for user ${user.id} account ${account?.id ?? 'n/a'} from factoryDevice ${factoryDevice.id}`
        );
    }

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
            deviceId: finalDeviceId,
            factoryDeviceId: factoryDevice.id,
            accountId: account?.id ?? null
        },
        expiresIn: '5m'
    })
        .then(() => {
            logger.info(
                `[DeviceClaimConfirm] Sent claim reply notification for device ${finalDeviceId} to ${ctx.sub}`
            );
        })
        .catch((notifyErr) => {
            logger.error(
                `[DeviceClaimConfirm] Failed to send claim reply notification for device ${finalDeviceId}: ${notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
                }`
            );
        });

    const handlerDuration = Date.now() - handlerStartTime;
    logger.info(`[DeviceClaimConfirm] Handler completed in ${handlerDuration}ms, returning result at ${new Date().toISOString()}`);

    return {
        status: 'ok',
        deviceId: finalDeviceId,
        apiKey: finalApiKey,
        accountId: account?.id ?? null
    };
}
