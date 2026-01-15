import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

/**
 * Manages data retention for action logs to prevent database bloat.
 * Archives logs older than 90 days and deletes logs older than 1 year.
 */
export interface RetentionConfig {
  archiveAfterDays: number;
  deleteAfterDays: number;
  batchSize: number;
  archiveEnabled: boolean;
  deleteEnabled: boolean;
}

export class ActionLogRetentionJob {
  private static defaultConfig: RetentionConfig = {
    archiveAfterDays: 90,
    deleteAfterDays: 365,
    batchSize: 10000,
    archiveEnabled: false,
    deleteEnabled: false
  };

  static async run(config: Partial<RetentionConfig> = {}): Promise<void> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    logger.info('[ActionLogRetention] Starting retention job', {
      archiveEnabled: finalConfig.archiveEnabled,
      deleteEnabled: finalConfig.deleteEnabled,
      archiveAfterDays: finalConfig.archiveAfterDays,
      deleteAfterDays: finalConfig.deleteAfterDays
    });

    const startTime = Date.now();
    let totalArchived = 0;
    let totalDeleted = 0;

    try {
      if (finalConfig.archiveEnabled) {
        totalArchived = await this.archiveLogs(finalConfig);
      }

      if (finalConfig.deleteEnabled) {
        totalDeleted = await this.deleteLogs(finalConfig);
      }

      const duration = Date.now() - startTime;
      
      logger.info('[ActionLogRetention] Retention job completed', {
        totalArchived,
        totalDeleted,
        durationMs: duration
      });
    } catch (error) {
      logger.error('[ActionLogRetention] Retention job failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private static async archiveLogs(config: RetentionConfig): Promise<number> {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - config.archiveAfterDays);

    logger.info('[ActionLogRetention] Starting archival', {
      archiveDate: archiveDate.toISOString(),
      archiveAfterDays: config.archiveAfterDays
    });

    let totalArchived = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const logsToArchive = await prisma.deviceActionLog.findMany({
          where: {
            initiatedAt: { lt: archiveDate }
          },
          take: config.batchSize,
          orderBy: { initiatedAt: 'asc' },
          include: {
            user: { select: { id: true, name: true } },
            device: { select: { id: true, name: true } }
          }
        });

        if (logsToArchive.length === 0) {
          hasMore = false;
          break;
        }

        logger.debug('[ActionLogRetention] Processing archive batch', {
          batchSize: logsToArchive.length,
          oldestLog: logsToArchive[0]?.initiatedAt,
          newestLog: logsToArchive[logsToArchive.length - 1]?.initiatedAt
        });

        totalArchived += logsToArchive.length;

        if (logsToArchive.length < config.batchSize) {
          hasMore = false;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('[ActionLogRetention] Archival batch failed', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }

    logger.info('[ActionLogRetention] Archival completed', {
      totalArchived
    });

    return totalArchived;
  }

  private static async deleteLogs(config: RetentionConfig): Promise<number> {
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - config.deleteAfterDays);

    logger.info('[ActionLogRetention] Starting deletion', {
      deleteDate: deleteDate.toISOString(),
      deleteAfterDays: config.deleteAfterDays
    });

    let totalDeleted = 0;

    try {
      while (true) {
        const logsToDelete = await prisma.deviceActionLog.findMany({
          where: {
            initiatedAt: { lt: deleteDate }
          },
          take: config.batchSize,
          select: { id: true, initiatedAt: true }
        });

        if (logsToDelete.length === 0) {
          break;
        }

        const deleteResult = await prisma.deviceActionLog.deleteMany({
          where: {
            id: { in: logsToDelete.map(l => l.id) }
          }
        });

        totalDeleted += deleteResult.count;

        logger.debug('[ActionLogRetention] Deleted batch', {
          batchSize: deleteResult.count,
          totalDeleted,
          oldestDeleted: logsToDelete[0]?.initiatedAt
        });

        if (logsToDelete.length < config.batchSize) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.error('[ActionLogRetention] Deletion failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    logger.info('[ActionLogRetention] Deletion completed', {
      totalDeleted
    });

    return totalDeleted;
  }

  static async getStats(config: Partial<RetentionConfig> = {}): Promise<{
    totalLogs: number;
    logsToArchive: number;
    logsToDelete: number;
    estimatedSavings: {
      records: number;
      storageMB: number;
    };
  }> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - finalConfig.archiveAfterDays);
    
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - finalConfig.deleteAfterDays);

    const [totalLogs, logsToArchive, logsToDelete] = await Promise.all([
      prisma.deviceActionLog.count(),
      prisma.deviceActionLog.count({
        where: { initiatedAt: { lt: archiveDate } }
      }),
      prisma.deviceActionLog.count({
        where: { initiatedAt: { lt: deleteDate } }
      })
    ]);

    const estimatedSavingsMB = Math.round(logsToDelete / 1024);

    return {
      totalLogs,
      logsToArchive,
      logsToDelete,
      estimatedSavings: {
        records: logsToDelete,
        storageMB: estimatedSavingsMB
      }
    };
  }

  static schedule(config: Partial<RetentionConfig> = {}): void {
    const runDaily = () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(2, 0, 0, 0);

      if (now > scheduledTime) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const msUntilRun = scheduledTime.getTime() - now.getTime();

      logger.info('[ActionLogRetention] Scheduled next run', {
        nextRun: scheduledTime.toISOString(),
        msUntilRun
      });

      setTimeout(async () => {
        await this.run(config);
        runDaily();
      }, msUntilRun);
    };

    runDaily();
    logger.info('[ActionLogRetention] Retention job scheduler started');
  }
}
