import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { macQueryVariants } from '$lib/utils/deviceUtils';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';

interface HandlePreclaimArgs {
    prisma: PrismaClient;
    factoryDeviceId: string;
    hardwareFingerprint: string | null | undefined;
}

/**
 * Preclaim helper for factory get.pin.
 *
 * This is a side-effect only and MUST NOT change the get.pin RPC response shape.
 *
 * Behaviour:
 *  - If a matching, pending PreclaimDevice exists for the hardware fingerprint,
 *    send a `claim` notification ticket to the factory device so it can call
 *    `device.claim.confirm`.
 *  - If a claimed Device already exists for the fingerprint, log and skip.
 */
/** Normalize MAC/fingerprint for consistent lookup (trim, uppercase, strip delimiters). */
function normalizeMacOrFingerprint(value: string): string {
    return value.trim().toUpperCase();
}

/** Strip all MAC delimiters (colons, dashes, dots) so 24:1C:04 / 24-1C-04 / 241C04 all become the same value. */
function stripMacDelimiters(value: string): string {
    return value.replace(/[:\-. ]/g, '').toUpperCase();
}

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

    const normalized = normalizeMacOrFingerprint(hardwareFingerprint);
    const deviceMacVariants = macQueryVariants(hardwareFingerprint);
    const now = new Date();

    // Sniff test: see if a claimed Device already exists for this MAC/hardware fingerprint.
    const macOrFields = deviceMacVariants?.length
        ? deviceMacVariants.flatMap((v) => [{ macAddress: v }, { wifiMac: v }])
        : [{ macAddress: hardwareFingerprint }, { wifiMac: hardwareFingerprint }];

    const existingDevice = await prisma.device.findFirst({
        where: {
            claimedAt: { not: null },
            OR: [
                { hardwareId: normalized },
                { hardwareId: hardwareFingerprint },
                ...macOrFields
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

    const stripped = stripMacDelimiters(hardwareFingerprint);
    const preclaimMacIdVariants = [normalized, hardwareFingerprint.trim(), stripped];

    const preclaim = await prisma.preclaimDevice.findFirst({
        where: {
            AND: [
                { OR: preclaimMacIdVariants.map((v) => ({ macId: v })) },
                { status: 'PENDING', claimedAt: null },
                { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                {
                    set: {
                        status: 'ACTIVE',
                        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
                    }
                }
            ]
        },
        include: {
            set: true
        }
    });

    // If not found, try matching preclaims whose macId (after stripping delimiters) matches
    if (!preclaim) {
        const allPending = await prisma.preclaimDevice.findMany({
            where: {
                status: 'PENDING',
                claimedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                set: {
                    status: 'ACTIVE',
                    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
                }
            },
            include: { set: true }
        });
        const fuzzyMatch = allPending.find(p => p.macId && stripMacDelimiters(p.macId) === stripped);
        if (fuzzyMatch) {
            logger.info(
                `[DeviceGetPin] Fuzzy MAC match: preclaim macId="${fuzzyMatch.macId}" matched device MAC="${hardwareFingerprint}" (stripped=${stripped})`
            );
            return handlePreclaimMatch(prisma, factoryDeviceId, fuzzyMatch);
        }
    }

    if (!preclaim) {
        logger.debug(
            `[DeviceGetPin] No valid preclaim found for hardwareFingerprint ${hardwareFingerprint} (factoryDeviceId=${factoryDeviceId})`
        );
        return;
    }

    logger.info(
        `[DeviceGetPin] Preclaim branch candidate found for factoryDevice ${factoryDeviceId}: preclaimDeviceId=${preclaim.id}, setId=${preclaim.setId}, accountId=${preclaim.accountId}`
    );

    return handlePreclaimMatch(prisma, factoryDeviceId, preclaim);
}

async function handlePreclaimMatch(
    prisma: PrismaClient,
    factoryDeviceId: string,
    preclaim: { id: string; accountId: string | null; claimedBy: string | null; set: { createdBy: string | null } }
): Promise<void> {
    try {
        const resolvedUserId = preclaim.claimedBy ?? preclaim.set.createdBy;
        if (!resolvedUserId) {
            logger.error(
                `[DeviceGetPin] Cannot start preclaim flow for device ${preclaim.id}: no resolved userId (claimedBy/set.createdBy missing)`
            );
            return;
        }

        const accountId = preclaim.accountId;
        if (!accountId) {
            logger.error(
                `[DeviceGetPin] Cannot start preclaim flow for device ${preclaim.id}: missing accountId on preclaim`
            );
            return;
        }

        const sub = `user:${resolvedUserId}:${accountId}`;
        const flowId = preclaim.id;

        await sendNotificationWithTicket({
            prisma,
            sub,
            recipient: `factory:${factoryDeviceId}`,
            type: DeviceNotificationType.Claim,
            flowId,
            params: {
                factoryDeviceId,
                preclaimDeviceId: preclaim.id,
                accountId
            },
            expiresIn: '5m'
        });

        logger.info(
            `[DeviceGetPin] Sent preclaim claim notification for factoryDevice ${factoryDeviceId} to factory:${factoryDeviceId} for user ${sub}`
        );
    } catch (err) {
        logger.error(
            `[DeviceGetPin] Failed to send preclaim claim notification for factoryDevice ${factoryDeviceId}: ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }
}
