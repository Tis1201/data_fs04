import type { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * When an IoT device display name changes, keep linked radar controllers/sensors aligned
 * (same pattern as radar registration: sensor name = device name, controller name = "{name} Controller").
 */
export async function propagateDeviceNameToLinkedRadar(
    db: DbClient,
    deviceId: string,
    displayName: string
): Promise<void> {
    const now = new Date();
    const controllers = await db.controller.findMany({
        where: { deviceId, type: 'radar', isDeleted: false },
        select: { id: true }
    });
    if (controllers.length === 0) return;
    const controllerIds = controllers.map((c) => c.id);
    await db.controller.updateMany({
        where: { id: { in: controllerIds } },
        data: { name: `${displayName} Controller`, updatedAt: now }
    });
    await db.sensor.updateMany({
        where: { controllerId: { in: controllerIds }, type: 'radar' },
        data: { name: displayName, updatedAt: now }
    });
}

/**
 * Update radar sensor name/location and mirror the display name onto the linked Device and Controller.
 * Enforces sensor accountId and device.accountId match. Returns false if the row cannot be updated safely.
 */
export async function syncRadarSensorNameWithLinkedDevice(
    db: PrismaClient,
    params: {
        sensorId: string;
        name: string;
        location: string | null;
        accountId: string;
    }
): Promise<boolean> {
    return db.$transaction(async (tx) => {
        const sensor = await tx.sensor.findFirst({
            where: { id: params.sensorId, accountId: params.accountId, type: 'radar' },
            include: {
                controller: { select: { id: true, deviceId: true, type: true, isDeleted: true } }
            }
        });
        if (!sensor?.controller) return false;
        const c = sensor.controller;
        if (c.type !== 'radar' || c.isDeleted) return false;

        const linkedDevice = await tx.device.findFirst({
            where: { id: c.deviceId, accountId: params.accountId },
            select: { id: true }
        });
        if (!linkedDevice) return false;

        const now = new Date();
        await tx.sensor.update({
            where: { id: params.sensorId },
            data: {
                name: params.name,
                location: params.location,
                updatedAt: now
            }
        });
        await tx.device.update({
            where: { id: c.deviceId },
            data: { name: params.name, updatedAt: now }
        });
        await tx.controller.update({
            where: { id: c.id },
            data: { name: `${params.name} Controller`, updatedAt: now }
        });
        return true;
    });
}
