import crypto from 'crypto';
import { logger } from '$lib/server/logger';
import type { RpcHandlerArgs, RpcResponse } from '../../types';
import { checkDeviceAccess } from '../shared/access_checker';
import { sendNotificationWithTicket } from '../../../core/publish';
import { DeviceNotificationType } from '../../../core/publish';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '../../notifications/device_action_broadcaster';

interface AppActionParams {
    deviceId?: string;
    packageName: string;
    config?: any; // For config action
}

interface AppActionResult {
    success: boolean;
    operationId: string;
    deviceId: string;
    message: string;
}

/**
 * Generic app action handler
 * Handles restartApp, uninstall, config with consistent status tracking
 * 
 * Status lifecycle:
 * 1. init: "restart com.spectrio.io initiated"
 * 2. success: "restart com.spectrio.io success"
 * 3. fail: "restart com.spectrio.io error: {reason}"
 * 4. timeout: "restart com.spectrio.io error: timeout after 2 minutes"
 */
async function executeAppAction(
    actionType: 'restartApp' | 'uninstall' | 'config',
    params: AppActionParams,
    { prisma, sub }: RpcHandlerArgs
): Promise<RpcResponse<AppActionResult>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });
    const { packageName, config } = params;

    logger.info(`[WebAppAction] User ${sub} requesting ${actionType} for ${packageName} on device ${deviceId}`);

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Extract user ID from subject (format: "user:userId:accountId")
    const userId = sub.split(':')[1];
    if (!userId) {
        throw new Error('Invalid subject format, cannot extract user ID');
    }

    // Validate packageName
    if (!packageName || !packageName.trim()) {
        throw new Error('packageName is required');
    }

    // Map action type to database action type
    const dbActionType = {
        restartApp: 'restart_app',
        uninstall: 'uninstall_app',
        config: 'config_app'
    }[actionType];

    // Create initial message with package name
    const actionVerb = {
        restartApp: 'restart',
        uninstall: 'uninstall',
        config: 'config'
    }[actionType];
    
    const initialMessage = `${actionVerb} ${packageName} initiated`;

    // Create action log with "initiated" status
    const actionLog = await ActionLogger.createInitiated({
        deviceId,
        actionType: dbActionType as any,
        initiatedBy: userId,
        protocol: 'mqtt',
        metadata: {
            packageName,
            ...(config ? { config } : {}),
            source: 'mqtt_rpc'
        },
        initialMessage
    });

    const flowId = crypto.randomUUID();

    // Prepare device notification payload
    // Note: Device expects database action type names (restart_app, uninstall_app, config_app)
    const devicePayload: any = {
        operationId: actionLog.id,
        action: dbActionType,
        deviceId,
        packageName
    };

    if (config) {
        devicePayload.config = config;
    }

    // Send notification to device
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: DeviceNotificationType.ActionRequest,
        flowId,
        params: devicePayload,
        expiresIn: '5m' // 5 minutes timeout for app actions
    });

    // Broadcast initial "initiated" status to UI
    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { accountId: true, createdBy: true }
        });

        if (device && device.accountId) {
            logger.info(`[WebAppAction] Broadcasting initial status for action log ${actionLog.id}`, {
                logId: actionLog.id,
                action: dbActionType,
                deviceId,
                accountId: device.accountId,
                message: initialMessage
            });

            await broadcastDeviceActionUpdate({
                prisma,
                deviceId,
                logId: actionLog.id,
                action: dbActionType,
                status: 'initiated',
                message: initialMessage,
                accountId: device.accountId
            });

            logger.debug(`[WebAppAction] Broadcasted initial status for action log ${actionLog.id}`);
        } else {
            logger.warn(`[WebAppAction] Cannot broadcast initial status: device not found or missing accountId`, {
                deviceId,
                deviceExists: !!device,
                accountId: device?.accountId
            });
        }
    } catch (broadcastErr) {
        // Non-fatal error - log but don't fail the action
        logger.warn(`[WebAppAction] Failed to broadcast initial status:`, broadcastErr);
    }

    // Schedule timeout to mark as failed if device doesn't respond
    const timeoutMs = 2 * 60 * 1000; // 2 minutes
    setTimeout(async () => {
        try {
            const current = await prisma.deviceActionLog.findUnique({
                where: { id: actionLog.id },
                select: { status: true }
            });
            if (!current) return;
            
            // Only mark as failed if still in initiated or in_progress status
            if (current.status === 'initiated' || current.status === 'in_progress') {
                const timeoutMessage = `${actionVerb} ${packageName} error: timeout after 2 minutes`;
                await ActionLogger.finalize(actionLog.id, 'failed', timeoutMessage, 'timeout after 2 minutes');

                // Broadcast timeout status to UI
                const device = await prisma.device.findUnique({
                    where: { id: deviceId },
                    select: { accountId: true, createdBy: true }
                });

                if (device && device.accountId) {
                    await broadcastDeviceActionUpdate({
                        prisma,
                        deviceId,
                        logId: actionLog.id,
                        action: dbActionType,
                        status: 'failed',
                        message: timeoutMessage,
                        accountId: device.accountId
                    });
                }
            }
        } catch (timeoutErr) {
            logger.warn(`[WebAppAction] Failed to process timeout for ${actionLog.id}: ${String(timeoutErr)}`);
        }
    }, timeoutMs);

    logger.info(
        `[WebAppAction] Dispatched ${actionType} action for ${packageName} on device ${deviceId}, operation=${actionLog.id}`
    );

    return {
        flowId,
        result: {
            success: true,
            operationId: actionLog.id,
            deviceId,
            message: initialMessage
        }
    };
}

/**
 * Handle app restart action
 * RPC method: device.app.restart
 * 
 * @example
 * await callUserRpc('device.app.restart', { deviceId: '...', packageName: 'com.example.app' });
 */
export async function handleRestartApp(
    params: AppActionParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<AppActionResult>> {
    return executeAppAction('restartApp', params, args);
}

/**
 * Handle app uninstall action
 * RPC method: device.app.uninstall
 * 
 * @example
 * await callUserRpc('device.app.uninstall', { deviceId: '...', packageName: 'com.example.app' });
 */
export async function handleUninstallApp(
    params: AppActionParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<AppActionResult>> {
    return executeAppAction('uninstall', params, args);
}

/**
 * Handle app config action
 * RPC method: device.app.config
 * 
 * @example
 * await callUserRpc('device.app.config', { deviceId: '...', packageName: 'com.example.app', config: {...} });
 */
export async function handleConfigApp(
    params: AppActionParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<AppActionResult>> {
    return executeAppAction('config', params, args);
}
