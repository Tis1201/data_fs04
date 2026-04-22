import type { RpcHandlerArgs, RpcResponse } from '$lib/server/mqtt/handlers/index';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from './shared/access_checker';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { ActionLogger } from '$lib/server/action-logger';
import { isControllerOnline } from '$lib/server/device/controllerPresence';

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
 * Pushes sensor configuration to the radar controller over MQTT (`device:…/controller/…/notifications`).
 * Requires the **radar bridge** session to be online (same as portal “Connection”), not the RDM agent row
 * `Device.connected`. Updates syncStatus to SYNCED on success, FAILED on error.
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

    // 3. Radar bridge must be online (controller MQTT session — not Prisma Device.connected / RDM agent)
    const controllerId = sensor.controller.id;
    const bridgeOnline = await isControllerOnline(controllerId);
    if (!bridgeOnline) {
        await prisma.sensor.update({
            where: { id: sensorId },
            data: { syncStatus: 'FAILED', lastSyncError: 'Radar bridge is offline' }
        });
        return {
            result: {
                synced: false,
                syncStatus: 'FAILED',
                error: 'Radar bridge is offline'
            }
        };
    }

    const controllerType = sensor.controller.type;

    logger.info(`[SensorConfig] Pushing config v${sensor.configVersion} to radar controller ${controllerType}:${controllerId} on device ${deviceId}`);

    // 4. Create action log (align with device action format for operationId/logId)
    const userId = sub.split(':')[1] ?? sub;
    const actionLog = await ActionLogger.createInitiated({
        deviceId,
        actionType: 'config_update',
        initiatedBy: userId,
        protocol: 'mqtt',
        metadata: { sensorId, controllerId, controllerType },
        initialMessage: 'Config push initiated'
    });

    const flowId = crypto.randomUUID();
    const operationId = actionLog.id;
    const logId = actionLog.id;

    // 5. Register waiter - wait for device reply before returning success to web client
    const { registerReplyWaiter } = await import('../../core/pending_reply_waiter');
    const replyPromise = registerReplyWaiter(logId, 30_000);

    // 6. Send via radar topic (device:<id>/controller/<type>:<cid>/notifications)
    // Per CONTROLLER.md: config push goes to radar topic, not device action topic
    // Include operationId, logId to align with device action format (refresh, reboot, etc.)
    const { createTicket } = await import('../../core/publish');
    const { getMqttTransport } = await import('../../core/transport');
    const recipient = `device:${deviceId}/controller/${controllerType}:${controllerId}`;
    const notificationTopic = `device:${deviceId}/controller/${controllerType}:${controllerId}/notifications`;

    const ticket = await createTicket(
        prisma,
        sub,
        recipient,
        'config.update',
        flowId,
        {
            sensorId,
            controllerId,
            controllerType,
            configVersion: sensor.configVersion,
            deviceId,
            config: sensor.config as Record<string, unknown>,
            operationId,
            logId,
            action: 'config.update'
        },
        '5m'
    );

    const transport = getMqttTransport();
    const payload = { ticket };
    await transport.publish(notificationTopic, JSON.stringify(payload), { qos: 1 });

    const replyTopic = `${recipient}/replies`;
    logger.info(`[SensorConfig] Published config.update notification`, {
        sensorId,
        deviceId,
        operationId,
        logId
    });
    logger.info(`[SensorConfig] INTEGRATION device app: subscribe=${notificationTopic} reply=${replyTopic} ticketParams=[sensorId,controllerId,configVersion,deviceId,operationId,logId,config] replyFormat=docs/architecture/device/mqtt/controllers/SENSOR_CONFIG.md#mobile-integration`);

    // 7. Wait for device reply before returning to web client (prevents "success before device reply" UX bug)
    let replyResult: { success: boolean; message?: string };
    try {
        replyResult = await replyPromise;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn(`[SensorConfig] Device did not reply in time`, { sensorId, logId, error: errMsg });
        await prisma.sensor.update({
            where: { id: sensorId },
            data: {
                syncStatus: 'FAILED',
                lastSyncError: 'Device did not reply in time'
            }
        });
        return {
            result: {
                synced: false,
                syncStatus: 'FAILED',
                error: 'Device did not reply in time'
            }
        };
    }

    if (!replyResult.success) {
        await prisma.sensor.update({
            where: { id: sensorId },
            data: {
                syncStatus: 'FAILED',
                lastSyncError: replyResult.message ?? 'Device reported failure'
            }
        });
        return {
            result: {
                synced: false,
                syncStatus: 'FAILED',
                error: replyResult.message ?? 'Device reported failure'
            }
        };
    }

    const now = new Date();
    await prisma.sensor.update({
        where: { id: sensorId },
        data: {
            syncStatus: 'SYNCED',
            lastSyncedAt: now,
            lastSyncError: null
        }
    });

    logger.info(`[SensorConfig] Config pushed successfully for sensor ${sensorId} (device replied)`);

    return {
        result: {
            synced: true,
            syncStatus: 'SYNCED',
            appliedAt: now.toISOString()
        }
    };
}
