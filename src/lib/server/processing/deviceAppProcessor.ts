/**
 * Device App Data Processing Service
 * Handles processing of device app data from ClickHouse to PostgreSQL
 */
import { deviceAppService, type DeviceAppSummary as ClickHouseAppSummary } from '$lib/server/clickhouse/deviceAppService';
import { sseManager } from '$lib/server/sse';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

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

      // Get app summary from ClickHouse
      const clickhouseSummary = await deviceAppService.getDeviceAppSummary(deviceId);
      
      if (!clickhouseSummary) {
        logger.warn(`No app data found for device ${deviceId}`);
        return {
          success: false,
          deviceId,
          accountId: '',
          appCount: 0,
          processingTime: Date.now() - startTime,
          error: 'No app data found'
        };
      }

      // Update or create device app summary in PostgreSQL
      const summaryData = {
        deviceId: clickhouseSummary.device_id,
        accountId: clickhouseSummary.account_id,
        totalAppsCount: clickhouseSummary.total_apps,
        systemAppsCount: clickhouseSummary.system_apps,
        normalAppsCount: clickhouseSummary.normal_apps,
        lastAppSync: clickhouseSummary.last_app_sync,
        lastProcessedAt: new Date()
      };

      await this.prisma.deviceAppSummary.upsert({
        where: { deviceId: clickhouseSummary.device_id },
        update: summaryData,
        create: summaryData
      });

      const processingTime = Date.now() - startTime;
      
      logger.info(`Successfully processed app data for device ${deviceId}`, {
        deviceId,
        accountId: clickhouseSummary.account_id,
        appCount: clickhouseSummary.total_apps,
        processingTime
      });

      // Broadcast update to UI subscribers
      await this.broadcastAppUpdate(clickhouseSummary);

      return {
        success: true,
        deviceId: clickhouseSummary.device_id,
        accountId: clickhouseSummary.account_id,
        appCount: clickhouseSummary.total_apps,
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
  private async broadcastAppUpdate(summary: ClickHouseAppSummary): Promise<void> {
    try {
      const updateData = {
        type: 'apps_updated',
        deviceId: summary.device_id,
        accountId: summary.account_id,
        data: {
          totalApps: summary.total_apps,
          systemApps: summary.system_apps,
          normalApps: summary.normal_apps,
          userApps: summary.user_apps,
          lastAppSync: summary.last_app_sync,
          lastProcessedAt: summary.last_processed_at
        },
        timestamp: new Date()
      };

      // Broadcast to device-specific subscribers
      await sseManager.broadcast(`device-${summary.device_id}-detail`, updateData);
      
      // Broadcast to account-level subscribers
      await sseManager.broadcast(`account-${summary.account_id}-device-apps-changed`, updateData);

      logger.debug(`Broadcasted app update for device ${summary.device_id}`);
    } catch (error) {
      logger.error('Failed to broadcast app update', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: summary.device_id
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
