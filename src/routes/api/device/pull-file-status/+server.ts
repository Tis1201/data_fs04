import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { ActionLogger } from '$lib/server/action-logger';

type DevicePullFileStatus = 'downloading' | 'transferring' | 'success' | 'failed';

export const POST: RequestHandler = restrictDevice(
  async ({ request, locals, userInfo }) => {
    try {
      const body = await request.json();
      const {
        deviceId,
        status,
        progress,
        message,
        fileResourceId,
        error,
        requestId,
        logId
      } = body as {
        deviceId: string;
        status: DevicePullFileStatus;
        progress?: number;
        message?: string;
        fileResourceId?: string;
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
              actionType: 'pull_file',
              completedAt: null
            },
            orderBy: { initiatedAt: 'desc' }
          });

          if (existingOpen) {
            effectiveLogId = existingOpen.id;
          } else {
            const created = await ActionLogger.createInitiated({
              deviceId,
              actionType: 'pull_file',
              initiatedBy: userInfo.id,
              metadata: fileResourceId ? { file: { resourceId: fileResourceId } } : undefined,
              initialMessage: message ?? 'Device reported file pull'
            });
            effectiveLogId = created.id;
            await ActionLogger.markInProgress(effectiveLogId as string, 'Device started file pull');
          }
        } catch (e) {
          logger.warn(`[PullFileStatusAPI] Failed to resolve/create action log: ${String(e)}`);
        }
      }

      // Broadcast status update to subscribers (admin UI) via device subscription
      const routing = MessageFactory.createSystemMessage(
        'device:pullFileStatus',
        `subscription:device:${deviceId}`,
        {
          action: 'pullFileStatus',
          deviceId,
          status,
          progress,
          message,
          fileResourceId,
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
          'device:pullFileStatus',
          `user:${userInfo.id}`,
          {
            action: 'pullFileStatus',
            deviceId,
            status,
            progress,
            message,
            fileResourceId,
            error,
            logId: effectiveLogId,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(userRouting);
      } catch (e) {
        logger.warn(`[PullFileStatusAPI] Failed to publish to user channel: ${String(e)}`);
      }

      // Update action log if provided/created
      try {
        if (effectiveLogId) {
          if (status === 'success') {
            await ActionLogger.finalize(effectiveLogId, 'success', message ?? 'File pull completed', undefined, 100);
          } else if (status === 'failed') {
            await ActionLogger.finalize(effectiveLogId, 'failed', message ?? 'File pull failed', error);
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
        logger.warn(`[PullFileStatusAPI] Failed to update action log: ${String(e)}`);
      }

      return json({ success: true, logId: effectiveLogId });
    } catch (err) {
      logger.error(`[PullFileStatusAPI] Error: ${String(err)}`);
      return json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }
);
