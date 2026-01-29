import type { PrismaClient, DeviceActionLog } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { getMqttTransport } from '../core/transport';
import { SequenceGenerator } from '../../sync/sequenceGenerator';
import { BatchedBroadcaster } from './BatchedBroadcaster';
import { RateLimiter } from './RateLimiter';
import { CircuitBreakerFactory } from '../../utils/CircuitBreaker';
import { metrics } from '../../observability/metrics';
import { MessageOptimizer } from './MessageOptimizer';
import { ActiveDeviceTracker } from '../../sync/ActiveDeviceTracker';

/**
 * Broadcasts complete database records via MQTT for enterprise action log sync.
 * Ensures UI always displays exactly what's saved in the database.
 */
export interface ActionLogEvent {
  type: 'created' | 'updated' | 'deleted';
  logId: string;
  deviceId: string;
  sequenceNumber: number;
  dbRecord: DeviceActionLog & {
    user?: { name: string | null } | null;
    device?: { id: string; name: string | null } | null;
  };
  timestamp: string;
}

export class ActionLogEventBroadcaster {
  /**
   * Broadcast action log event to all subscribers
   */
  static async broadcastActionLogEvent(
    prisma: PrismaClient,
    log: DeviceActionLog,
    eventType: 'created' | 'updated'
  ): Promise<void> {
    try {
      let sequenceNumber = log.sequenceNumber;
      
      if (!sequenceNumber) {
        try {
          sequenceNumber = await SequenceGenerator.getNextSequence(prisma, log.deviceId);
          
          await prisma.deviceActionLog.update({
            where: { id: log.id },
            data: { sequenceNumber }
          });
          
          logger.debug('[ActionLogEventBroadcaster] Assigned sequence number', {
            logId: log.id,
            deviceId: log.deviceId,
            sequenceNumber
          });
        } catch (updateError: any) {
          if (updateError?.code === 'P2002' && updateError?.meta?.target?.includes('sequenceNumber')) {
            logger.debug('[ActionLogEventBroadcaster] Sequence number conflict, fetching from DB', {
              logId: log.id,
              deviceId: log.deviceId
            });
            
            const updatedLog = await prisma.deviceActionLog.findUnique({
              where: { id: log.id },
              select: { sequenceNumber: true }
            });
            
            if (updatedLog?.sequenceNumber) {
              sequenceNumber = updatedLog.sequenceNumber;
            } else {
              logger.warn('[ActionLogEventBroadcaster] Sequence number not found after conflict, retrying', {
                logId: log.id
              });
              sequenceNumber = await SequenceGenerator.getNextSequence(prisma, log.deviceId);
            }
          } else {
            // SequenceGenerator failed (e.g. DB/transaction) — use fallback so broadcast can proceed
            logger.warn('[ActionLogEventBroadcaster] Using fallback sequence after error', {
              logId: log.id,
              deviceId: log.deviceId,
              error: updateError instanceof Error ? updateError.message : String(updateError)
            });
            sequenceNumber = 0;
          }
        }
      }

      const dbRecord = await prisma.deviceActionLog.findUnique({
        where: { id: log.id },
        include: {
          user: { select: { name: true } },
          device: { select: { id: true, name: true } }
        }
      });

      if (!dbRecord) {
        logger.error('[ActionLogEventBroadcaster] Failed to fetch DB record', {
          logId: log.id
        });
        return;
      }

      const transformedRecord: any = {
        id: dbRecord.id,
        deviceId: dbRecord.deviceId,
        actionType: dbRecord.actionType,
        status: dbRecord.status,
        progress: dbRecord.progress,
        initiatedAt: dbRecord.initiatedAt.toISOString(),
        completedAt: dbRecord.completedAt?.toISOString() || null,
        durationMs: dbRecord.durationMs,
        message: dbRecord.message,
        user: dbRecord.user ? { name: dbRecord.user.name } : null,
        sequenceNumber: dbRecord.sequenceNumber ?? sequenceNumber
      };

      const event: ActionLogEvent = {
        type: eventType,
        logId: log.id,
        deviceId: log.deviceId,
        sequenceNumber,
        dbRecord: transformedRecord,
        timestamp: new Date().toISOString()
      };

      const timer = metrics.broadcastLatency.startTimer({ eventType });
      try {
        await this.publishEvent(prisma, log.deviceId, event);
        timer();
        
        metrics.actionLogsCreated.inc({ 
          actionType: log.actionType, 
          status: log.status 
        });

        logger.info('[ActionLogEventBroadcaster] Broadcasted action log event', {
          logId: log.id,
          deviceId: log.deviceId,
          sequenceNumber,
          eventType,
          actionType: log.actionType,
          status: log.status
        });
      } catch (error) {
        timer();
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      logger.error('[ActionLogEventBroadcaster] Failed to broadcast event', {
        logId: log.id,
        deviceId: log.deviceId,
        eventType,
        error: errorMessage,
        stack: errorStack
      });
    }
  }

  /**
   * Publish event to MQTT topics
   */
  private static async publishEvent(
    prisma: PrismaClient,
    deviceId: string,
    event: ActionLogEvent
  ): Promise<void> {
    const mqttCircuitBreaker = CircuitBreakerFactory.createMQTTCircuitBreaker(async () => {
      const transport = getMqttTransport();
      return transport;
    });

    let transport;
    try {
      transport = await mqttCircuitBreaker.execute();
    } catch (error) {
      logger.error('[ActionLogEventBroadcaster] MQTT transport not available', {
        deviceId,
        logId: event.logId,
        error: error instanceof Error ? error.message : String(error),
        circuitState: mqttCircuitBreaker.getState()
      });
      throw error;
    }

    const eventPayload = JSON.stringify(event);

    try {
      const deviceTopic = `device/${deviceId}/action-logs/${event.logId}`;
      const publishCircuitBreaker = CircuitBreakerFactory.createMQTTCircuitBreaker(async () => {
        try {
          await transport.publish(deviceTopic, eventPayload, {
            qos: 2,
            retain: false
          });
          metrics.mqttMessagesPublished.inc({ topic: 'device/action-logs', qos: '2' });
        } catch (qosError) {
          logger.warn('[ActionLogEventBroadcaster] QoS 2 not supported, falling back to QoS 1', {
            deviceId,
            error: qosError instanceof Error ? qosError.message : String(qosError)
          });
          await transport.publish(deviceTopic, eventPayload, {
            qos: 1,
            retain: false
          });
          metrics.mqttMessagesPublished.inc({ topic: 'device/action-logs', qos: '1' });
        }
      });

      await publishCircuitBreaker.execute();

      const usersToNotify = await this.getUsersToNotify(prisma, deviceId);
      const batchedBroadcaster = BatchedBroadcaster.getInstance();
      const rateLimiter = RateLimiter.getInstance();
      
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { accountId: true }
      });

      if (!device?.accountId) {
        logger.warn('[ActionLogEventBroadcaster] Device has no accountId, skipping user notifications', {
          deviceId
        });
        return;
      }

      const activeUsers = ActiveDeviceTracker.getActiveUsers(deviceId);
      
      let usersToBroadcast = activeUsers;
      
      if (activeUsers.length === 0) {
        if (ActiveDeviceTracker.hasRecentlyActiveUsers(deviceId)) {
          logger.debug('[ActionLogEventBroadcaster] No active users but recently active, using fallback', {
            deviceId,
            logId: event.logId
          });
          usersToBroadcast = usersToNotify;
        } else {
          logger.debug('[ActionLogEventBroadcaster] No active users for device, using fallback to all authorized users', {
            deviceId,
            logId: event.logId,
            fallbackUserCount: usersToNotify.length
          });
          usersToBroadcast = usersToNotify;
        }
      }

      logger.debug('[ActionLogEventBroadcaster] Broadcasting to users', {
        deviceId,
        activeUserCount: activeUsers.length,
        broadcastUserCount: usersToBroadcast.length,
        totalUserCount: usersToNotify.length
      });

      for (const userId of usersToBroadcast) {
        if (!usersToNotify.includes(userId)) {
          continue;
        }

        try {
          const allowed = await rateLimiter.checkLimit(deviceId, userId);
          if (!allowed) {
            metrics.rateLimitHits.inc({ limitType: 'user' });
            logger.warn('[ActionLogEventBroadcaster] Rate limit exceeded', {
              userId,
              deviceId
            });
            continue;
          }

          const mqttUsername = `user:${userId}:${device.accountId}`;
          await batchedBroadcaster.addToBatch(userId, mqttUsername, event);

          metrics.mqttMessagesPublished.inc({ topic: 'user/notifications', qos: '1' });
        } catch (err) {
          metrics.mqttPublishFailures.inc({ 
            topic: 'user/notifications', 
            errorType: err instanceof Error ? err.constructor.name : 'Unknown'
          });
          
          logger.error('[ActionLogEventBroadcaster] Failed to add event to batch', {
            userId,
            deviceId,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    } catch (error) {
      logger.error('[ActionLogEventBroadcaster] Failed to publish event', {
        deviceId,
        logId: event.logId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get list of user IDs to notify for a device
   */
  private static async getUsersToNotify(
    prisma: PrismaClient,
    deviceId: string
  ): Promise<string[]> {
    const usersToNotify: string[] = [];

    try {
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { createdBy: true, accountId: true }
      });

      if (!device) {
        logger.warn('[ActionLogEventBroadcaster] Device not found', { deviceId });
        return usersToNotify;
      }

      if (device.createdBy) {
        usersToNotify.push(device.createdBy);
      }

      if (device.accountId) {
        const accountMembers = await prisma.accountMembership.findMany({
          where: { 
            accountId: device.accountId
          },
          select: { userId: true }
        });

        for (const member of accountMembers) {
          if (!usersToNotify.includes(member.userId)) {
            usersToNotify.push(member.userId);
          }
        }
      }

      return usersToNotify;
    } catch (error) {
      logger.error('[ActionLogEventBroadcaster] Failed to get users to notify', {
        deviceId,
        error: error instanceof Error ? error.message : String(error)
      });
      return usersToNotify;
    }
  }
}
