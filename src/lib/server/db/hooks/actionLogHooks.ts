import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { queueActionLogBroadcast } from '../../mqtt/core/queue';

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
            if (!log?.id) return;

            // Only queue; worker assigns sequence and broadcasts via MQTT (single flow, no duplicate hook from sequence update)
            await queueActionLogBroadcast(
              log.id,
              params.action === 'create' ? 'created' : 'updated'
            );
          } catch (error) {
            logger.error('[ActionLogHooks] Failed to queue action log broadcast', {
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
