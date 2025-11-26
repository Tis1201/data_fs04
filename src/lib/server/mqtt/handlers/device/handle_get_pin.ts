import { customAlphabet } from 'nanoid';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

const pinGenerator = customAlphabet('ABCDEF0123456789', 6);

/********************************************************************************************
 * Device-side RPC handler: issues fresh factory registration PINs.
 ********************************************************************************************/
export async function handleGetPin(args: { topic: string; prisma: PrismaClient }): Promise<{ pin: string }> {
    const { topic, prisma } = args;

    logger.info(`[DeviceGetPin] Handling get.pin RPC for topic ${topic}`);

    // Extract sub from topic: device/{sub}/requests
    const topicParts = topic.split('/');
    if (topicParts.length < 3) {
        throw new Error('Invalid topic format');
    }
    const sub = topicParts[1];

    // Check that sub starts with 'factory:'
    if (!sub.startsWith('factory:')) {
        throw new Error('Only factory devices can generate PINs');
    }

    // Extract factory device ID from sub
    const factoryDeviceId = sub.replace('factory:', '');
    if (!factoryDeviceId) {
        throw new Error('Invalid factory device ID');
    }

    // Get the factory device record
    const factoryDevice = await prisma.factoryDevice.findUnique({
        where: { id: factoryDeviceId }
    });

    if (!factoryDevice) {
        throw new Error('Factory device not found');
    }

    // Optional: check for pre-claim mappings based on hardware fingerprint.
    // This is a side-effect only; it must not change the RPC response shape.
    try {
        const hardwareFingerprint = factoryDevice.hardwareFingerprint;
        if (!hardwareFingerprint) {
            logger.debug(
                `[DeviceGetPin] No hardwareFingerprint on factory device ${factoryDeviceId}; skipping preclaim check`
            );
        } else {
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
            } else {
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

                if (preclaim) {
                    logger.info(
                        `[DeviceGetPin] Preclaim branch candidate found for factoryDevice ${factoryDeviceId}: preclaimDeviceId=${preclaim.id}, setId=${preclaim.setId}, accountId=${preclaim.accountId}`
                    );
                } else {
                    logger.debug(
                        `[DeviceGetPin] No valid preclaim found for hardwareFingerprint ${hardwareFingerprint} (factoryDeviceId=${factoryDeviceId})`
                    );
                }
            }
        }
    } catch (err) {
        logger.error(
            `[DeviceGetPin] Preclaim check failed for factoryDevice ${factoryDeviceId}: ${
                err instanceof Error ? err.message : String(err)
            }`
        );
    }

    // Generate unique PIN with collision check
    let pin: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
        pin = pinGenerator();
        attempts++;

        // Check if PIN already exists in any factory device
        const existingPin = await prisma.factoryDevice.findFirst({
            where: { registrationPin: pin }
        });

        if (!existingPin) {
            break; // Found unique PIN
        }

        if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique PIN after maximum attempts');
        }
    } while (true);

    // Save the PIN to the factory device record
    await prisma.factoryDevice.update({
        where: { id: factoryDeviceId },
        data: { registrationPin: pin }
    });

    logger.info(`Generated registration PIN ${pin} for factory device ${factoryDeviceId}`);

    return { pin };
}