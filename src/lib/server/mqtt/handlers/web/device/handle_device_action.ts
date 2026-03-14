import crypto from 'node:crypto';
import { logger } from '$lib/server/logger';
import { DeviceNotificationType, sendNotificationWithTicket } from '../../../core/publish';
import type { RpcHandlerArgs, RpcResponse } from '../../index';
import { checkDeviceAccess } from '../shared/access_checker';
import { ActionLogger } from '$lib/server/action-logger';
import { getStorageConfig, generatePresignedUrl, convertGCloudUrlToSignedDownloadUrl } from '$lib/server/storage';
import { extractFilenameWithExtension, isCloudStorageUrl, type DownloadAuthHmac } from '$lib/server/storage/gcloudUrlUtils';
import { broadcastDeviceActionUpdate } from '../../index';

interface DeviceActionParams {
    deviceId: string;
    [key: string]: any;
}

interface DeviceActionResult {
    success: boolean;
    operationId: string;
    deviceId: string;
    message: string;
}

/**
 * Generic device action handler that creates action logs and sends notifications
 */
async function executeDeviceAction(
    actionType: string,
    notificationType: DeviceNotificationType,
    params: DeviceActionParams,
    { prisma, sub }: RpcHandlerArgs,
    additionalParams: Record<string, any> = {}
): Promise<RpcResponse<DeviceActionResult>> {
    const { deviceId } = await checkDeviceAccess({ prisma, sub, deviceId: params.deviceId });

    logger.info(`[Web${actionType}] User ${sub} requesting ${actionType} for device ${deviceId}`);

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    // Extract user ID from subject (format: "user:userId:accountId")
    const userId = sub.split(':')[1];
    if (!userId) {
        throw new Error('Invalid subject format, cannot extract user ID');
    }

    // Create action log
    const normalizedActionType = actionType.toLowerCase().replace(/\s/g, '_');
    const actionLog = await ActionLogger.createInitiated({
        deviceId,
        actionType: normalizedActionType as any,
        initiatedBy: userId,
        protocol: 'mqtt',
        metadata: {
            ...params,
            ...additionalParams,
            source: 'mqtt_rpc'
        },
        initialMessage: `${actionType} initiated`
    });

    const flowId = crypto.randomUUID();

    // Send notification to device
    await sendNotificationWithTicket({
        prisma,
        sub,
        recipient: `device:${deviceId}`,
        type: notificationType,
        flowId,
        params: {
            operationId: actionLog.id,
            ...params,
            ...additionalParams
        },
        expiresIn: '30m'
    });

    // Broadcast initial "initiated" status to UI
    try {
        // Fetch device to get accountId for broadcasting
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { accountId: true, createdBy: true }
        });

        if (device && device.accountId) {
            logger.info(`[Web${actionType}] Broadcasting initial status for action log ${actionLog.id}`, {
                logId: actionLog.id,
                action: normalizedActionType,
                deviceId,
                accountId: device.accountId
            });

            await broadcastDeviceActionUpdate({
                prisma,
                deviceId,
                logId: actionLog.id,
                action: normalizedActionType,
                status: 'initiated',
                message: `${actionType} initiated`,
                accountId: device.accountId
            });

            logger.debug(`[Web${actionType}] Broadcasted initial status for action log ${actionLog.id}`);
        } else {
            logger.warn(`[Web${actionType}] Cannot broadcast initial status: device not found or missing accountId`, {
                deviceId,
                deviceExists: !!device,
                accountId: device?.accountId
            });
        }
    } catch (broadcastErr) {
        // Non-fatal error - log but don't fail the action
        logger.warn(`[Web${actionType}] Failed to broadcast initial status:`, broadcastErr);
    }

    logger.info(
        `[Web${actionType}] Dispatched ${actionType} action for device ${deviceId}, operation=${actionLog.id}`
    );

    return {
        flowId,
        result: {
            success: true,
            operationId: actionLog.id,
            deviceId,
            message: `${actionType} command sent to device`
        }
    };
}

/**
 * Handle device refresh action
 */
export async function handleRefreshDevice(
    params: DeviceActionParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    return executeDeviceAction(
        'Refresh',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        { action: 'refresh' }
    );
}

/**
 * Handle device reboot action
 */
