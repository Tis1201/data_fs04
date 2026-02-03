import type { CronFunction, CronContext } from '../types';

/**
 * Arguments for entity-expire function
 * Generic function that handles expiration for ANY entity type
 */
export interface EntityExpireArgs {
  /**
   * REQUIRED: Type of entity to expire
   * Examples: 'factoryToken', 'session', 'apiKey', 'webhookEndpoint', 'license', etc.
   */
  entityType: string;

  /**
   * REQUIRED: Specific entity ID to process
   * Each cronjob processes only ONE specific entity by ID
   */
  entityId: string;

  /**
   * Action to perform on the expired entity
   * - 'mark': Mark as expired/used (soft delete)
   * - 'delete': Hard delete the entity
   * - 'deactivate': Set active=false or similar
   * - 'log': Just log, don't modify
   * Default: 'mark'
   */
  action?: 'mark' | 'delete' | 'deactivate' | 'log';

  /**
   * Optional: Custom field to update
   * Example: { isUsed: true, usedAt: new Date() }
   */
  updateFields?: Record<string, any>;
}

/**
 * Entity configuration for different entity types
 * Defines how to handle each entity type
 */
const ENTITY_CONFIG: Record<string, {
  modelName: string; // Prisma model name
  expiresAtField: string; // Field name for expiration date
  markFields?: Record<string, any>; // Fields to update when marking as expired
  deactivateFields?: Record<string, any>; // Fields to update when deactivating
}> = {
  factoryToken: {
    modelName: 'factoryToken',
    expiresAtField: 'expiresAt',
    markFields: { isUsed: true, usedAt: 'now', status: 'EXPIRED' },
  },
  session: {
    modelName: 'session',
    expiresAtField: 'expiresAt',
    // Sessions are deleted, but we can mark status before deletion if field exists
    markFields: { status: 'EXPIRED' },
  },
  apiKey: {
    modelName: 'apiKey',
    expiresAtField: 'expiresAt',
    deactivateFields: { active: false },
  },
  webhookEndpoint: {
    modelName: 'webhookEndPoint',
    expiresAtField: 'expiresAt',
    deactivateFields: { active: false, status: 'INACTIVE' },
  },
  refreshToken: {
    modelName: 'refreshToken',
    expiresAtField: 'expiresAt',
    markFields: { isRevoked: true, revokedAt: 'now' },
  },
  license: {
    modelName: 'license',
    expiresAtField: 'expiresAt',
    markFields: { status: 'EXPIRED' },
  },
  preclaimSet: {
    modelName: 'preclaimSet',
    expiresAtField: 'expiresAt',
    markFields: { status: 'EXPIRED' },
  },
  preclaimDevice: {
    modelName: 'preclaimDevice',
    expiresAtField: 'expiresAt',
    markFields: { status: 'EXPIRED' },
  },
  factoryDevice: {
    modelName: 'factoryDevice',
    expiresAtField: 'expiresAt',
    markFields: { status: 'EXPIRED' },
  },
};

/**
 * Generic Entity Expire Cron Function
 * 
 * Handles expiration for ANY entity type (FactoryToken, Session, ApiKey, etc.)
 * 
 * Pattern: One cronjob per entity instance
 * - Each entity gets its own cronjob with its specific ID
 * - Cronjob runs at the entity's expiration time
 * - Only processes that one specific entity (no searching needed)
 * - Generic function works for all entity types
 * 
 * @param args - Function arguments (requires entityType and entityId)
 * @param context - Execution context
 */
