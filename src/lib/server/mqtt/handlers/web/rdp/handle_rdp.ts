/**
 * MQTT RDP Handlers
 * 
 * Handles RDP-related MQTT RPC operations from web clients.
 * Similar to terminal handlers but for Remote Desktop Protocol.
 */

import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { sendNotificationWithTicket } from '../../../core/publish';
import { DeviceNotificationType } from '../../../core/publish';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from '../shared/access_checker';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '../../index';
import { TimeoutConfig } from '$lib/server/config/timeoutConfig';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface RDPStartParams {
    deviceId: string;
    options?: {
        frameRate?: number;
        quality?: number;
        captureMode?: string;
    };
}

interface RDPStopParams {
    deviceId: string;
}

interface RDPControlParams {
    deviceId: string;
    controlType: string;
    data?: any;
}

// ============================================================================
// RPC HANDLERS
// ============================================================================

/**
 * Handle RDP start request
 * Initiates an RDP session with the device
 */
export async function handleRDPStart(
    params: RDPStartParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string; flowId: string; operationId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebRDP] User ${sub} starting RDP on device ${deviceId}`, {
        options: params.options
    });

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Extract user ID from subject (format: "user:userId:accountId")
    const userId = sub.split(':')[1];
    if (!userId) {
        throw new Error('Invalid subject format, cannot extract user ID');
    }

    // Create action log with "initiated" status
    const actionLog = await ActionLogger.createInitiated({
        deviceId,
        actionType: 'remote_desktop',
        initiatedBy: userId,
        protocol: 'mqtt',
        metadata: {
            options: params.options || {
                frameRate: 60,
                quality: 80,
                captureMode: 'screen'
            },
            source: 'mqtt_rpc'
        },
        initialMessage: 'RDP session initiated'
    });

    const flowId = crypto.randomUUID();

    // Send notification to device to start RDP with operationId
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.RDP,
        flowId,
        params: {
            operationId: actionLog.id,
            action: 'rdp:start',
            deviceId: deviceId,
            options: params.options || {
                frameRate: 60,
                quality: 80,
                captureMode: 'screen'
            }
        },
        expiresIn: '30m'
    });

    // Broadcast initial "initiated" status to UI
    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { accountId: true, createdBy: true }
        });

        if (device && device.accountId) {
            await broadcastDeviceActionUpdate({
                prisma,
                deviceId,
                logId: actionLog.id,
                action: 'remote_desktop',
                status: 'initiated',
                message: 'RDP session initiated',
                accountId: device.accountId
            });
        }
    } catch (broadcastError) {
        logger.warn(`[WebRDP] Failed to broadcast initial status: ${broadcastError}`);
        // Don't fail the request if broadcast fails
    }

    logger.info(`[WebRDP] Dispatched RDP start for device ${deviceId} (flowId=${flowId}, operationId=${actionLog.id})`);

    // Schedule timeout to mark as failed if device doesn't respond
    setTimeout(async () => {
        try {
            const current = await prisma.deviceActionLog.findUnique({
                where: { id: actionLog.id },
                select: { status: true }
            });
            if (!current) return;
            // Only mark as failed if still in initiated or in_progress status
            if (current.status === 'initiated' || current.status === 'in_progress') {
                await ActionLogger.finalize(actionLog.id, 'failed', 'Failed to start: device did not respond within timeout');
                
                // Broadcast failure status to UI
                const device = await prisma.device.findUnique({
                    where: { id: deviceId },
                    select: { accountId: true, createdBy: true }
                });

                if (device && device.accountId) {
                    await broadcastDeviceActionUpdate({
                        prisma,
                        deviceId,
                        logId: actionLog.id,
                        action: 'remote_desktop',
                        status: 'failed',
                        message: 'Failed to start: device did not respond within timeout',
                        accountId: device.accountId
                    });
                }
            }
        } catch (timeoutErr) {
            logger.warn(`[WebRDP] Failed to process timeout for ${actionLog.id}: ${String(timeoutErr)}`);
        }
    }, TimeoutConfig.DEVICE_RDP);

    return {
        flowId,
        result: {
            deviceId,
            flowId,
            operationId: actionLog.id
        }
    };
}

/**
 * Handle RDP stop request
 * Stops an active RDP session
 */
export async function handleRDPStop(
    params: RDPStopParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebRDP] User ${sub} stopping RDP on device ${deviceId}`);

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    const flowId = crypto.randomUUID();

    // Don't create a new action log for stop
    // Just send the notification to the device
    // The device will send a status update that can update the existing start log if needed
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.RDP,
        flowId,
        params: {
            action: 'rdp:stop',
            deviceId: deviceId
        },
        expiresIn: '5m'
    });

    logger.info(`[WebRDP] Dispatched RDP stop for device ${deviceId}`);

    return {
        flowId,
        result: {
            deviceId
        }
    };
}

/**
 * Handle RDP control messages (e.g., input events, configuration changes)
 */
export async function handleRDPControl(
    params: RDPControlParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.debug(`[WebRDP] User ${sub} sending RDP control to device ${deviceId}`, {
        controlType: params.controlType
    });

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send notification to device with control message
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.RDP,
        flowId,
        params: {
            action: 'rdp:control',
            controlType: params.controlType,
            data: params.data
        },
        expiresIn: '5m'
    });

    return {
        flowId,
        result: {
            deviceId
        }
    };
}

