import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { ActionLogEventBroadcaster } from '../../mqtt/broadcasters/actionLogEventBroadcaster';

/**
 * Prisma hooks for automatically broadcasting action log changes via MQTT.
 * Ensures UI receives the latest database state in real-time.
 */
export function initializeActionLogHooks(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    const result = await next(params);

    if (params.model === 'DeviceActionLog') {
      if (params.action === 'create' || params.action === 'update') {
        setTimeout(async () => {
          try {
            const log = result as any;
            
            if (log && log.id) {
              await new Promise(resolve => setTimeout(resolve, 100));
              
              const completeLog = await prisma.deviceActionLog.findUnique({
                where: { id: log.id }
              });

              if (completeLog) {
                if (!completeLog.sequenceNumber && params.action === 'create') {
                  try {
                    const { SequenceGenerator } = await import('../../sync/sequenceGenerator');
                    const sequenceNumber = await SequenceGenerator.getNextSequence(prisma, completeLog.deviceId);
                    await prisma.deviceActionLog.update({
                      where: { id: completeLog.id },
                      data: { sequenceNumber }
                    });
                    logger.debug('[ActionLogHooks] Assigned sequence number', {
                      logId: completeLog.id,
                      deviceId: completeLog.deviceId,
                      sequenceNumber
                    });
                  } catch (seqError) {
                    logger.warn('[ActionLogHooks] Failed to assign sequence number', {
                      logId: completeLog.id,
                      error: seqError instanceof Error ? seqError.message : String(seqError)
                    });
                  }
                }
                
                const updatedLog = await prisma.deviceActionLog.findUnique({
                  where: { id: log.id }
                });
                
                if (updatedLog) {
                  await ActionLogEventBroadcaster.broadcastActionLogEvent(
                    prisma,
                    updatedLog,
                    params.action === 'create' ? 'created' : 'updated'
                  );
                } else {
                  logger.warn('[ActionLogHooks] Log not found after sequence assignment', {
                    logId: log.id,
                    action: params.action
                  });
                }
              } else {
                logger.warn('[ActionLogHooks] Log not found after creation/update', {
                  logId: log.id,
                  action: params.action
                });
              }
            }
          } catch (error) {
            logger.error('[ActionLogHooks] Failed to broadcast action log event', {
              model: params.model,
              action: params.action,
              logId: (result as any)?.id,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });
          }
        }, 50);
      }
    }

    return result;
  });

  logger.info('[ActionLogHooks] Initialized action log event broadcasting hooks');
}
