/**
 * Message Queue with Concurrency Control
 * 
 * Implements backpressure and concurrent processing for MQTT messages
 * to prevent database connection pool exhaustion and improve throughput.
 * 
 * Based on ir-device-manager MQTT worker scaling improvements.
 */

import pLimit from 'p-limit';
import { logger } from '$lib/server/logger';

const MQTT_CONCURRENCY = parseInt(process.env.MQTT_CONCURRENCY || '10');
const MQTT_MAX_QUEUE_DEPTH = parseInt(process.env.MQTT_MAX_QUEUE_DEPTH || '1000');
const QUEUE_STATS_INTERVAL_MS = parseInt(process.env.QUEUE_STATS_INTERVAL_MS || '60000');

interface QueueStats {
  processed: number;
  failed: number;
  dropped: number;
  currentDepth: number;
  peakDepth: number;
}

export class MessageQueue {
  private limit: pLimit.Limit;
  private stats: QueueStats = {
    processed: 0,
    failed: 0,
    dropped: 0,
    currentDepth: 0,
    peakDepth: 0,
  };
  private statsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.limit = pLimit(MQTT_CONCURRENCY);
    logger.info(
      `[MessageQueue] Initialized with concurrency=${MQTT_CONCURRENCY}, maxDepth=${MQTT_MAX_QUEUE_DEPTH}`
    );
    this.startStatsLogging();
  }

  /**
   * Enqueue a message for processing with backpressure control
   */
  async enqueue<T>(
    handler: () => Promise<T>,
    context: { topic: string }
  ): Promise<void> {
    // Check queue depth for backpressure
    if (this.limit.pendingCount >= MQTT_MAX_QUEUE_DEPTH) {
      this.stats.dropped++;
      logger.warn(
        `[MessageQueue] Queue depth exceeded (${this.limit.pendingCount}/${MQTT_MAX_QUEUE_DEPTH}), dropping message from ${context.topic}`
      );
      return;
    }

    // Update stats
    this.stats.currentDepth = this.limit.pendingCount + this.limit.activeCount;
    if (this.stats.currentDepth > this.stats.peakDepth) {
      this.stats.peakDepth = this.stats.currentDepth;
    }

    // Enqueue with concurrency limit
    this.limit(async () => {
      try {
        await handler();
        this.stats.processed++;
      } catch (error) {
        this.stats.failed++;
        logger.error(
          `[MessageQueue] Handler failed for ${context.topic}: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      } finally {
        this.stats.currentDepth = this.limit.pendingCount + this.limit.activeCount;
      }
    }).catch((err) => {
      // Error already logged in handler
    });
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats & { activeCount: number; pendingCount: number } {
    return {
      ...this.stats,
      activeCount: this.limit.activeCount,
      pendingCount: this.limit.pendingCount,
    };
  }

  /**
   * Start periodic stats logging
   */
  private startStatsLogging(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      logger.info(
        `[MessageQueue] Stats: processed=${stats.processed}, failed=${stats.failed}, dropped=${stats.dropped}, ` +
        `active=${stats.activeCount}, pending=${stats.pendingCount}, peakDepth=${stats.peakDepth}`
      );
    }, QUEUE_STATS_INTERVAL_MS);
  }

  /**
   * Stop stats logging and cleanup
   */
  stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}
