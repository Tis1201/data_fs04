import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { ActionLogger } from '$lib/server/action-logger';

export const POST: RequestHandler = restrictDevice(
  async ({ request, locals, userInfo }) => {
    try {
      const data = await request.json();
      const { deviceId, status, message, timestamp } = data.payload || {};

      if (!deviceId) {
        return json({ error: 'Missing deviceId' }, { status: 400 });
      }

      // Log the reboot status update
      logger.info(`[RebootStatus] Device ${deviceId}: ${status} - ${message}`);

      // Update action log in database if logId is provided
      const logId = data.logId;
      if (logId) {
        try {
          const actionStatus = status === 'acknowledged' ? 'success' : status === 'completed' ? 'success' : 'in_progress';
          await ActionLogger.updateProgress({
            logId,
            status: actionStatus,
            message: message || `Reboot ${status}`,
            metadata: {
              deviceStatus: status,
              timestamp: timestamp || new Date().toISOString()
            }
          });
          logger.info(`[RebootStatus] Updated action log ${logId} with status: ${actionStatus}`);
        } catch (error) {
          logger.error(`[RebootStatus] Error updating action log ${logId}:`, error as Record<string, any>);
        }
      }

      // Publish the reboot status update to the UI
      const messageObj = MessageFactory.createSystemMessage(
        'device:rebootStatus',
        `subscription:device:${deviceId}`,
        {
          deviceId,
          status,
          message,
          logId,
          timestamp: timestamp || new Date().toISOString()
        },
        SystemUser
      );

      await publisher.publish(messageObj);

      return json({ success: true });
    } catch (error) {
      logger.error('Error handling reboot status update:', error as Record<string, any>);
      return json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
