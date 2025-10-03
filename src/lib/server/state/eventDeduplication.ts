import { logger } from '$lib/server/logger';
import { getStateManager } from './stateManagerFactory';
import type { ClickHouseEvent } from '../clickhouse/client';

export class EventDeduplicationService {
  private readonly ttlSeconds: number;
  private readonly keyPrefix = 'processed_event:';

  constructor() {
    this.ttlSeconds = 24 * 60 * 60; // 24 hours
  }

  generateEventId(event: ClickHouseEvent): string {
    return `${event.deviceId}:${event.waveId}:${event.bundleId}:${event.ts}`;
  }

  async isEventProcessed(event: ClickHouseEvent): Promise<boolean> {
    try {
      const stateManager = getStateManager();
      const eventId = this.generateEventId(event);
      const key = `${this.keyPrefix}${eventId}`;

      // For file-based manager, we'll use a simple in-memory Set
      // For Redis manager, we'll use Redis EXISTS
      if (process.env.STATE_BACKEND === 'redis') {
        // Redis implementation would go here
        // For now, we'll use a simple approach
        return false;
      } else {
        // File-based implementation
        return this.isEventProcessedInMemory(eventId);
      }
    } catch (error) {
      logger.error(`[EventDeduplication] Failed to check if event is processed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async markEventAsProcessed(event: ClickHouseEvent): Promise<void> {
    try {
      const eventId = this.generateEventId(event);
      
      if (process.env.STATE_BACKEND === 'redis') {
        // Redis implementation would go here
        // For now, we'll use a simple approach
        this.markEventProcessedInMemory(eventId);
      } else {
        // File-based implementation
        this.markEventProcessedInMemory(eventId);
      }
    } catch (error) {
      logger.error(`[EventDeduplication] Failed to mark event as processed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private processedEvents: Set<string> = new Set();

  private isEventProcessedInMemory(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  private markEventProcessedInMemory(eventId: string): void {
    this.processedEvents.add(eventId);
    
    // Clean up old events to prevent memory leaks
    if (this.processedEvents.size > 10000) {
      const eventsArray = Array.from(this.processedEvents);
      this.processedEvents = new Set(eventsArray.slice(-5000)); // Keep last 5000
    }
  }

  async cleanup(): Promise<void> {
    // Clean up old processed events
    this.processedEvents.clear();
    logger.debug('[EventDeduplication] Cleaned up processed events cache');
  }
}

// Singleton instance
export const eventDeduplication = new EventDeduplicationService();
