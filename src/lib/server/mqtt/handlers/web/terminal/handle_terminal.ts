import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { checkDeviceAccess } from '../shared/access_checker';

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
): Promise<RpcResponse<{ deviceId: string; flowId: string }>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[WebTerminal] User ${sub} connecting to terminal on device ${deviceId}`);

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
            action: 'terminal:connect',
            rows: params.rows || 24,
            cols: params.cols || 80
        },
        expiresIn: '30m' // Terminal sessions can be long-lived
    });

    logger.info(
        `[WebTerminal] Dispatched terminal connect for device ${deviceId} (flowId=${flowId})`
    );

    return { flowId, result: { deviceId, flowId } };
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
            action: 'terminal:disconnect'
        },
        expiresIn: '5m'
    });

    logger.info(`[WebTerminal] Dispatched terminal disconnect for device ${deviceId}`);

    return { flowId, result: undefined };
}

