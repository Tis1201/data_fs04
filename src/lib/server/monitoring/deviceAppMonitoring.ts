/**
 * Device App Data Monitoring Service
 * Handles monitoring, metrics, and health checks for device app data flow
 */
import { logger } from '$lib/server/logger';
import { deviceAppService } from '$lib/server/clickhouse/deviceAppService';
import type { PrismaClient } from '@prisma/client';

export interface MonitoringMetrics {
  clickhouse: {
    connected: boolean;
    responseTime: number;
    lastError?: string;
  };
  postgresql: {
    connected: boolean;
    responseTime: number;
    lastError?: string;
  };
  sse: {
    activeConnections: number;
    lastBroadcast: Date | null;
  };
  processing: {
    totalDevices: number;
    processedDevices: number;
    lastProcessedAt: Date | null;
    averageProcessingTime: number;
    errorRate: number;
  };
  dataIngestion: {
    appsPerSecond: number;
    totalAppsToday: number;
    lastIngestion: Date | null;
  };
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  metrics: MonitoringMetrics;
  issues: string[];
}

export class DeviceAppMonitoring {
  private metrics: MonitoringMetrics = {
    clickhouse: { connected: false, responseTime: 0 },
    postgresql: { connected: false, responseTime: 0 },
    sse: { activeConnections: 0, lastBroadcast: null },
    processing: {
      totalDevices: 0,
      processedDevices: 0,
      lastProcessedAt: null,
      averageProcessingTime: 0,
      errorRate: 0
    },
    dataIngestion: {
      appsPerSecond: 0,
      totalAppsToday: 0,
      lastIngestion: null
    }
  };

  private errorCounts = new Map<string, number>();
  private processingTimes: number[] = [];
  private lastHealthCheck: Date | null = null;

  constructor(private prisma: PrismaClient) {
    // Start periodic health checks
    this.startHealthChecks();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    try {
      // Check ClickHouse
      const clickhouseStart = Date.now();
      const clickhouseConnected = await deviceAppService.testConnection();
      const clickhouseResponseTime = Date.now() - clickhouseStart;
      
      this.metrics.clickhouse = {
        connected: clickhouseConnected,
        responseTime: clickhouseResponseTime
      };

      if (!clickhouseConnected) {
        issues.push('ClickHouse connection failed');
        status = 'unhealthy';
      } else if (clickhouseResponseTime > 1000) {
        issues.push('ClickHouse response time is slow');
        status = 'degraded';
      }

      // Check PostgreSQL
      const postgresStart = Date.now();
      let postgresConnected = false;
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        postgresConnected = true;
      } catch (error) {
        this.metrics.postgresql.lastError = error instanceof Error ? error.message : String(error);
      }
      const postgresResponseTime = Date.now() - postgresStart;

      this.metrics.postgresql = {
        connected: postgresConnected,
        responseTime: postgresResponseTime
      };

      if (!postgresConnected) {
        issues.push('PostgreSQL connection failed');
        status = 'unhealthy';
      } else if (postgresResponseTime > 500) {
        issues.push('PostgreSQL response time is slow');
        status = 'degraded';
      }

      // Check processing metrics
      await this.updateProcessingMetrics();

      // Check data ingestion
      await this.updateDataIngestionMetrics();

      // Check error rates
      this.updateErrorRates();

      // Determine overall status
      if (this.metrics.processing.errorRate > 0.1) {
        issues.push('High error rate in processing');
        status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
      }

      if (this.metrics.dataIngestion.appsPerSecond === 0 && this.metrics.dataIngestion.lastIngestion) {
        const timeSinceLastIngestion = Date.now() - this.metrics.dataIngestion.lastIngestion.getTime();
        if (timeSinceLastIngestion > 300000) { // 5 minutes
          issues.push('No data ingestion for 5+ minutes');
          status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
        }
      }

      this.lastHealthCheck = new Date();

      logger.info('Health check completed', {
        status,
        issues: issues.length,
        responseTime: Date.now() - startTime
      });

    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      status = 'unhealthy';
      issues.push('Health check failed');
    }

    return {
      status,
      timestamp: new Date(),
      metrics: this.metrics,
      issues
    };
  }

  /**
   * Record processing time for metrics
   */
  recordProcessingTime(processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    // Keep only last 100 processing times
    if (this.processingTimes.length > 100) {
      this.processingTimes = this.processingTimes.slice(-100);
    }

    // Update average
    this.metrics.processing.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
  }

  /**
   * Record error for monitoring
   */
  recordError(errorType: string, error: Error): void {
    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);

    logger.error(`Device app monitoring error: ${errorType}`, {
      error: error.message,
      stack: error.stack,
      count: count + 1
    });
  }

  /**
   * Record data ingestion
   */
  recordDataIngestion(appCount: number): void {
    this.metrics.dataIngestion.lastIngestion = new Date();
    
    // Simple rate calculation (could be improved with more sophisticated metrics)
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    // This is a simplified calculation - in production you'd want more sophisticated metrics
    this.metrics.dataIngestion.appsPerSecond = appCount;
  }

  /**
   * Get current metrics
   */
  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  /**
   * Get error counts by type
   */
  getErrorCounts(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Reset error counts
   */
  resetErrorCounts(): void {
    this.errorCounts.clear();
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Run health check every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Periodic health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 30000);
  }

  /**
   * Update processing metrics
   */
  private async updateProcessingMetrics(): Promise<void> {
    try {
      const totalDevices = await this.prisma.device.count();
      const processedDevices = await this.prisma.deviceAppSummary.count();
      
      const lastProcessed = await this.prisma.deviceAppSummary.findFirst({
        orderBy: { lastProcessedAt: 'desc' },
        select: { lastProcessedAt: true }
      });

      this.metrics.processing = {
        ...this.metrics.processing,
        totalDevices,
        processedDevices,
        lastProcessedAt: lastProcessed?.lastProcessedAt || null
      };
    } catch (error) {
      logger.error('Failed to update processing metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update data ingestion metrics
   */
  private async updateDataIngestionMetrics(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // This would need to be implemented in ClickHouse service
      // For now, we'll use a placeholder
      this.metrics.dataIngestion = {
        ...this.metrics.dataIngestion,
        totalAppsToday: 0 // Would be calculated from ClickHouse
      };
    } catch (error) {
      logger.error('Failed to update data ingestion metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Update error rates
   */
  private updateErrorRates(): void {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    const totalProcessed = this.metrics.processing.processedDevices;
    
    if (totalProcessed > 0) {
      this.metrics.processing.errorRate = totalErrors / totalProcessed;
    } else {
      this.metrics.processing.errorRate = 0;
    }
  }
}

/**
 * Create monitoring instance
 */
export function createDeviceAppMonitoring(prisma: PrismaClient): DeviceAppMonitoring {
  return new DeviceAppMonitoring(prisma);
}
