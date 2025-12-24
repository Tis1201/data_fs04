import type { CronFunction, CronContext } from '../types';
import { PrismaClient } from '@prisma/client';

/**
 * Arguments for factory-tokens-expire function
 */
export interface FactoryTokensExpireArgs {
  /**
   * REQUIRED: Specific factory token ID to process
   * Each cronjob should process only ONE specific token
   * This approach is much more efficient than searching through all tokens
   */
  factoryTokenId: string;

  /**
   * Mark expired tokens with a specific status or action
   * Options: 'log', 'mark', 'delete'
   * Default: 'mark'
   */
  action?: 'log' | 'mark' | 'delete';
}

/**
 * Factory Tokens Expire Cron Function
 * 
 * Processes ONE specific FactoryToken by ID
 * This is much more efficient than searching through all tokens
 * 
 * Pattern: One cronjob per factory token
 * - Each factory token gets its own cronjob with its specific ID
 * - Cronjob runs at the token's expiration time
 * - Only processes that one specific token (no searching needed)
 * 
 * @param args - Function arguments (requires factoryTokenId)
 * @param context - Execution context
 */
export const factoryTokensExpire: CronFunction<FactoryTokensExpireArgs> = async (
  args: FactoryTokensExpireArgs,
  context: CronContext
) => {
  const { prisma, logger, jobId, jobName } = context;
  const { factoryTokenId, action = 'mark' } = args;

  // Validate required argument
  if (!factoryTokenId) {
    const error = 'factoryTokenId is required in args';
    logger.error(`[FactoryTokensExpire] ${error}`);
    throw new Error(error);
  }

  logger.info(`[FactoryTokensExpire] Starting job: ${jobName} (${jobId})`);
  logger.info(`[FactoryTokensExpire] Processing token: ${factoryTokenId}, Action: ${action}`);

  try {
    // Fetch the specific factory token
    const token = await (prisma as any).factoryToken.findUnique({
      where: { id: factoryTokenId },
      select: {
        id: true,
        name: true,
        token: true,
        expiresAt: true,
        issuedAt: true,
        isUsed: true,
        hardwareModel: true,
        firmwareVersion: true,
        batchNumber: true,
        notes: true
      }
    });

    // Check if token exists
    if (!token) {
      logger.warn(`[FactoryTokensExpire] Token not found: ${factoryTokenId}`);
      // Delete the cronjob since the token no longer exists
      await (prisma as any).cronJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', lastResult: 'Token not found - job completed' }
      });
      return;
    }

    // Check if already used
    if (token.isUsed) {
      logger.info(`[FactoryTokensExpire] Token already used: ${factoryTokenId}`);
      // Mark cronjob as inactive since token is already processed
      await (prisma as any).cronJob.update({
        where: { id: jobId },
        data: { status: 'COMPLETED', lastResult: 'Token already used - job completed' }
      });
      return;
    }

    // Check if expired
    const now = new Date();
    if (token.expiresAt > now) {
      logger.info(`[FactoryTokensExpire] Token not yet expired: ${factoryTokenId} (expires at ${token.expiresAt.toISOString()})`);
      return;
    }

    logger.info(`[FactoryTokensExpire] Token expired: ${factoryTokenId} (expired at ${token.expiresAt.toISOString()})`);

    // Process the expired token based on action
    switch (action) {
      case 'log':
        // Just log the expired token
        logger.info(`[FactoryTokensExpire] Expired token (logging only):`, {
          id: token.id,
          name: token.name,
          expiresAt: token.expiresAt,
          hardwareModel: token.hardwareModel
        });
        break;

      case 'mark':
        // Mark token as used (soft delete approach)
        await (prisma as any).factoryToken.update({
          where: { id: token.id },
          data: {
            isUsed: true,
            usedAt: new Date(),
            notes: token.notes 
              ? `${token.notes}\n[Auto-expired by cronjob ${jobId} at ${new Date().toISOString()}]`
              : `[Auto-expired by cronjob ${jobId} at ${new Date().toISOString()}]`
          }
        });
        logger.info(`[FactoryTokensExpire] Marked token as used: ${token.id}`);
        
        // Mark cronjob as inactive since token is now processed
        await (prisma as any).cronJob.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', lastResult: 'Token marked as used - job completed' }
        });
        break;

      case 'delete':
        // Hard delete expired token
        await (prisma as any).factoryToken.delete({
          where: { id: token.id }
        });
        logger.info(`[FactoryTokensExpire] Deleted token: ${token.id}`);
        
        // Mark cronjob as inactive since token is now deleted
        await (prisma as any).cronJob.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', lastResult: 'Token deleted - job completed' }
        });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logger.info(`[FactoryTokensExpire] Job completed successfully: ${jobName} (${jobId})`, {
      factoryTokenId,
      action,
      tokenName: token.name
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[FactoryTokensExpire] Job failed: ${jobName} (${jobId}): ${errorMessage}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

