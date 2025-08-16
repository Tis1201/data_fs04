import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { ActionLogger } from '$lib/server/action-logger';

type DeviceFirmwareStatus = 'downloading' | 'installing' | 'success' | 'failed';

export const POST: RequestHandler = restrictDevice(
  async ({ request, locals, userInfo }) => {
    try {
      const body = await request.json();
      const {
        deviceId,
        status,
        progress,
        message,
        firmwareResourceId,
        error,
        requestId,
        logId
      } = body as {
        deviceId: string;
        status: DeviceFirmwareStatus;
        progress?: number;
        message?: string;
        firmwareResourceId?: string;
        error?: string;
        requestId?: string;
        logId?: string;
      };

      if (!deviceId || !status) {
        return json({ success: false, error: 'deviceId and status are required' }, { status: 400 });
      }

      if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
        return json({ success: false, error: 'progress must be 0..100' }, { status: 400 });
      }

      // If no logId was provided, find an existing open log for this device/action, else create one
      let effectiveLogId = logId;
      if (!effectiveLogId) {
        try {
          const existingOpen = await (locals.prisma as any).deviceActionLog.findFirst({
            where: {
              deviceId,
              actionType: 'firmware_update',
              completedAt: null
            },
            orderBy: { initiatedAt: 'desc' }
          });

          if (existingOpen) {
            effectiveLogId = existingOpen.id;
          } else {
            const created = await ActionLogger.createInitiated({
              deviceId,
              actionType: 'firmware_update',
              initiatedBy: userInfo.id,
              metadata: firmwareResourceId ? { firmware: { resourceId: firmwareResourceId } } : undefined,
              initialMessage: message ?? 'Device reported firmware update'
            });
            effectiveLogId = created.id;
            await ActionLogger.markInProgress(effectiveLogId as string, 'Device started firmware update');
          }
        } catch (e) {
          logger.warn(`[FirmwareStatusAPI] Failed to resolve/create action log: ${String(e)}`);
        }
      }

      // Broadcast status update to subscribers (admin UI) via device subscription
      const routing = MessageFactory.createSystemMessage(
        'device:firmwareStatus',
        `subscription:device:${deviceId}`,
        {
          action: 'firmwareStatus',
          deviceId,
          status,
          progress,
          message,
          firmwareResourceId,
          error,
          logId: effectiveLogId,
          timestamp: new Date().toISOString()
        },
        SystemUser,
        { echoToSender: false }
      );

      await publisher.publish(routing);

      // Also broadcast to all connections of the device owner (current user)
      try {
        const userRouting = MessageFactory.createSystemMessage(
          'device:firmwareStatus',
          `user:${userInfo.id}`,
          {
            action: 'firmwareStatus',
            deviceId,
            status,
            progress,
            message,
            firmwareResourceId,
            error,
            logId: effectiveLogId,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(userRouting);
      } catch (e) {
        logger.warn(`[FirmwareStatusAPI] Failed to publish to user channel: ${String(e)}`);
      }

      // Update action log if provided/created
      try {
        if (effectiveLogId) {
          if (status === 'success') {
            await ActionLogger.finalize(effectiveLogId, 'success', message ?? 'Firmware update completed', undefined, 100);
          } else if (status === 'failed') {
            await ActionLogger.finalize(effectiveLogId, 'failed', message ?? 'Firmware update failed', error);
          } else {
            await ActionLogger.updateProgress({
              logId: effectiveLogId,
              status: 'in_progress',
              progress,
              message
            });
          }
        }
      } catch (e) {
        logger.warn(`[FirmwareStatusAPI] Failed to update action log: ${String(e)}`);
      }

      // On success, optionally update device firmwareVersion
      if (status === 'success' && firmwareResourceId) {
        try {
          const resource = await locals.prisma.resource.findUnique({ where: { id: firmwareResourceId } });
          if (resource?.version) {
            await locals.prisma.device.update({
              where: { id: deviceId },
              data: { firmwareVersion: resource.version }
            });
          }
        } catch (e) {
          logger.warn(`[FirmwareStatusAPI] Failed to update device firmwareVersion: ${String(e)}`);
        }
      }

      return json({ success: true, logId: effectiveLogId });
    } catch (err) {
      logger.error(`[FirmwareStatusAPI] Error: ${String(err)}`);
      return json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }
);


