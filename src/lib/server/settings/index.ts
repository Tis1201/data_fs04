import prisma from '../prisma';
import { logger } from '../logger';

/**
 * Ensures there is always exactly one active setting in the database.
 * Creates a default setting if none exists.
 * If multiple active settings exist, deactivates all but the most recent one.
 */
export async function ensureActiveSetting(): Promise<void> {
  try {
    // Get all active settings
    const activeSettings = await prisma.setting.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (activeSettings.length === 0) {
      // No active settings - create default
      await prisma.setting.create({
        data: {
          data: '{}', // Default empty JSON
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system',
        }
      });
      logger.info('Created default system settings - none existed');
    } else if (activeSettings.length > 1) {
      // Multiple active settings - keep only the most recent one
      const keepSetting = activeSettings[0]; // Most recent
      const settingsToDeactivate = activeSettings.slice(1); // All others

      await prisma.setting.updateMany({
        where: {
          id: { in: settingsToDeactivate.map(s => s.id) }
        },
        data: {
          isActive: false,
          updatedBy: 'system',
          updatedAt: new Date()
        }
      });

      logger.warn(`Deactivated ${settingsToDeactivate.length} duplicate active settings, kept most recent`);
    } else {
      // Exactly one active setting - perfect!
      logger.debug('Settings state is correct - exactly one active setting exists');
    }
  } catch (error) {
    logger.error('Error ensuring active setting:', error as Record<string, any>);
    throw error;
  }
}

/**
 * Gets the current active setting, ensuring one exists.
 * If no active setting exists, creates a default one.
 */
export async function getCurrentActiveSetting() {
  await ensureActiveSetting();
  
  const activeSetting = await prisma.setting.findFirst({
    where: { isActive: true }
  });

  if (!activeSetting) {
    throw new Error('Failed to ensure active setting exists');
  }

  return activeSetting;
}

/**
 * Updates the active setting atomically using a transaction.
 * Ensures there's always exactly one active setting.
 */
export async function updateActiveSetting(data: string, updatedBy: string) {
  // Validate JSON
  JSON.parse(data);

  return await prisma.$transaction(async (tx) => {
    // Deactivate all existing active settings
    await tx.setting.updateMany({
      where: { isActive: true },
      data: { 
        isActive: false,
        updatedBy,
        updatedAt: new Date()
      }
    });
    
    // Create new active setting
    return await tx.setting.create({
      data: {
        data,
        isActive: true,
        createdBy: updatedBy,
        updatedBy,
      }
    });
  });
}
