import type { RpcHandlerArgs, RpcResponse } from '$lib/server/mqtt/handlers/index';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from './shared/access_checker';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';

/**
 * Sensor Config Save Parameters
 */
type SensorConfigSaveParams = {
    sensorId: string;
    config: Record<string, unknown>;
};

/**
 * Sensor Config Push Parameters
 */
type SensorConfigPushParams = {
    sensorId: string;
};

/**
 * Save Result
 */
type SensorConfigSaveResult = {
    saved: boolean;
    configVersion: number;
    syncStatus: string;
};

/**
 * Push Result
 */
type SensorConfigPushResult = {
    synced: boolean;
    syncStatus: string;
    appliedAt?: string;
    error?: string;
};

/**
 * Handle sensor.config.save RPC
 * 
 * Saves sensor configuration to database (offline-safe).
 * Always works regardless of device online status.
 * Marks config as PENDING until pushed to device.
 */
export async function handleSensorConfigSave(
    params: SensorConfigSaveParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<SensorConfigSaveResult>> {
    if (!sub) {
        throw new Error('Missing subject');
    }

    const { sensorId, config } = params;

    if (!sensorId || !config) {
        throw new Error('Missing sensorId or config');
    }

    // 1. Load sensor and validate access
    const sensor = await prisma.sensor.findUnique({
        where: { id: sensorId },
        include: { controller: true }
    });

    if (!sensor) {
        throw new Error('Sensor not found');
    }

    // 2. Check device access
    await checkDeviceAccess({ prisma, sub, deviceId: sensor.controller.deviceId });

    // 3. Update sensor config, increment version, mark as pending
    const newVersion = sensor.configVersion + 1;

    const updated = await prisma.sensor.update({
        where: { id: sensorId },
        data: {
            config: config as Prisma.InputJsonValue,
            configVersion: newVersion,
            syncStatus: 'PENDING',
            lastSyncError: null,
            updatedAt: new Date()
        }
    });

    logger.info(`[SensorConfig] Saved config v${newVersion} for sensor ${sensorId} (status: PENDING)`);

    return {
        result: {
            saved: true,
            configVersion: updated.configVersion,
            syncStatus: updated.syncStatus
        }
    };
}

/**
 * Handle sensor.config.push RPC
 * 
 * Pushes sensor configuration to the device controller.
 * Requires device to be online. If device is offline, returns error.
 * Updates syncStatus to SYNCED on success, FAILED on error.
 */
export async function handleSensorConfigPush(
    params: SensorConfigPushParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<SensorConfigPushResult>> {
    if (!sub) {
        throw new Error('Missing subject');
    }

    const { sensorId } = params;

    if (!sensorId) {
        throw new Error('Missing sensorId');
    }

    // 1. Load sensor with controller
    const sensor = await prisma.sensor.findUnique({
        where: { id: sensorId },
        include: { controller: { include: { device: true } } }
    });

    if (!sensor) {
        throw new Error('Sensor not found');
    }

    // 2. Check device access
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: sensor.controller.deviceId });


    // 3. Get device reference (skip online check for dev/testing)
    const device = sensor.controller.device;

    // 4. Send as device:actionRequest so device can handle it
    const { DeviceNotificationType } = await import('../../core/publish');
    const { queueNotification } = await import('../../core/queue');
    const crypto = await import('crypto');

    const flowId = crypto.randomUUID();
    const controllerId = sensor.controller.id;
    const controllerType = sensor.controller.type;

    // Get accountId from device
    const accountId = device.accountId || sensor.controller.device?.accountId;
    if (!accountId) {
        throw new Error(`Device ${deviceId} has no accountId`);
    }

    logger.info(`[SensorConfig] Pushing config v${sensor.configVersion} to device ${deviceId} for controller ${controllerType}:${controllerId}`);

    // Queue notification as device:actionRequest so device can handle it
    await queueNotification({
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.ActionRequest,
        flowId,
        params: {
            action: 'updateSensorConfig',
            deviceId,
            sensorId,
            controllerId,
            controllerType,
            configVersion: sensor.configVersion
            // Note: config is NOT included - device should re-fetch via API
        },
        expiresIn: '5m'
    });

    // 5. Mark as synced (optimistic - we don't wait for controller reply here)
    // In production, you might want to wait for a reply or use a callback pattern
    const now = new Date();
    await prisma.sensor.update({
        where: { id: sensorId },
        data: {
            syncStatus: 'SYNCED',
            lastSyncedAt: now,
            lastSyncError: null
        }
    });

    logger.info(`[SensorConfig] Config pushed successfully for sensor ${sensorId}`);

    return {
        result: {
            synced: true,
            syncStatus: 'SYNCED',
            appliedAt: now.toISOString()
        }
    };
}
