import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { checkDeviceAccess } from '../shared/access_checker';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '../../index';
import { TimeoutConfig } from '$lib/server/config/timeoutConfig';

interface TerminalConnectParams {
    deviceId?: string;
    rows?: number;
    cols?: number;
}

interface TerminalInputParams {
    deviceId?: string;
    input?: string;
}

interface TerminalResizeParams {
    deviceId?: string;
    rows?: number;
    cols?: number;
}

interface TerminalDisconnectParams {
    deviceId?: string;
}

/********************************************************************************************
 * Terminal Connect - Initialize terminal session on device
 ********************************************************************************************/
export async function handleTerminalConnect(
    params: TerminalConnectParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<{ deviceId: string; flowId: string; operationId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebTerminal] User ${sub} connecting to terminal on device ${deviceId}`);

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
        actionType: 'terminal',
        initiatedBy: userId,
        protocol: 'mqtt',
        metadata: {
            rows: params.rows || 24,
            cols: params.cols || 80,
            source: 'mqtt_rpc'
        },
        initialMessage: 'Terminal session initiated'
    });

    const flowId = crypto.randomUUID();

    // Send notification to device with operationId
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.Terminal,
        flowId,
        params: {
            operationId: actionLog.id,
            action: 'terminal:connect',
            deviceId: deviceId,
            rows: params.rows || 24,
            cols: params.cols || 80
        },
        expiresIn: '30m' // Terminal sessions can be long-lived
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
                action: 'terminal',
                status: 'initiated',
                message: 'Terminal session initiated',
                accountId: device.accountId
            });
        }
    } catch (broadcastError) {
        logger.warn(`[WebTerminal] Failed to broadcast initial status: ${broadcastError}`);
        // Don't fail the request if broadcast fails
    }

    logger.info(
        `[WebTerminal] Dispatched terminal connect for device ${deviceId} (flowId=${flowId}, operationId=${actionLog.id})`
    );

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
                await ActionLogger.finalize(actionLog.id, 'failed', 'Failed to connect: device did not respond within timeout');
                
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
                        action: 'terminal',
                        status: 'failed',
                        message: 'Failed to connect: device did not respond within timeout',
                        accountId: device.accountId
                    });
                }
            }
        } catch (timeoutErr) {
            logger.warn(`[WebTerminal] Failed to process timeout for ${actionLog.id}: ${String(timeoutErr)}`);
        }
    }, TimeoutConfig.DEVICE_TERMINAL);

    return { flowId, result: { deviceId, flowId, operationId: actionLog.id } };
}

/********************************************************************************************
 * Terminal Input - Send keyboard input to terminal
 ********************************************************************************************/
export async function handleTerminalInput(
    params: TerminalInputParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<void>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    if (!params.input && params.input !== '') {
        throw new Error('Input is required for terminal input');
    }

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.Terminal,
        flowId,
        params: {
            action: 'terminal:input',
            input: params.input
        },
        expiresIn: '5m'
    });

    // No need to log every keystroke
    // logger.debug(`[WebTerminal] Sent input to device ${deviceId}`);

    return { flowId, result: undefined };
}

/********************************************************************************************
 * Terminal Resize - Update terminal dimensions
 ********************************************************************************************/
export async function handleTerminalResize(
    params: TerminalResizeParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<void>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    if (!params.rows || !params.cols) {
        throw new Error('Rows and cols are required for terminal resize');
    }

    const flowId = crypto.randomUUID();

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.Terminal,
        flowId,
        params: {
            action: 'terminal:resize',
            rows: params.rows,
            cols: params.cols
        },
        expiresIn: '5m'
    });

    logger.info(
        `[WebTerminal] Dispatched terminal resize for device ${deviceId} (${params.cols}x${params.rows})`
    );

    return { flowId, result: undefined };
}

/********************************************************************************************
 * Terminal Disconnect - Close terminal session
 ********************************************************************************************/
export async function handleTerminalDisconnect(
    params: TerminalDisconnectParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<void>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebTerminal] User ${sub} disconnecting from terminal on device ${deviceId}`);

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    const flowId = crypto.randomUUID();

    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.Terminal,
        flowId,
        params: {
            action: 'terminal:disconnect',
            deviceId: deviceId
        },
        expiresIn: '5m'
    });

    logger.info(`[WebTerminal] Dispatched terminal disconnect for device ${deviceId}`);

    return { flowId, result: undefined };
}

