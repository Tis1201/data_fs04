import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { SystemUser } from '../../interfaces/message';
import { generatePresignedUrl, getStorageConfig } from '$lib/server/storage';
import path from 'path';

/**
 * Handles file push operations
 * Creates action log and sends device:actionRequest to device
 */
export async function handlePushFile(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, sourcePath, targetPath, resourceId } = payload as any;

  logger.info('[FileOperationHandler] Handling push_file request', {
    deviceId,
    sourcePath,
    targetPath,
    resourceId,
    requestId: (message as any)?.requestId
  });

  try {
    // Extract user ID from message context
    const userId = (message as any)?.userInfo?.id || (message as any)?.userInfo?.userId;
    if (!userId) {
      throw new Error('User ID not found in message context');
    }

    // Create action log
    const actionLog = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'push_file',
      initiatedBy: userId,
      requestId: (message as any)?.requestId,
      connectionId: (message as any)?.connectionId,
      protocol: (message as any)?.protocol,
      initialMessage: `Pushing file: ${sourcePath}`
    });

    // Send device:actionRequest to device via SSE
    const deviceMessage = MessageFactory.createSystemMessage(
      'device:actionRequest',
      `subscription:device:${deviceId}`,
      {
        action: 'pushFile',
        deviceId,
        logId: actionLog.id,
        requestId: (message as any)?.requestId,
        sourcePath,
        destinationPath: targetPath || sourcePath,
        resourceId
      },
      SystemUser,
      { echoToSender: false }
    );

    await publisher.publish(deviceMessage);

    logger.info('[FileOperationHandler] PushFile action initiated', {
      deviceId,
      logId: actionLog.id,
      sourcePath
    });

  } catch (error) {
    logger.error('[FileOperationHandler] Error handling push_file', { error, message });
    throw error;
  }
}

/**
 * Handles file pull operations
 * Creates action log, generates upload signed URL, and sends device:actionRequest to device
 */
export async function handlePullFile(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, sourcePath, targetPath, resourceId } = payload as any;

  logger.info('[FileOperationHandler] Handling pull_file request', {
    deviceId,
    sourcePath,
    targetPath,
    resourceId,
    requestId: (message as any)?.requestId
  });

  try {
    // Extract user ID from message context
    const userId = (message as any)?.userInfo?.id || (message as any)?.userInfo?.userId;
    if (!userId) {
      throw new Error('User ID not found in message context');
    }

    // Extract filename only (normalize Windows backslashes so path.basename works on Linux server)
    const sourcePathNorm = (sourcePath ?? '').replace(/^"|"$/g, '').trim().replace(/\\/g, '/');
    const fileName = sourcePathNorm ? path.basename(sourcePathNorm) || 'file' : (resourceId ? `${resourceId}` : 'file');

    // Generate file path in GCloud: devices/{deviceId}/pull-files/{timestamp}/{fileName} (filename only, like get_logs)
    const timestamp = Date.now();
    const objectPath = `devices/${deviceId}/pull-files/${timestamp}/${fileName}`;

    // Get storage config
    const storageConfig = getStorageConfig();
    if (storageConfig.mode === 'R2' && !storageConfig.r2Bucket) {
      throw new Error('R2 bucket not configured (CLOUDFLARE_R2_BUCKET_NAME)');
    }

    // Generate presigned upload URL
    logger.info('[FileOperationHandler] Generating presigned upload URL', {
      bucket: storageConfig.mode === 'R2' ? storageConfig.r2Bucket : 'local',
      objectPath
    });

    const presignedUrlResult = await generatePresignedUrl(
      objectPath,
      'application/octet-stream',
      3600 // 1 hour expiration
    );

    // Create action log with metadata including objectPath
    const actionLog = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'pull_file',
      initiatedBy: userId,
      requestId: (message as any)?.requestId,
      connectionId: (message as any)?.connectionId,
      protocol: (message as any)?.protocol,
      initialMessage: `Preparing file upload...`,
      metadata: {
        sourcePath,
        objectPath,
        bucket: presignedUrlResult.bucket,
        fileName,
        uploadUrl: presignedUrlResult.url,
        expires: presignedUrlResult.expires
      }
    });

    // Send device:actionRequest to device via SSE with upload URL included
    const deviceMessage = MessageFactory.createSystemMessage(
      'device:actionRequest',
      `subscription:device:${deviceId}`,
      {
        action: 'pullFile',
        deviceId,
        logId: actionLog.id,
        requestId: (message as any)?.requestId,
        sourcePath,
        destinationPath: targetPath || sourcePath,
        resourceId,
        // NEW FIELDS for signed URL upload
        uploadUrl: presignedUrlResult.url,
        objectPath: presignedUrlResult.objectPath,
        bucket: presignedUrlResult.bucket,
        expires: presignedUrlResult.expires,
        contentType: presignedUrlResult.contentType
      },
      SystemUser,
      { echoToSender: false }
    );

    await publisher.publish(deviceMessage);

    logger.info('[FileOperationHandler] PullFile action initiated with upload URL', {
      deviceId,
      logId: actionLog.id,
      sourcePath,
      objectPath
    });

  } catch (error) {
    logger.error('[FileOperationHandler] Error handling pull_file', { error, message });
    throw error;
  }
}

