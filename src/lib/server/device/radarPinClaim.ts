import { deviceHasActiveRadarSensor } from '$lib/server/device/radarRegistrationGuards';
import { deviceDisplayNameFromMac, formatMacAddress, macQueryVariants } from '$lib/utils/deviceUtils';
import { generateId } from 'lucia';
import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';

const PIN_CLAIM_RACE_MESSAGE =
    'This registration code was just used in another tab or session. Refresh the page and try again.';

const PIN_DEVICE_LINK_CONFLICT_MESSAGE =
    'This device is already linked to another registration code. Contact support if you need help.';

function isPrismaUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

function normalizeMacForCompare(value: string | null | undefined): string | null {
    if (!value?.trim()) return null;
    return value.trim().replace(/[\s:.\-]/g, '').toUpperCase();
}

/** True if any of the device's MAC fields matches a variant (colon or compact 12-hex set). */
function deviceMatchesMacVariants(
    dev: { macAddress?: string | null; wifiMac?: string | null; lanMac?: string | null },
    variants: string[]
): boolean {
    const strippedVariants = new Set(variants.map((v) => v.replace(/[\s:.\-]/g, '').toUpperCase()));
    for (const field of [dev.macAddress, dev.wifiMac, dev.lanMac]) {
        const n = normalizeMacForCompare(field);
        if (n && strippedVariants.has(n)) return true;
    }
    return false;
}

/**
 * Format factory hardware fingerprint as a display MAC when it is 6 bytes (12 hex digits).
 * Matches naming used in device.claim.confirm (MAC-style label, same as device list).
 */
export function macForDeviceRecordFromFingerprint(fp: string | null | undefined): string | null {
    if (!fp?.trim()) return null;
    const cleaned = fp.trim().replace(/[\s:.\-]/g, '');
    if (/^[0-9A-Fa-f]{12}$/i.test(cleaned)) {
        return formatMacAddress(cleaned);
    }
    return null;
}

/** Default Device + Sensor display name: `device - AA:BB:CC:DD:EE:FF` when fingerprint is a 12-hex MAC. */
export function defaultRadarDeviceSensorName(fp: string | null | undefined): string {
    const mac = macForDeviceRecordFromFingerprint(fp);
    if (!mac) return 'Unknown device';
    return deviceDisplayNameFromMac(mac);
}

export type ResolveRadarPinResult =
    | { deviceId: string; displayName: string; error?: undefined }
    | { deviceId: ''; displayName?: undefined; error: string };

/**
 * Sensor / controller label after PIN resolve: always use current `Device.name` from DB when set
 * (e.g. user renamed `"device - AA:BB:…"` → `"Store front"`). Falls back to `fallback` when name is empty.
 */
export async function getRadarSensorDisplayNameForDevice(
    prismaClient: PrismaClient,
    deviceId: string,
    fallback: string
): Promise<string> {
    const row = await prismaClient.device.findUnique({
        where: { id: deviceId },
        select: { name: true }
    });
    const fromDb = row?.name?.trim();
    if (fromDb) return fromDb;
    const fb = fallback?.trim();
    if (fb) return fb;
    return 'Unknown device';
}

/**
 * Resolve or create Device from PIN (Sensors / radar registration). Uses FactoryDevice.hardwareFingerprint for MAC-based names.
 */
