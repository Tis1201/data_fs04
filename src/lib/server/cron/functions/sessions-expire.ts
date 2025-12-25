import type { CronFunction, CronContext } from '../types';
import { PrismaClient } from '@prisma/client';

/**
 * Arguments for sessions-expire function
 */
export interface SessionsExpireArgs {
  /**
   * Only delete sessions expired for at least this many days
   * Default: 0 (delete all expired sessions immediately)
   * Recommended: 0 (sessions should be deleted as soon as they expire)
   */
  minExpiredDays?: number;

  /**
   * Batch size for deletion (to avoid large transactions)
   * Default: 1000
   */
  batchSize?: number;
}

/**
 * Sessions Expire Cron Function
 * 
 * Deletes expired Session records where expiresAt < now()
 * Sessions are authentication tokens that should be cleaned up immediately upon expiration
 * 
 * @param args - Function arguments
 * @param context - Execution context
 */
export const sessionsExpire: CronFunction<SessionsExpireArgs> = async (
  args: SessionsExpireArgs,
  context: CronContext
) => {
  const { prisma, logger, jobId, jobName } = context;
  const { minExpiredDays = 0, batchSize = 1000 } = args;

  logger.info(`[SessionsExpire] Starting job: ${jobName} (${jobId})`);
  logger.info(`[SessionsExpire] MinExpiredDays: ${minExpiredDays}, BatchSize: ${batchSize}`);

  try {
    // Calculate the cutoff date if minExpiredDays is specified
    const cutoffDate = minExpiredDays > 0 
      ? new Date(Date.now() - minExpiredDays * 24 * 60 * 60 * 1000)
      : new Date();

    // Count expired sessions first
    const expiredCount = await (prisma as any).session.count({
      where: {
        expiresAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info(`[SessionsExpire] Found ${expiredCount} expired sessions`);

    if (expiredCount === 0) {
      logger.info(`[SessionsExpire] No expired sessions to delete`);
      return;
    }

    let deletedCount = 0;
    let errorCount = 0;
    let offset = 0;

    // Delete in batches to avoid large transactions
    while (offset < expiredCount) {
      try {
        // Get batch of expired session IDs
        const expiredSessions = await (prisma as any).session.findMany({
          where: {
            expiresAt: {
              lt: cutoffDate
            }
          },
          select: {
            id: true
          },
          take: batchSize,
          skip: offset,
          orderBy: {
            expiresAt: 'asc'
          }
        });

        if (expiredSessions.length === 0) {
          break;
        }

        const sessionIds = expiredSessions.map((s: any) => s.id);

        // Delete batch
        const result = await (prisma as any).session.deleteMany({
          where: {
            id: {
              in: sessionIds
            }
          }
        });

        deletedCount += result.count || 0;
        offset += batchSize;

        logger.debug(`[SessionsExpire] Deleted batch: ${result.count || 0} sessions (total: ${deletedCount}/${expiredCount})`);

      } catch (error) {
        errorCount++;
        logger.error(`[SessionsExpire] Error deleting batch at offset ${offset}:`, {
          error: error instanceof Error ? error.message : String(error),
          offset,
          batchSize
        });
        // Continue with next batch even if one fails
        offset += batchSize;
      }
    }

    logger.info(`[SessionsExpire] Job completed: ${jobName} (${jobId})`, {
      totalFound: expiredCount,
      deleted: deletedCount,
      errors: errorCount
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[SessionsExpire] Job failed: ${jobName} (${jobId}): ${errorMessage}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