export async function handleRebootDevice(
    params: DeviceActionParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    return executeDeviceAction(
        'Reboot',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        { action: 'reboot' }
    );
}

/**
 * Handle firmware update action
 */
export interface UpdateFirmwareParams extends DeviceActionParams {
    firmwareVersion: string;
    resourceId: string;
}

export async function handleUpdateFirmware(
    params: UpdateFirmwareParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    if (!params.firmwareVersion || !params.resourceId) {
        throw new Error('firmwareVersion and resourceId are required');
    }

    return executeDeviceAction(
        'Firmware Update',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        {
            action: 'updateFirmware',
            firmwareVersion: params.firmwareVersion,
            resourceId: params.resourceId
        }
    );
}

/**
 * Handle app installation action
 */
export interface InstallAppParams extends DeviceActionParams {
    packageName: string;
    resourceId: string;
}

export async function handleInstallApp(
    params: InstallAppParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    if (!params.packageName || !params.resourceId) {
        throw new Error('packageName and resourceId are required');
    }

    const { prisma } = args;
    const { resourceId } = params;

    // Fetch resource from database
    const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: {
            id: true,
            name: true,
            path: true,
            size: true,
            type: true,
            packageName: true
        }
    });

    if (!resource) {
        throw new Error('Resource not found');
    }

    if (!resource.path) {
        throw new Error('Resource has no file path');
    }

    // Extract filename with extension from path
    const filename = extractFilenameWithExtension(resource.path, resource.name);

    // Generate download URL: LOCAL mode uses static file URL; cloud uses signed or HMAC URL
    const storageConfig = getStorageConfig();
    let downloadUrl: string;
    let downloadAuth: DownloadAuthHmac | undefined;

    if (storageConfig.mode === 'LOCAL' && !isCloudStorageUrl(resource.path)) {
        // LOCAL storage: file is in static/uploads/iot/ - build direct URL
        const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
        const pathForUrl = resource.path.startsWith('/') ? resource.path : `/uploads/iot/${resource.path}`;
        downloadUrl = `${baseUrl.replace(/\/$/, '')}${pathForUrl}`;
        logger.info('[WebInstall App] Using LOCAL storage URL', { path: resource.path, downloadUrl });
    } else {
        const result = await convertGCloudUrlToSignedDownloadUrl(resource.path, 3600, filename);
        if (!result) {
            throw new Error('Failed to generate download URL for resource');
        }
        downloadUrl = result.downloadUrl;
        downloadAuth = result.downloadAuth;
    }

    logger.info(`[WebInstall App] Generated download URL`, {
        resourceId,
        resourceName: resource.name,
        packageName: params.packageName,
        packageSize: resource.size,
        downloadUrl,
        hasHmacAuth: !!downloadAuth
    });

    return executeDeviceAction(
        'Install App',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        {
            action: 'install_app',
            packageName: params.packageName,
            resourceId: params.resourceId,
            downloadUrl,
            packageSize: resource.size,
            ...(downloadAuth && { downloadAuth })
        }
    );
}

/**
 * Handle file pull action (from device to server)
 */
export interface PullFileParams extends DeviceActionParams {
    sourcePath: string;
    destinationPath: string;
}

export async function handlePullFile(
    params: PullFileParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    if (!params.sourcePath || !params.destinationPath) {
        throw new Error('sourcePath and destinationPath are required');
    }

    const { deviceId, sourcePath } = params;
    
    // Extract filename from sourcePath
    const fileName = sourcePath ? sourcePath.split('/').pop() || 'file' : 'file';
    
    // Generate file path in GCloud: devices/{deviceId}/pull-files/{timestamp}/{fileName}
    const timestamp = Date.now();
    const objectPath = `devices/${deviceId}/pull-files/${timestamp}/${fileName}`;
    
    const storageConfig = getStorageConfig();
    if (storageConfig.mode === 'R2' && !storageConfig.r2Bucket) {
        throw new Error('R2 bucket not configured (CLOUDFLARE_R2_BUCKET_NAME)');
    }
    
    logger.info(`[WebPull File] Generating presigned upload URL`, {
        mode: storageConfig.mode,
        bucket: storageConfig.mode === 'R2' ? storageConfig.r2Bucket : 'local',
        objectPath
    });
    
    const presignedUrlResult = await generatePresignedUrl(
        objectPath,
        'application/octet-stream',
        3600
    );
    
    logger.info(`[WebPull File] Upload URL generated successfully`, {
        objectPath: presignedUrlResult.objectPath,
        bucket: presignedUrlResult.bucket
    });

    return executeDeviceAction(
        'Pull File',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        {
            action: 'pull_file',
            sourcePath: params.sourcePath,
            destinationPath: params.destinationPath,
            uploadUrl: presignedUrlResult.url,
            objectPath: presignedUrlResult.objectPath,
            bucket: presignedUrlResult.bucket
        }
    );
}

