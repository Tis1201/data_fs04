import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { getCurrentActiveSetting } from './index';

export interface AppSettings {
  system?: {
    siteName?: string;
    siteUrl?: string;
    debugMode?: boolean;
    maintenanceMode?: boolean;
    logLevel?: string;
  };
  auth?: {
    allowRegistration?: boolean;
    enforceStrongPasswords?: boolean;
  };
}

/**
 * Gets a specific setting value from the active settings.
 * Supports nested path notation like 'auth.enforceStrongPasswords'
 */
export async function getSetting<T = any>(path: string, defaultValue?: T): Promise<T> {
  try {
    const activeSetting = await getCurrentActiveSetting();
    console.log("activeSetting", activeSetting);
    
    if (!activeSetting.data) {
      return defaultValue as T;
    }

    const settings = JSON.parse(activeSetting.data);
    console.log("path", path)
    
    // Support nested path notation like 'auth.enforceStrongPasswords'
    const pathParts = path.split('.');
    let current = settings;
    
    for (const part of pathParts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue as T;
      }
    }
    
    return current as T;
  } catch (error) {
    logger.error('Error getting setting:', error as Record<string, any>);
    return defaultValue as T;
  }
} 
