/**
 * Device App Data Processing Scheduler
 * Handles periodic processing of device app data
 */
import { logger } from '$lib/server/logger';
import { createDeviceAppProcessor } from '$lib/server/processing/deviceAppProcessor';
import { createDeviceAppMonitoring } from '$lib/server/monitoring/deviceAppMonitoring';
import type { PrismaClient } from '@prisma/client';

export interface SchedulerConfig {
  processingIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  cleanupIntervalMs: number;
  olderThanDays: number;
}

// Derive the metrics type without referencing `this` in a type position
type DeviceAppMetrics = ReturnType<ReturnType<typeof createDeviceAppMonitoring>['getMetrics']>;

export class DeviceAppScheduler {
  private processor: ReturnType<typeof createDeviceAppProcessor>;
  private monitoring: ReturnType<typeof createDeviceAppMonitoring>;
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private config: SchedulerConfig;

  constructor(
    private prisma: PrismaClient,
    config: Partial<SchedulerConfig> = {}
  ) {
    this.processor = createDeviceAppProcessor(prisma);
    this.monitoring = createDeviceAppMonitoring(prisma);
    
    this.config = {
      processingIntervalMs: 30000, // 30 seconds
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 5000,
      cleanupIntervalMs: 3600000, // 1 hour
      olderThanDays: 30,
      ...config
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Device app scheduler is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting device app data scheduler', {
      processingInterval: this.config.processingIntervalMs,
      batchSize: this.config.batchSize,
      cleanupInterval: this.config.cleanupIntervalMs
    });

    // Start processing interval
    this.processingInterval = setInterval(() => {
      this.processPendingDevices().catch(error => {
        logger.error('Scheduled processing failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.config.processingIntervalMs);

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData().catch(error => {
        logger.error('Scheduled cleanup failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.config.cleanupIntervalMs);

    // Process immediately on start
    this.processPendingDevices().catch(error => {
      logger.error('Initial processing failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Device app scheduler is not running');
      return;
    }

    this.isRunning = false;
    logger.info('Stopping device app data scheduler');

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Process pending devices
   */
  private async processPendingDevices(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Get devices that need processing
      const devices = await this.getDevicesNeedingProcessing();
      
      if (devices.length === 0) {
        logger.debug('No devices need processing');
        return;
      }

      logger.info(`Processing ${devices.length} devices`, {
        batchSize: this.config.batchSize
      });

      // Process devices in batches
      const batches = this.chunkArray(devices, this.config.batchSize);
      let processedCount = 0;
      let errorCount = 0;

      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(deviceId => this.processDeviceWithRetry(deviceId))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              processedCount++;
            } else {
              errorCount++;
            }
          } else {
            errorCount++;
            logger.error('Device processing failed', {
              error: result.reason instanceof Error ? result.reason.message : String(result.reason)
            });
          }
        }

        // Small delay between batches to avoid overwhelming the system
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const processingTime = Date.now() - startTime;
      
      logger.info('Batch processing completed', {
        totalDevices: devices.length,
        processedCount,
        errorCount,
        processingTime
      });

      // Record metrics
      this.monitoring.recordProcessingTime(processingTime);

    } catch (error) {
      logger.error('Failed to process pending devices', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.monitoring.recordError('batch_processing', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get devices that need processing
   */
  private async getDevicesNeedingProcessing(): Promise<string[]> {
    try {
      // Get devices that haven't been processed recently or have never been processed
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - 5); // Process if not updated in last 5 minutes

      const devices = await this.prisma.device.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            {
              appSummaries: {
                none: {}
              }
            },
            {
              appSummaries: {
                some: {
                  lastProcessedAt: {
                    lt: cutoffTime
                  }
                }
              }
            }
          ]
        },
        select: { id: true },
        take: this.config.batchSize * 2 // Get more than batch size to have options
      });

      return devices.map(device => device.id);
    } catch (error) {
      logger.error('Failed to get devices needing processing', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Process a single device with retry logic
   */
  private async processDeviceWithRetry(deviceId: string): Promise<{ success: boolean; error?: string }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.processor.processDeviceApps(deviceId);
        
        if (result.success) {
          return { success: true };
        } else {
          lastError = new Error(result.error || 'Processing failed');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Wait before retry (except on last attempt)
      if (attempt < this.config.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * attempt));
      }
    }

    this.monitoring.recordError('device_processing', lastError!);
    
    return {
      success: false,
      error: lastError!.message
    };
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      const deletedCount = await this.processor.cleanupOldData(this.config.olderThanDays);
      
      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old device app summaries`);
      }
    } catch (error) {
      logger.error('Failed to cleanup old data', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.monitoring.recordError('cleanup', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
    metrics: DeviceAppMetrics;
  } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      metrics: this.monitoring.getMetrics()
    };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Scheduler configuration updated', { config: this.config });
  }
}

/**
 * Create scheduler instance
 */
export function createDeviceAppScheduler(
  prisma: PrismaClient,
  config?: Partial<SchedulerConfig>
): DeviceAppScheduler {
  return new DeviceAppScheduler(prisma, config);
}
