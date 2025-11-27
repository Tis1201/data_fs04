import type { PrismaClient } from '@prisma/client';
import { ClaimStatus } from '@prisma/client';
import { generateId } from 'lucia';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../core/publish';

interface HandlePreclaimArgs {
    prisma: PrismaClient;
    factoryDeviceId: string;
    hardwareFingerprint: string | null | undefined;
}

/**
 * Auto-claim flow for preclaimed devices during factory get.pin.
 *
 * This is a side-effect only and MUST NOT change the get.pin RPC response shape.
 */
export async function handlePreclaimAutoClaim({
    prisma,
    factoryDeviceId,
    hardwareFingerprint
}: HandlePreclaimArgs): Promise<void> {
    if (!hardwareFingerprint) {
        logger.debug(
            `[DeviceGetPin] No hardwareFingerprint on factory device ${factoryDeviceId}; skipping preclaim check`
        );
        return;
    }

    const now = new Date();

    // Sniff test: see if a claimed Device already exists for this MAC/hardware fingerprint.
    const existingDevice = await prisma.device.findFirst({
        where: {
            claimedAt: { not: null },
            OR: [
                { hardwareId: hardwareFingerprint },
                { macAddress: hardwareFingerprint },
                { wifiMac: hardwareFingerprint }
            ]
        },
        select: {
            id: true,
            accountId: true
        }
    });

    if (existingDevice) {
        logger.warn(
            `[DeviceGetPin] Existing claimed device found for hardwareFingerprint ${hardwareFingerprint}: deviceId=${existingDevice.id}, accountId=${existingDevice.accountId ?? 'n/a'}`
        );
        return;
    }

    const preclaim = await prisma.preclaimDevice.findFirst({
        where: {
            macId: hardwareFingerprint,
            status: 'PENDING',
            claimedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            set: {
                status: 'ACTIVE',
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            }
        },
        include: {
            set: true
        }
    });

    if (!preclaim) {
        logger.debug(
            `[DeviceGetPin] No valid preclaim found for hardwareFingerprint ${hardwareFingerprint} (factoryDeviceId=${factoryDeviceId})`
        );
        return;
    }

    logger.info(
        `[DeviceGetPin] Preclaim branch candidate found for factoryDevice ${factoryDeviceId}: preclaimDeviceId=${preclaim.id}, setId=${preclaim.setId}, accountId=${preclaim.accountId}`
    );

    try {
        // Resolve claiming user from preclaim (claimedBy overrides set.createdBy)
        const resolvedUserId = preclaim.claimedBy ?? preclaim.set.createdBy;
        if (!resolvedUserId) {
            logger.error(
                `[DeviceGetPin] Cannot auto-claim preclaimed device ${preclaim.id}: no resolved userId (claimedBy/set.createdBy missing)`
            );
            return;
        }

        let createdDeviceId: string | null = null;
        let createdAccountId: string | null = null;

        await prisma.$transaction(async (tx) => {
            // Re-read preclaim row defensively inside the transaction
            const current = await tx.preclaimDevice.findUnique({
                where: { id: preclaim.id },
                include: { set: true }
            });

            if (!current) {
                logger.warn(
                    `[DeviceGetPin] Preclaim ${preclaim.id} disappeared before auto-claim; skipping`
                );
                return;
            }

            if (current.status !== 'PENDING' || current.claimedAt) {
                logger.warn(
                    `[DeviceGetPin] Preclaim ${preclaim.id} no longer pending (status=${current.status}); skipping auto-claim`
                );
                return;
            }

            const accountId = current.accountId;
            const userId = resolvedUserId;

            // Ensure account and user exist
            const [account, user] = await Promise.all([
                tx.account.findUnique({ where: { id: accountId }, select: { id: true } }),
                tx.user.findUnique({ where: { id: userId }, select: { id: true } })
            ]);

            if (!account || !user) {
                logger.error(
                    `[DeviceGetPin] Cannot auto-claim preclaim ${preclaim.id}: missing account or user (accountId=${accountId}, userId=${userId})`
                );
                return;
            }

            const autoClaimNow = new Date();
            const apiKey = generateId(128);

            const deviceName =
                current.name ??
                (hardwareFingerprint
                    ? `Device-${hardwareFingerprint}`
                    : `Device-${factoryDeviceId.slice(0, 8)}`);

            const createdDevice = await tx.device.create({
                data: {
                    name: deviceName,
                    createdBy: user.id,
                    accountId: account.id,
                    deviceType: null,
                    model: null,
                    manufacturer: null,
                    osVersion: null,
                    firmwareVersion: null,
                    hardwareId: hardwareFingerprint,
                    status: 'ACTIVE',
                    claimedAt: autoClaimNow,
                    claimedBy: user.id,
                    apiKey,
                    apiKeyCreatedAt: autoClaimNow,
                    apiKeyRotatedAt: autoClaimNow
                }
            });

            createdDeviceId = createdDevice.id;
            createdAccountId = account.id;

            await tx.factoryDevice.update({
                where: { id: factoryDeviceId },
                data: {
                    claimedAt: autoClaimNow,
                    claimedDeviceId: createdDevice.id,
                    accountId: account.id
                }
            });

            await tx.preclaimDevice.update({
                where: { id: current.id },
                data: {
                    status: ClaimStatus.FULFILLED,
                    claimedAt: autoClaimNow,
                    claimedBy: user.id,
                    deviceId: createdDevice.id
                }
            });

            logger.info(
                `[DeviceGetPin] Auto-claimed preclaimed device ${createdDevice.id} for account ${account.id} from preclaim ${current.id}`
            );
        });

        // After successful auto-claim, send a claimed notification to the user side
        // (without exposing the device apiKey).
        if (createdDeviceId && createdAccountId) {
            const flowId = createdDeviceId;
            try {
                await sendNotificationWithTicket({
                    prisma,
                    sub: `device:${createdDeviceId}`,
                    recipient: `user:${resolvedUserId}:${createdAccountId}`,
                    type: DeviceNotificationType.Claim,
                    flowId,
                    params: {
                        deviceId: createdDeviceId,
                        factoryDeviceId,
                        accountId: createdAccountId
                    },
                    expiresIn: '5m'
                });

                logger.info(
                    `[DeviceGetPin] Sent preclaim claimed notification for device ${createdDeviceId} to user ${resolvedUserId} account ${createdAccountId}`
                );
            } catch (notifyErr) {
                logger.error(
                    `[DeviceGetPin] Failed to send preclaim claimed notification for device ${createdDeviceId}: ${
                        notifyErr instanceof Error ? notifyErr.message : String(notifyErr)
                    }`
                );
            }
        }
    } catch (autoClaimErr) {
        logger.error(
            `[DeviceGetPin] Auto-claim failed for preclaim ${preclaim.id}: ${
                autoClaimErr instanceof Error ? autoClaimErr.message : String(autoClaimErr)
            }`
        );
    }
}
