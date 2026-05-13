// Monitor Redis keyspace events for device presence TTL expirations
// When a presence key expires, publish offline event to subscribed admins

import type Redis from 'ioredis';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { publishDeviceStatusEvent } from './deviceEventPublisher';
import { getAdminPrisma } from '$lib/server/prisma';

export class DevicePresenceMonitor {
  private subscriber: Redis | null = null;
  private isRunning = false;

  constructor(private redis: Redis) {}

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[PresenceMonitor] Already running');
      return;
    }

    try {
      // Create a separate Redis connection for pub/sub with enableReadyCheck: false
      // Prevents ioredis from running INFO (which Redis rejects in subscriber mode)
      this.subscriber = this.redis.duplicate({ enableReadyCheck: false });

      // Suppress errors from ready check attempts in subscriber mode
      // This error is expected when a connection enters subscriber mode
      // ioredis runs INFO/ready checks which Redis rejects: "ERR Can't execute 'info': only (P|S)SUBSCRIBE..."
      this.subscriber.on('error', (err) => {
        const msg = String(err?.message ?? err ?? '').toLowerCase();
        // Redis rejects INFO/etc when connection is in subscriber mode - ioredis triggers this
        // Match: "ERR Can't execute 'info': only (P|S)SUBSCRIBE / ... RESET are allowed in this context"
        const isSubscriberModeError =
          msg.includes('subscriber mode') ||
          msg.includes('only subscriber commands') ||
          msg.includes('allowed in this context') ||
          msg.includes('reset are allowed') ||
          (msg.includes('subscribe') && msg.includes('allowed')) ||
          (msg.includes("can't execute") && msg.includes('info')) ||
          /only\s*\([p|s]*\)\s*subscribe/i.test(msg);
        if (isSubscriberModeError) {
          return; // Silently ignore - expected when connection is in subscriber mode
        }
        logger.error('[PresenceMonitor] Subscriber connection error', {
          error: err.message,
          stack: err.stack
        });
      });

      // Enable keyspace notifications for expired AND deleted events
      // E = Keyevent, x = expired events, K = Keyspace, g = generic commands (includes DEL)
      // This allows us to listen for when presence keys expire OR are deleted
      // IMPORTANT: Use the main redis connection, not the subscriber (subscriber can't run config)
      await this.redis.config('SET', 'notify-keyspace-events', 'ExKg');
      
      logger.info('[PresenceMonitor] Enabled Redis keyspace notifications for expirations and deletions');

      // Set up message handler BEFORE subscribing (to catch messages immediately)
      this.subscriber.on('pmessage', async (pattern, channel, key) => {
        // Only handle presence:device:* keys
        if (key.startsWith('presence:device:')) {
          const deviceId = key.replace('presence:device:', '');
          const eventType = channel.split(':').pop(); // 'expired' or 'del'
          logger.info(`[PresenceMonitor] Device went offline (${eventType}): ${deviceId}`);
          
          await this.handleDeviceOffline(deviceId);
        }
      });

      // Subscribe to both expiration and deletion events for presence:device:* keys
      // __keyevent@0__:expired - fires when key expires naturally (TTL reaches 0)
      // __keyevent@0__:del - fires when key is deleted via DEL command
      // After this, the subscriber connection will be in subscriber mode
      await this.subscriber.psubscribe('__keyevent@0__:expired', '__keyevent@0__:del');

      this.isRunning = true;
      logger.info('[PresenceMonitor] Started monitoring device presence');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[PresenceMonitor] Failed to start', {
        error: errorMessage,
        stack: errorStack,
        errorDetails: error instanceof Error ? {
          name: error.name,
          message: error.message,
          code: (error as any).code
        } : null
      });
      
      // Clean up subscriber if it was created
      if (this.subscriber) {
        try {
          await this.subscriber.quit();
        } catch (cleanupError) {
          logger.warn('[PresenceMonitor] Error cleaning up subscriber during failed start', cleanupError);
        }
        this.subscriber = null;
      }
      
      throw error;
    }
  }

  private async handleDeviceOffline(deviceId: string): Promise<void> {
    try {
      // Get device details from database to publish to account/admin channels
      const prisma = getAdminPrisma();
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          name: true,
          accountId: true,
          createdBy: true
        }
      });
      
      if (!device) {
        logger.warn(`[PresenceMonitor] Device ${deviceId} not found in database`);
        return;
      }
      
      // Use new centralized publisher that publishes to multiple channels:
      // 1. subscription:device:{deviceId} (backward compatibility)
      // 2. subscription:account:{accountId}:devices (for account members)
      // 3. subscription:admin:devices (for admin users)
      await publishDeviceStatusEvent(device, {
        deviceId: device.id,
        connected: false,
        timestamp: new Date().toISOString(),
        reason: 'presence_timeout'
      });
      
      logger.info(`[PresenceMonitor] Published offline event for device ${deviceId}`);
    } catch (error) {
      logger.error('[PresenceMonitor] Failed to publish offline event', {
        error: error instanceof Error ? error.message : String(error),
        deviceId
      });
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.subscriber) {
        await this.subscriber.punsubscribe('__keyevent@0__:expired', '__keyevent@0__:del');
        await this.subscriber.quit();
        this.subscriber = null;
      }
      
      this.isRunning = false;
      logger.info('[PresenceMonitor] Stopped monitoring device presence');
    } catch (error) {
      logger.error('[PresenceMonitor] Error stopping monitor', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Singleton instance
let presenceMonitor: DevicePresenceMonitor | null = null;

export function startDevicePresenceMonitor(redis: Redis): DevicePresenceMonitor {
  if (!presenceMonitor) {
    presenceMonitor = new DevicePresenceMonitor(redis);
    presenceMonitor.start().catch(err => {
      logger.error('[PresenceMonitor] Failed to start monitor', err);
    });
  }
  return presenceMonitor;
}

export function getDevicePresenceMonitor(): DevicePresenceMonitor | null {
  return presenceMonitor;
}

