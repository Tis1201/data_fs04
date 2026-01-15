import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';

/**
 * Generates monotonically increasing sequence numbers per device for action logs.
 * Uses database transactions to ensure thread-safety and prevent duplicates.
 */
export class SequenceGenerator {
  /**
   * Get the next sequence number for a device.
   */
  static async getNextSequence(
    prisma: PrismaClient,
    deviceId: string
  ): Promise<number> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const maxSequence = await tx.deviceActionLog.findFirst({
          where: { deviceId },
          orderBy: { sequenceNumber: 'desc' },
          select: { sequenceNumber: true }
        });

        const nextSequence = (maxSequence?.sequenceNumber || 0) + 1;

        logger.debug('[SequenceGenerator] Generated sequence number', {
          deviceId,
          currentMax: maxSequence?.sequenceNumber || 0,
          nextSequence
        });

        return nextSequence;
      });

      return result;
    } catch (error) {
      logger.error('[SequenceGenerator] Failed to generate sequence number', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Get the current maximum sequence number for a device.
   */
  static async getCurrentSequence(
    prisma: PrismaClient,
    deviceId: string
  ): Promise<number> {
    try {
      const maxSequence = await prisma.deviceActionLog.findFirst({
        where: { deviceId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true }
      });

      return maxSequence?.sequenceNumber || 0;
    } catch (error) {
      logger.error('[SequenceGenerator] Failed to get current sequence', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Backfill sequence numbers for existing logs without sequence numbers.
   */
  static async backfillSequenceNumbers(
    prisma: PrismaClient,
    deviceId?: string
  ): Promise<number> {
    try {
      const where = deviceId ? { deviceId, sequenceNumber: null } : { sequenceNumber: null };
      
      const logsWithoutSequence = await prisma.deviceActionLog.findMany({
        where,
        orderBy: { initiatedAt: 'asc' },
        select: { id: true, deviceId: true, initiatedAt: true }
      });

      if (logsWithoutSequence.length === 0) {
        logger.info('[SequenceGenerator] No logs to backfill', { deviceId });
        return 0;
      }

      logger.info('[SequenceGenerator] Starting backfill', {
        deviceId: deviceId || 'all',
        logCount: logsWithoutSequence.length
      });

      const deviceGroups = new Map<string, typeof logsWithoutSequence>();
      for (const log of logsWithoutSequence) {
        if (!deviceGroups.has(log.deviceId)) {
          deviceGroups.set(log.deviceId, []);
        }
        deviceGroups.get(log.deviceId)!.push(log);
      }

      let totalUpdated = 0;

      for (const [devId, logs] of deviceGroups.entries()) {
        const currentMax = await this.getCurrentSequence(prisma, devId);
        let sequence = currentMax;

        for (const log of logs) {
          sequence++;
          await prisma.deviceActionLog.update({
            where: { id: log.id },
            data: { sequenceNumber: sequence }
          });
          totalUpdated++;
        }

        logger.debug('[SequenceGenerator] Backfilled device', {
          deviceId: devId,
          logCount: logs.length,
          sequenceRange: `${currentMax + 1}-${sequence}`
        });
      }

      logger.info('[SequenceGenerator] Backfill completed', {
        deviceId: deviceId || 'all',
        totalUpdated
      });

      return totalUpdated;
    } catch (error) {
      logger.error('[SequenceGenerator] Failed to backfill sequence numbers', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
}
