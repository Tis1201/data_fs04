import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';

export const POST: RequestHandler = restrictDevice(
  async ({ request, locals, userInfo }) => {
    try {
      const body = await request.json();
      const {
        deviceId,
        fileData,
        fileName,
        fileSize,
        logId
      } = body as {
        deviceId: string;
        fileData: string;
        fileName: string;
        fileSize: number;
        logId?: string;
      };

      if (!deviceId || !fileData || !fileName) {
        return json({ success: false, error: 'deviceId, fileData, and fileName are required' }, { status: 400 });
      }

      logger.info(`[PushFileDataAPI] Received file data from device ${deviceId}: ${fileName} (${fileSize} bytes)`);

      // Broadcast file data to subscribers (admin UI) via device subscription
      const routing = MessageFactory.createSystemMessage(
        'device:pushFileData',
        `subscription:device:${deviceId}`,
        {
          action: 'pushFileData',
          deviceId,
          fileData,
          fileName,
          fileSize,
          logId,
          timestamp: new Date().toISOString()
        },
        SystemUser,
        { echoToSender: false }
      );

      await publisher.publish(routing);

      // Also broadcast to all connections of the device owner (current user)
      try {
        const userRouting = MessageFactory.createSystemMessage(
          'device:pushFileData',
          `user:${userInfo.id}`,
          {
            action: 'pushFileData',
            deviceId,
            fileData,
            fileName,
            fileSize,
            logId,
            timestamp: new Date().toISOString()
          },
          SystemUser,
          { echoToSender: false }
        );
        await publisher.publish(userRouting);
      } catch (e) {
        logger.warn(`[PushFileDataAPI] Failed to publish to user channel: ${String(e)}`);
      }

      return json({ success: true });
    } catch (err) {
      logger.error(`[PushFileDataAPI] Error: ${String(err)}`);
      return json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  }
);
