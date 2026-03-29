import { customAlphabet } from 'nanoid';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { handlePreclaimAutoClaim } from './handle_preclaim';

const pinGenerator = customAlphabet('ABCDEF0123456789', 6);

/********************************************************************************************
 * Device-side RPC handler: issues fresh factory registration PINs.
 ********************************************************************************************/
export async function handleGetPin(args: { topic: string; prisma: PrismaClient; params?: Record<string, any> }): Promise<{ pin: string }> {
    const { topic, prisma, params } = args;

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

    if (factoryDevice.expiresAt && factoryDevice.expiresAt <= new Date()) {
        throw new Error('Factory registration has expired');
    }

    // Extract MAC address from params (device sends it in get.pin request). Used for fingerprint backfill
    // and preclaim only — we do not reject get.pin when that MAC already exists on a claimed Device.
    // Sensor registration (?/create) may link this factory row to an existing device by MAC in-account;
    // MQTT device.claim.confirm still deduplicates MAC when creating a *new* Device.
    const macAddressRaw = params?.macAddress || params?.networkInfo?.mac || null;

    // Check if this factory device is already claimed
    if (factoryDevice.claimedDeviceId) {
        const claimedDevice = await prisma.device.findUnique({
            where: { id: factoryDevice.claimedDeviceId },
            select: {
                id: true,
                name: true,
                claimedBy: true,
                accountId: true
            }
        });

        if (claimedDevice) {
            logger.warn(
                `[DeviceGetPin] Factory device ${factoryDeviceId} is already claimed: deviceId=${claimedDevice.id}, claimedBy=${claimedDevice.claimedBy}, accountId=${claimedDevice.accountId ?? 'n/a'}`
            );
            throw new Error(
                `Device is already claimed. Please reconnect using device credentials (deviceId: ${claimedDevice.id})`
            );
        }
    }

    // Backfill hardwareFingerprint on FactoryDevice when missing but MAC is available.
    // This ensures the same physical device reuses the same FactoryDevice record on future mints.
    const macOrFingerprint = factoryDevice.hardwareFingerprint ?? macAddressRaw ?? null;
    if (!factoryDevice.hardwareFingerprint && macAddressRaw) {
        const stripped = String(macAddressRaw).trim().replace(/[\s:.\-]/g, '').toUpperCase();
        const normalizedMac = /^[0-9A-Fa-f]{12}$/i.test(stripped) ? stripped : String(macAddressRaw).trim().toUpperCase();
        const conflicting = await prisma.factoryDevice.findFirst({
            where: { hardwareFingerprint: normalizedMac, id: { not: factoryDeviceId } }
        });
        if (!conflicting) {
            await prisma.factoryDevice.update({
                where: { id: factoryDeviceId },
                data: { hardwareFingerprint: normalizedMac }
            });
            logger.info(`[DeviceGetPin] Backfilled hardwareFingerprint=${normalizedMac} on factoryDevice ${factoryDeviceId}`);
        }
    }

    try {
        await handlePreclaimAutoClaim({
            prisma,
            factoryDeviceId,
            hardwareFingerprint: macOrFingerprint
        });
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