export const entityExpire: CronFunction<EntityExpireArgs> = async (
  args: EntityExpireArgs,
  context: CronContext
) => {
  const { prisma, logger, jobId, jobName } = context;
  const { entityType, entityId, action = 'mark', updateFields } = args;

  // Validate required arguments
  if (!entityType) {
    const error = 'entityType is required in args';
    logger.error(`[EntityExpire] ${error}`);
    throw new Error(error);
  }

  if (!entityId) {
    const error = 'entityId is required in args';
    logger.error(`[EntityExpire] ${error}`);
    throw new Error(error);
  }

  logger.info(`[EntityExpire] Starting job: ${jobName} (${jobId})`);
  logger.info(`[EntityExpire] EntityType: ${entityType}, EntityId: ${entityId}, Action: ${action}`);

  try {
    // Get entity configuration
    const config = ENTITY_CONFIG[entityType];
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}. Please add configuration in ENTITY_CONFIG.`);
    }

    const { modelName, expiresAtField } = config;

    // Fetch the specific entity
    const entity = await (prisma as any)[modelName].findUnique({
      where: { id: entityId }
    });

    // Check if entity exists
    if (!entity) {
      logger.warn(`[EntityExpire] Entity not found: ${entityType}/${entityId}`);
      // Mark cronjob as inactive since entity no longer exists
      await (prisma as any).cronJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED', 
          lastResult: 'success',
          lastError: 'Entity not found'
        }
      });
      return;
    }

    // Check if expired
    const expiresAt = entity[expiresAtField];
    if (!expiresAt) {
      logger.warn(`[EntityExpire] Entity has no expiration date: ${entityType}/${entityId}`);
      await (prisma as any).cronJob.update({
        where: { id: jobId },
        data: { 
          status: 'COMPLETED', 
          lastResult: 'success',
          lastError: 'No expiration date'
        }
      });
      return;
    }

    const now = new Date();
    if (new Date(expiresAt) > now) {
      logger.info(`[EntityExpire] Entity not yet expired: ${entityType}/${entityId} (expires at ${new Date(expiresAt).toISOString()})`);
      return;
    }

    logger.info(`[EntityExpire] Entity expired: ${entityType}/${entityId} (expired at ${new Date(expiresAt).toISOString()})`);

    // Process the expired entity based on action
    switch (action) {
      case 'log':
        // Just log the expired entity
        logger.info(`[EntityExpire] Expired entity (logging only):`, {
          entityType,
          entityId,
          entity
        });
        break;

      case 'mark': {
        // preclaimSet: mark all PENDING devices in set as EXPIRED, then set set status to EXPIRED
        if (entityType === 'preclaimSet') {
          const deviceResult = await (prisma as any).preclaimDevice.updateMany({
            where: { setId: entityId, status: 'PENDING' },
            data: { status: 'EXPIRED' }
          });
          const count = deviceResult.count ?? 0;
          logger.info(`[EntityExpire] PreclaimSet ${entityId}: marked ${count} device(s) as EXPIRED`);

          await (prisma as any).preclaimSet.update({
            where: { id: entityId },
            data: { status: 'EXPIRED' }
          });
          logger.info(`[EntityExpire] PreclaimSet ${entityId}: set status to EXPIRED`);

          await (prisma as any).cronJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', lastResult: 'success', lastError: null }
          });
          break;
        }

        // Mark entity as expired (soft delete)
        const markData = updateFields || config.markFields || {};
        const processedMarkData: Record<string, any> = {};
        for (const [key, value] of Object.entries(markData)) {
          processedMarkData[key] = value === 'now' ? new Date() : value;
        }

        await (prisma as any)[modelName].update({
          where: { id: entityId },
          data: processedMarkData
        });
        logger.info(`[EntityExpire] Marked entity as expired: ${entityType}/${entityId}`, {
          updates: processedMarkData
        });

        await (prisma as any).cronJob.update({
          where: { id: jobId },
          data: { status: 'COMPLETED', lastResult: 'success', lastError: null }
        });
        break;
      }

      case 'deactivate':
        // Deactivate entity (set active=false or similar)
        const deactivateData = updateFields || config.deactivateFields || { active: false };
        
        await (prisma as any)[modelName].update({
          where: { id: entityId },
          data: deactivateData
        });
        logger.info(`[EntityExpire] Deactivated entity: ${entityType}/${entityId}`, {
          updates: deactivateData
        });
        
        // Mark cronjob as completed since entity is now processed
        await (prisma as any).cronJob.update({
          where: { id: jobId },
          data: { 
            status: 'COMPLETED', 
            lastResult: 'success',
            lastError: null
          }
        });
        break;

      case 'delete':
        // For session, mark as EXPIRED first (if status field exists), then delete
        if (entityType === 'session' && config.markFields) {
          try {
            await (prisma as any)[modelName].update({
              where: { id: entityId },
              data: config.markFields
            });
            logger.info(`[EntityExpire] Marked ${entityType}/${entityId} as EXPIRED before deletion`);
          } catch (error) {
            // If status field doesn't exist, continue with deletion
            logger.debug(`[EntityExpire] Could not set status (field may not exist): ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Hard delete expired entity
        await (prisma as any)[modelName].delete({
          where: { id: entityId }
        });
        logger.info(`[EntityExpire] Deleted entity: ${entityType}/${entityId}`);
        
        // Mark cronjob as completed since entity is now deleted
        await (prisma as any).cronJob.update({
          where: { id: jobId },
          data: { 
            status: 'COMPLETED', 
            lastResult: 'success',
            lastError: null
          }
        });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logger.info(`[EntityExpire] Job completed successfully: ${jobName} (${jobId})`, {
      entityType,
      entityId,
      action
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[EntityExpire] Job failed: ${jobName} (${jobId}): ${errorMessage}`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      entityType,
      entityId,
      action
    });
    throw error;
  }
};

