import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { ActionLogger } from '$lib/server/action-logger';

type DeviceInstallAppStatus = 'downloading' | 'installing' | 'verifying' | 'success' | 'failed';

export const POST: RequestHandler = restrictDevice(
  async ({ request, locals, userInfo }) => {
    try {
      const body = await request.json();
      const {
        deviceId,
        status,
        progress,
        message,
        appResourceId,
        error,
        requestId,
        logId
      } = body as {
        deviceId: string;
        status: DeviceInstallAppStatus;
        progress?: number;
        message?: string;
        appResourceId?: string;
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
              actionType: 'install_app',
              completedAt: null
            },
            orderBy: { initiatedAt: 'desc' }
          });

          if (existingOpen) {
            effectiveLogId = existingOpen.id;
          } else {
            const created = await ActionLogger.createInitiated({
              deviceId,
              actionType: 'install_app',
              initiatedBy: userInfo.id,
              metadata: appResourceId ? { app: { resourceId: appResourceId } } : undefined,
              initialMessage: message ?? 'Device reported app installation'
            });
            effectiveLogId = created.id;
            await ActionLogger.markInProgress(effectiveLogId as string, 'Device started app installation');
          }
        } catch (e) {
          logger.warn(`[InstallAppStatusAPI] Failed to resolve/create action log: ${String(e)}`);
        }
      }

      // Broadcast status update to subscribers (admin UI) via device subscription
      const routing = MessageFactory.createSystemMessage(
        'device:installAppStatus',
        `subscription:device:${deviceId}`,
        {
          action: 'installAppStatus',
          deviceId,
          status,
          progress,
          message,
          appResourceId,
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
          'device:installAppStatus',
          `user:${userInfo.id}`,
          {
            action: 'installAppStatus',
            deviceId,
            status,
            progress,
            message,
            appResourceId,
            error,
            logId: effectiveLogId,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(userRouting);
      } catch (e) {
        logger.warn(`[InstallAppStatusAPI] Failed to publish to user channel: ${String(e)}`);
      }

      // Update action log if provided/created
      let durationMs: number | null = null;
      try {
        if (effectiveLogId) {
          if (status === 'success') {
            const updated = await ActionLogger.finalize(effectiveLogId, 'success', message ?? 'App installation completed', undefined, 100);
            durationMs = updated.durationMs;
          } else if (status === 'failed') {
            const updated = await ActionLogger.finalize(effectiveLogId, 'failed', message ?? 'App installation failed', error);
            durationMs = updated.durationMs;
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
        logger.warn(`[InstallAppStatusAPI] Failed to update action log: ${String(e)}`);
      }

      // Publish final status update with duration if completed
      if (durationMs !== null && effectiveLogId) {
        try {
          const statusRouting = MessageFactory.createSystemMessage(
            'device:statusUpdate',
            `subscription:device:${deviceId}`,
            {
              action: 'installApp',
              deviceId,
              status,
              message,
              logId: effectiveLogId,
              durationMs,
              progress: status === 'success' ? 100 : progress,
              timestamp: new Date().toISOString()
            },
            SystemUser,
            { echoToSender: false }
          );
          await publisher.publish(statusRouting);
        } catch (e) {
          logger.warn(`[InstallAppStatusAPI] Failed to publish final status update: ${String(e)}`);
        }
      }

      return json({ success: true, logId: effectiveLogId });
    } catch (err) {
      logger.error(`[InstallAppStatusAPI] Error: ${String(err)}`);
      return json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }
);
