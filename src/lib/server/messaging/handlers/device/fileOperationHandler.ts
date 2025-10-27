import type { InMessage } from '../../interfaces/message';
import { MessageFactory } from '../../interfaces/message';
import { publisher } from '../../core/publisher';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { SystemUser } from '../../interfaces/message';

/**
 * Handles file push operations
 * Creates action log and sends device:actionRequest to device
 */
export async function handlePushFile(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, sourcePath, targetPath, resourceId } = payload as any;

  logger.info('[FileOperationHandler] Handling pushFile request', {
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
    logger.error('[FileOperationHandler] Error handling pushFile', { error, message });
    throw error;
  }
}

/**
 * Handles file pull operations
 * Creates action log and sends device:actionRequest to device
 */
export async function handlePullFile(message: InMessage): Promise<void> {
  const { payload } = message;
  const { deviceId, sourcePath, targetPath, resourceId } = payload as any;

  logger.info('[FileOperationHandler] Handling pullFile request', {
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
      actionType: 'pull_file',
      initiatedBy: userId,
      requestId: (message as any)?.requestId,
      connectionId: (message as any)?.connectionId,
      protocol: (message as any)?.protocol,
      initialMessage: `Pulling file: ${sourcePath}`
    });

    // Send device:actionRequest to device via SSE
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
        resourceId
      },
      SystemUser,
      { echoToSender: false }
    );

    await publisher.publish(deviceMessage);

    logger.info('[FileOperationHandler] PullFile action initiated', {
      deviceId,
      logId: actionLog.id,
      sourcePath
    });

  } catch (error) {
    logger.error('[FileOperationHandler] Error handling pullFile', { error, message });
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

  logger.info('[FileOperationHandler] Handling installApp request', {
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
      actionType: 'install',
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
    logger.error('[FileOperationHandler] Error handling installApp', { error, message });
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
