// src/routes/api/device/pushpin/listen/+server.ts
import type { RequestHandler } from './$types';
import { auth_device } from '$lib/server/device/deviceAuth';
import { PushpinConnection } from '$lib/server/messaging/connections/pushpin_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { getPresenceManager, getMessageRelay } from '$lib/server/pushpin/middleware';
import { getRedisService } from '$lib/server/services/redisService';
import { MessageRelay } from '$lib/server/pushpin/messageRelay';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ locals, request }) => {
  try {
    const { device, userInfo } = await auth_device(locals, request);
    const channel = `device:${device.id}`;

    // Best-effort side effects (never fail the stream)
    try { await DeviceStatusManager.setDeviceOnline(device.id, locals, device.id); }
    catch (e) {
      logger.warn('[Pushpin] setDeviceOnline failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    let messageRelay = getMessageRelay();
    if (!messageRelay) {
      try {
        const redisService = getRedisService(locals);
        if (redisService) {
          messageRelay = new MessageRelay(redisService);
          logger.warn('[Pushpin] Created fallback MessageRelay');
        } else {
          logger.warn('[Pushpin] Redis service missing; relay disabled');
        }
      } catch (e) {
        logger.warn('[Pushpin] Relay init failed', {
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }

    const publishFn = messageRelay
      ? async (ch: string, msg: unknown) => {
          try { await messageRelay!.publishToChannel(ch, msg); }
          catch (e) {
            logger.warn('publishToChannel failed', {
              error: e instanceof Error ? e.message : String(e)
            });
          }
        }
      : async () => {};

    try {
      const connection = new PushpinConnection(
        { id: device.id, userInfo, nodeId: 'device-pushpin-listen', protocol: 'pushpin', deviceId: device.id, connectedAt: Date.now() },
        publishFn
      );
      ConnectionManager.registerConnection(connection);
    } catch (e) {
      logger.warn('[Pushpin] Connection registration failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    try {
      await subscriptionRegistry.addSubscription(
        `subscription:device:${device.id}`,
        `subscriber:connection:${device.id}`
      );
    } catch (e) {
      logger.warn('[Pushpin] Subscription setup failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    try {
      const initialMessage = { type: 'connected', deviceId: device.id, message: 'Device connected successfully' };
      if (messageRelay) await messageRelay.publishToDevice(device.id, initialMessage);

      const connectionMessage = MessageFactory.createSystemMessage(
        'device:connection',
        `subscription:device:${device.id}`,
        { deviceId: device.id, connected: true, connectedAt: new Date().toISOString(), protocol: 'pushpin' },
        userInfo,
        { echoToSender: false }
      );
      await publisher.publish(connectionMessage);
      logger.info(`[Pushpin] Connection event published successfully for device ${device.id}`);
    } catch (e) {
      logger.warn('[Pushpin] Initial publish failed', {
        error: e instanceof Error ? e.message : String(e)
      });
    }

    logger.info(`[Pushpin] Device ${device.id} connected via Pushpin channel: ${channel}`);

    // IMPORTANT: no newline characters in header values
    return new Response(null, {
      status: 200,
      headers: {
        'Grip-Hold': 'stream',
        'Grip-Channel': channel,
        'Grip-Timeout': '60', // OK to keep
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('Device Pushpin listen error', { error: msg });
    return new Response('Pushpin connection failed', { status: 500 });
  }
};