export async function resolveDeviceIdByPinForRadar(
    prismaClient: PrismaClient,
    pin: string,
    currentAccountId: string,
    userId: string
): Promise<ResolveRadarPinResult> {
    const normalizedPin = pin.trim().toUpperCase().replace(/\s/g, '');
    if (!normalizedPin) return { deviceId: '', error: 'Device registration code (PIN) is required' };

    const factoryDevice = await prismaClient.factoryDevice.findFirst({
        where: { registrationPin: normalizedPin },
        include: {
            claimedDevice: {
                include: {
                    controllers: {
                        where: { type: 'radar', isDeleted: false },
                        include: { sensors: { where: { type: 'radar' } } }
                    }
                }
            }
        }
    });

    if (!factoryDevice) {
        return { deviceId: '', error: 'Invalid or expired PIN. Please check the 6-digit code on your device and try again.' };
    }

    if (factoryDevice.expiresAt && factoryDevice.expiresAt <= new Date()) {
        return { deviceId: '', error: 'This registration code has expired.' };
    }

    const displayNameFromFactory = defaultRadarDeviceSensorName(factoryDevice.hardwareFingerprint);
    const macForDevice = macForDeviceRecordFromFingerprint(factoryDevice.hardwareFingerprint);

    const fpVariants = macQueryVariants(factoryDevice.hardwareFingerprint) ?? [];

    if (factoryDevice.claimedDeviceId) {
        if (!factoryDevice.claimedDevice) {
            return {
                deviceId: '',
                error:
                    'This registration code points to a device that no longer exists. Contact support to reset the code.'
            };
        }
        const dev = factoryDevice.claimedDevice;
        if (dev.accountId !== currentAccountId) {
            return { deviceId: '', error: 'This device is already claimed by another account.' };
        }
        if (deviceHasActiveRadarSensor(dev.controllers)) {
            return { deviceId: '', error: 'This device already has an active radar sensor. Only one sensor per device is allowed.' };
        }
        if (fpVariants.length > 0 && !deviceMatchesMacVariants(dev, fpVariants)) {
            logger.warn(
                `[resolveDeviceIdByPinForRadar] Claimed device ${dev.id} MAC fields do not match factory fingerprint (factoryDeviceId=${factoryDevice.id})`
            );
        }
        return { deviceId: dev.id, displayName: dev.name };
    }

    const now = new Date();

    // Prefer an existing claimed device in this account that matches the factory MAC (colon/compact).
    if (fpVariants.length > 0) {
        const macOrFields = fpVariants.flatMap((v) => [
            { macAddress: { equals: v, mode: 'insensitive' as const } },
            { wifiMac: { equals: v, mode: 'insensitive' as const } },
            { lanMac: { equals: v, mode: 'insensitive' as const } }
        ]);

        const macMatches = await prismaClient.device.findMany({
            where: {
                accountId: currentAccountId,
                claimedAt: { not: null },
                OR: macOrFields
            },
            include: {
                controllers: {
                    where: { type: 'radar', isDeleted: false },
                    include: { sensors: { where: { type: 'radar' } } }
                },
                factoryRecord: true
            }
        });

        const uniqueById = [...new Map(macMatches.map((d) => [d.id, d])).values()];

        if (uniqueById.length > 1) {
            return {
                deviceId: '',
                error:
                    'Multiple devices in your account match this hardware address. Remove duplicates or contact support.'
            };
        }

        if (uniqueById.length === 1) {
            const dev = uniqueById[0];
            if (dev.factoryRecord && dev.factoryRecord.id !== factoryDevice.id) {
                return {
                    deviceId: '',
                    error:
                        'This device is already registered with a different PIN. Use the original registration flow or contact support.'
                };
            }
            if (deviceHasActiveRadarSensor(dev.controllers)) {
                return {
                    deviceId: '',
                    error: 'This device already has an active radar sensor. Only one sensor per device is allowed.'
                };
            }

            try {
                const linkResult = await prismaClient.factoryDevice.updateMany({
                    where: { id: factoryDevice.id, claimedDeviceId: null },
                    data: {
                        claimedAt: now,
                        claimedDeviceId: dev.id,
                        accountId: currentAccountId
                    }
                });

                if (linkResult.count === 0) {
                    const fresh = await prismaClient.factoryDevice.findUnique({
                        where: { id: factoryDevice.id },
                        select: { claimedDeviceId: true }
                    });
                    if (fresh?.claimedDeviceId === dev.id) {
                        logger.info(
                            `[resolveDeviceIdByPinForRadar] Factory already linked to same device (idempotent): deviceId=${dev.id}`
                        );
                        return { deviceId: dev.id, displayName: dev.name };
                    }
                    return { deviceId: '', error: PIN_CLAIM_RACE_MESSAGE };
                }
            } catch (err) {
                if (isPrismaUniqueViolation(err)) {
                    return { deviceId: '', error: PIN_DEVICE_LINK_CONFLICT_MESSAGE };
                }
                throw err;
            }

            logger.info(
                `[resolveDeviceIdByPinForRadar] Linked factory to existing device by MAC: deviceId=${dev.id}, factoryDeviceId=${factoryDevice.id}`
            );
            return { deviceId: dev.id, displayName: dev.name };
        }
    }

    const apiKey = generateId(32);

    try {
        const created = await prismaClient.$transaction(async (tx: Prisma.TransactionClient) => {
            const device = await tx.device.create({
                data: {
                    name: displayNameFromFactory,
                    status: 'ACTIVE',
                    accountId: currentAccountId,
                    createdBy: userId,
                    claimedAt: now,
                    claimedBy: userId,
                    apiKey,
                    apiKeyCreatedAt: now,
                    apiKeyRotatedAt: now,
                    ...(macForDevice ? { macAddress: macForDevice } : {})
                }
            });
            const linked = await tx.factoryDevice.updateMany({
                where: { id: factoryDevice.id, claimedDeviceId: null },
                data: {
                    claimedAt: now,
                    claimedDeviceId: device.id,
                    accountId: currentAccountId
                }
            });
            if (linked.count === 0) {
                throw new Error('FACTORY_CLAIM_RACE');
            }
            return device;
        });

        logger.info(`Claimed device by PIN for Sensors: deviceId=${created.id}, factoryDeviceId=${factoryDevice.id}`);
        return { deviceId: created.id, displayName: displayNameFromFactory };
    } catch (err) {
        if (err instanceof Error && err.message === 'FACTORY_CLAIM_RACE') {
            return { deviceId: '', error: PIN_CLAIM_RACE_MESSAGE };
        }
        if (isPrismaUniqueViolation(err)) {
            return { deviceId: '', error: PIN_DEVICE_LINK_CONFLICT_MESSAGE };
        }
        throw err;
    }
}
