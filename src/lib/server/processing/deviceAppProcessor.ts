/**
 * Device App Data Processing Service
 * Handles processing of device app data from ClickHouse to PostgreSQL
 */
import { deviceAppService, type DeviceAppSummary as ClickHouseAppSummary } from '$lib/server/clickhouse/deviceAppService';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';

export interface ProcessingResult {
  success: boolean;
  deviceId: string;
  accountId: string;
  appCount: number;
  processingTime: number;
  error?: string;
}

export class DeviceAppProcessor {
  constructor(private prisma: PrismaClient) {}

  /**
   * Process app data for a specific device
   */
  async processDeviceApps(deviceId: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting app data processing for device ${deviceId}`);

      // Get device info to retrieve accountId
      const device = await this.prisma.device.findUnique({
        where: { id: deviceId },
        select: { id: true, accountId: true }
      });

      if (!device || !device.accountId) {
        logger.warn(`Device ${deviceId} not found or missing accountId`);
        return {
          success: false,
          deviceId,
          accountId: '',
          appCount: 0,
          processingTime: Date.now() - startTime,
          error: 'Device not found or missing accountId'
        };
      }

      // Get app data from ClickHouse (using pagination to get just the summary info)
      const appsResult = await deviceAppService.getDeviceApps(deviceId, 1, 1);
      
      if (!appsResult || appsResult.total === 0) {
        logger.warn(`No app data found for device ${deviceId}`);
        return {
          success: false,
          deviceId,
          accountId: device.accountId,
          appCount: 0,
          processingTime: Date.now() - startTime,
          error: 'No app data found'
        };
      }

      // Get all apps to compute summary (we need full data to categorize)
      const allAppsResult = await deviceAppService.getDeviceApps(deviceId, 1, 10000);
      const apps = allAppsResult.apps;

      // Compute app counts by type
      const systemAppsCount = apps.filter(app => app.app_type?.toLowerCase() === 'system').length;
      const normalAppsCount = apps.filter(app => app.app_type?.toLowerCase() === 'normal').length;
      const userAppsCount = apps.filter(app => app.app_type?.toLowerCase() === 'user').length;

      // Get the latest sync time
      const latestAppSync = apps.length > 0 
        ? new Date(Math.max(...apps.map(app => new Date(app.created_at).getTime())))
        : new Date();

      // Update or create device app summary in PostgreSQL
      const summaryData = {
        deviceId: device.id,
        accountId: device.accountId,
        totalAppsCount: apps.length,
        systemAppsCount,
        normalAppsCount,
        lastAppSync: latestAppSync,
        lastProcessedAt: new Date()
      };

      await this.prisma.deviceAppSummary.upsert({
        where: { deviceId: device.id },
        update: summaryData,
        create: summaryData
      });

      const processingTime = Date.now() - startTime;
      
      logger.info(`Successfully processed app data for device ${deviceId}`, {
        deviceId,
        accountId: device.accountId,
        appCount: apps.length,
        processingTime
      });

      // Broadcast update to UI subscribers
      await this.broadcastAppUpdate(device.id, device.accountId, {
        totalApps: apps.length,
        systemApps: systemAppsCount,
        normalApps: normalAppsCount,
        userApps: userAppsCount,
        lastAppSync: latestAppSync
      });

      return {
        success: true,
        deviceId: device.id,
        accountId: device.accountId,
        appCount: apps.length,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`Failed to process app data for device ${deviceId}`, {
        error: errorMessage,
        processingTime
      });

      return {
        success: false,
        deviceId,
        accountId: '',
        appCount: 0,
        processingTime,
        error: errorMessage
      };
    }
  }

  /**
   * Process app data for multiple devices in an account
   */
  async processAccountDeviceApps(accountId: string, deviceIds?: string[]): Promise<ProcessingResult[]> {
    const results: ProcessingResult[] = [];
    
    try {
      // Get all devices in the account
      const devices = await this.prisma.device.findMany({
        where: {
          accountId,
          ...(deviceIds && { id: { in: deviceIds } })
        },
        select: { id: true }
      });

      logger.info(`Processing app data for ${devices.length} devices in account ${accountId}`);

      // Process each device
      for (const device of devices) {
        const result = await this.processDeviceApps(device.id);
        results.push(result);
      }

      logger.info(`Completed processing for account ${accountId}`, {
        totalDevices: devices.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error(`Failed to process account device apps for ${accountId}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return results;
  }

  /**
   * Broadcast app update to SSE subscribers
   */
  private async broadcastAppUpdate(
    deviceId: string, 
    accountId: string, 
    summary: {
      totalApps: number;
      systemApps: number;
      normalApps: number;
      userApps: number;
      lastAppSync: Date;
    }
  ): Promise<void> {
    try {
      const updateData = {
        totalApps: summary.totalApps,
        systemApps: summary.systemApps,
        normalApps: summary.normalApps,
        userApps: summary.userApps,
        lastAppSync: summary.lastAppSync.toISOString(),
        lastProcessedAt: new Date().toISOString()
      };

      // Broadcast to device-specific subscribers
      await publisher.publish(
        MessageFactory.createSystemMessage(
          'apps:updated',
          `subscription:device:${deviceId}`,
          updateData,
          SystemUser
        )
      );
      
      // Broadcast to account-level subscribers
      await publisher.publish(
        MessageFactory.createSystemMessage(
          'apps:updated',
          `subscription:account:${accountId}`,
          {
            deviceId,
            ...updateData
          },
          SystemUser
        )
      );

      logger.debug(`Broadcasted app update for device ${deviceId}`);
    } catch (error) {
      logger.error('Failed to broadcast app update', {
        error: error instanceof Error ? error.message : String(error),
        deviceId
      });
    }
  }

  /**
   * Get processing statistics for an account
   */
  async getProcessingStats(accountId: string): Promise<{
    totalDevices: number;
    processedDevices: number;
    lastProcessedAt: Date | null;
    averageProcessingTime: number;
  }> {
    try {
      const summaries = await this.prisma.deviceAppSummary.findMany({
        where: { accountId },
        select: {
          lastProcessedAt: true
        }
      });

      const totalDevices = await this.prisma.device.count({
        where: { accountId }
      });

      const processedDevices = summaries.length;
      const lastProcessedAt = summaries.length > 0 
        ? new Date(Math.max(...summaries.map((s: any) => s.lastProcessedAt.getTime())))
        : null;

      return {
        totalDevices,
        processedDevices,
        lastProcessedAt,
        averageProcessingTime: 0 // This would need to be tracked separately
      };
    } catch (error) {
      logger.error('Failed to get processing stats', {
        error: error instanceof Error ? error.message : String(error),
        accountId
      });
      throw error;
    }
  }

  /**
   * Clean up old processing data
   */
  async cleanupOldData(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.deviceAppSummary.deleteMany({
        where: {
          lastProcessedAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`Cleaned up ${result.count} old device app summaries`);
      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup old processing data', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Create a device app processor instance
 */
export function createDeviceAppProcessor(prisma: PrismaClient): DeviceAppProcessor {
  return new DeviceAppProcessor(prisma);
}
