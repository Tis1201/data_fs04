/**
 * MQTT RDP Handlers
 * 
 * Handles RDP-related MQTT RPC operations from web clients.
 * Similar to terminal handlers but for Remote Desktop Protocol.
 */

import type { RpcHandlerArgs, RpcResponse } from '../index';
import { sendNotificationWithTicket } from '../../core/publish';
import { DeviceNotificationType } from '../../core/publish';
import { logger } from '$lib/server/logger';
import { checkDeviceAccess } from './access_checker';
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
): Promise<RpcResponse<{ deviceId: string; flowId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebRDP] User ${sub} starting RDP on device ${deviceId}`, {
        options: params.options
    });

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send notification to device to start RDP
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.RDP,
        flowId,
        params: {
            action: 'rdp:start',
            options: params.options || {
                frameRate: 60,
                quality: 80,
                captureMode: 'screen'
            }
        },
        expiresIn: '30m'
    });

    logger.info(`[WebRDP] Dispatched RDP start for device ${deviceId} (flowId=${flowId})`);

    return {
        flowId,
        result: {
            deviceId,
            flowId
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

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Send notification to device to stop RDP
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.RDP,
        flowId,
        params: {
            action: 'rdp:stop'
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