/**
 * Handle file push action (from server to device)
 */
export interface PushFileParams extends DeviceActionParams {
    sourcePath: string;
    destinationPath: string;
    resourceId: string;
}

export async function handlePushFile(
    params: PushFileParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    if (!params.sourcePath || !params.destinationPath || !params.resourceId) {
        throw new Error('sourcePath, destinationPath, and resourceId are required');
    }

    const { prisma } = args;
    const { resourceId } = params;

    // Fetch resource from database
    const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: {
            id: true,
            name: true,
            path: true,
            size: true,
            type: true
        }
    });

    if (!resource) {
        throw new Error('Resource not found');
    }

    if (!resource.path) {
        throw new Error('Resource has no file path');
    }

    // Generate signed download URL for the file
    const result = await convertGCloudUrlToSignedDownloadUrl(resource.path, 3600, resource.name);
    
    if (!result) {
        logger.error('[WebPush File] Failed to generate download URL', {
            resourceId,
            resourceName: resource.name,
            resourcePath: resource.path,
            reason: 'convertGCloudUrlToSignedDownloadUrl returned null'
        });
        throw new Error(`Unable to generate download URL for file "${resource.name}". The file may not be properly uploaded to cloud storage.`);
    }

    logger.info(`[WebPush File] Generated signed download URL`, {
        resourceId,
        resourceName: resource.name,
        resourceSize: resource.size,
        signedDownloadUrl: result.downloadUrl
    });

    return executeDeviceAction(
        'Push File',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        {
            action: 'push_file',
            sourcePath: result.downloadUrl,
            destinationPath: params.destinationPath,
            resourceId: params.resourceId,
            fileName: resource.name,
            ...(result.downloadAuth && { downloadAuth: result.downloadAuth })
        }
    );
}

/**
 * Handle get logs action
 */
export interface GetLogsParams extends DeviceActionParams {
    format?: 'zip' | 'text';
}

export async function handleGetLogs(
    params: GetLogsParams,
    args: RpcHandlerArgs
): Promise<RpcResponse<DeviceActionResult>> {
    const { deviceId } = params;
    const format = params.format || 'zip';
    
    const timestamp = Date.now();
    const fileName = `device_logs_${timestamp}.${format === 'zip' ? 'zip' : 'txt'}`;
    const objectPath = `devices/${deviceId}/logs/${timestamp}/${fileName}`;
    
    const storageConfig = getStorageConfig();
    if (storageConfig.mode === 'R2' && !storageConfig.r2Bucket) {
        throw new Error('R2 bucket not configured (CLOUDFLARE_R2_BUCKET_NAME)');
    }
    
    logger.info(`[WebGet Logs] Generating presigned upload URL for get_logs`, {
        mode: storageConfig.mode,
        bucket: storageConfig.mode === 'R2' ? storageConfig.r2Bucket : 'local',
        objectPath,
        format
    });
    
    const presignedUrlResult = await generatePresignedUrl(
        objectPath,
        format === 'zip' ? 'application/zip' : 'text/plain',
        3600
    );
    
    logger.info(`[WebGet Logs] Upload URL generated successfully`, {
        objectPath: presignedUrlResult.objectPath,
        bucket: presignedUrlResult.bucket,
        mode: storageConfig.mode
    });
    
    return executeDeviceAction(
        'Get Logs',
        DeviceNotificationType.ActionRequest,
        params,
        args,
        {
            action: 'get_logs',
            format: format,
            uploadUrl: presignedUrlResult.url,
            objectPath: presignedUrlResult.objectPath,
            bucket: presignedUrlResult.bucket
        }
    );
}