/**
 * Handles app installation operations
 * Creates action log and sends device:actionRequest to device
 */
export async function handleInstallApp(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, appName, appPath, resourceId } = payload as any;

  logger.info('[FileOperationHandler] Handling install_app request', {
    deviceId,
    appName,
    appPath,
    resourceId,
    requestId: (message as any)?.requestId
  });

  try {
    // Extract user ID from message context
    const userId = (message as any)?.userInfo?.id || (message as any)?.userInfo?.userId;
    if (!userId) {
      throw new Error('User ID not found in message context');
    }

    // Create action log
    const actionLog = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'install_app',
      initiatedBy: userId,
      requestId: (message as any)?.requestId,
      connectionId: (message as any)?.connectionId,
      protocol: (message as any)?.protocol,
      initialMessage: `Installing app: ${appName}`
    });

    // Send device:actionRequest to device via SSE
    const deviceMessage = MessageFactory.createSystemMessage(
      'device:actionRequest',
      `subscription:device:${deviceId}`,
      {
        action: 'installApp',
        deviceId,
        logId: actionLog.id,
        requestId: (message as any)?.requestId,
        packageName: appName,
        appPath,
        resourceId
      },
      SystemUser,
      { echoToSender: false }
    );

    await publisher.publish(deviceMessage);

    logger.info('[FileOperationHandler] InstallApp action initiated', {
      deviceId,
      logId: actionLog.id,
      appName
    });

  } catch (error) {
    logger.error('[FileOperationHandler] Error handling install_app', { error, message });
    throw error;
  }
}

/**
 * Handles firmware update operations
 * Creates action log and sends device:actionRequest to device
 */
export async function handleUpdateFirmware(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, firmwarePath, version, resourceId } = payload as any;

  logger.info('[FileOperationHandler] Handling updateFirmware request', {
    deviceId,
    firmwarePath,
    version,
    resourceId,
    requestId: (message as any)?.requestId
  });

  try {
    // Extract user ID from message context
    const userId = (message as any)?.userInfo?.id || (message as any)?.userInfo?.userId;
    if (!userId) {
      throw new Error('User ID not found in message context');
    }

    // Create action log
    const actionLog = await ActionLogger.createInitiated({
      deviceId,
      actionType: 'firmware_update',
      initiatedBy: userId,
      requestId: (message as any)?.requestId,
      connectionId: (message as any)?.connectionId,
      protocol: (message as any)?.protocol,
      initialMessage: `Updating firmware: ${version || 'latest'}`
    });

    // Send device:actionRequest to device via SSE
    const deviceMessage = MessageFactory.createSystemMessage(
      'device:actionRequest',
      `subscription:device:${deviceId}`,
      {
        action: 'updateFirmware',
        deviceId,
        logId: actionLog.id,
        requestId: (message as any)?.requestId,
        firmwarePath,
        firmwareVersion: version,
        resourceId
      },
      SystemUser,
      { echoToSender: false }
    );

    await publisher.publish(deviceMessage);

    logger.info('[FileOperationHandler] UpdateFirmware action initiated', {
      deviceId,
      logId: actionLog.id,
      version
    });

  } catch (error) {
    logger.error('[FileOperationHandler] Error handling updateFirmware', { error, message });
    throw error;
  }
}
