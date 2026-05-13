import { logger } from '$lib/server/logger';

/**
 * Logging-based metrics for monitoring system health.
 */
class Counter {
  private values = new Map<string, number>();
  
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {}

  inc(labels?: Record<string, string>, value: number = 1): void {
    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  get(labels?: Record<string, string>): number {
    const key = this.getLabelKey(labels);
    return this.values.get(key) || 0;
  }

  reset(labels?: Record<string, string>): void {
    const key = this.getLabelKey(labels);
    this.values.set(key, 0);
  }

  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels) return '__default__';
    return JSON.stringify(labels);
  }
}

class Histogram {
  private observations: Array<{ value: number; labels?: Record<string, string> }> = [];
  private buckets: number[];
  
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
    buckets?: number[]
  ) {
    this.buckets = buckets || [0.01, 0.05, 0.1, 0.5, 1, 2, 5];
  }

  observe(value: number, labels?: Record<string, string>): void {
    this.observations.push({ value, labels });
    
    if (this.observations.length > 10000) {
      this.observations = this.observations.slice(-10000);
    }
  }

  startTimer(labels?: Record<string, string>): () => void {
    const start = Date.now();
    return () => {
      const duration = (Date.now() - start) / 1000;
      this.observe(duration, labels);
    };
  }

  getPercentile(p: number, labels?: Record<string, string>): number {
    const filtered = labels 
      ? this.observations.filter(o => JSON.stringify(o.labels) === JSON.stringify(labels))
      : this.observations;
    
    if (filtered.length === 0) return 0;
    
    const sorted = filtered.map(o => o.value).sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (p / 100)) - 1;
    return sorted[Math.max(0, index)];
  }

  getBucketCounts(labels?: Record<string, string>): Record<string, number> {
    const filtered = labels
      ? this.observations.filter(o => JSON.stringify(o.labels) === JSON.stringify(labels))
      : this.observations;
    
    const counts: Record<string, number> = {};
    
    for (const bucket of this.buckets) {
      counts[`le_${bucket}`] = filtered.filter(o => o.value <= bucket).length;
    }
    counts['le_+Inf'] = filtered.length;
    
    return counts;
  }
}

class Gauge {
  private values = new Map<string, number>();
  
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = []
  ) {}

  set(value: number, labels?: Record<string, string>): void {
    const key = this.getLabelKey(labels);
    this.values.set(key, value);
  }

  inc(labels?: Record<string, string>, value: number = 1): void {
    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  dec(labels?: Record<string, string>, value: number = 1): void {
    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current - value);
  }

  get(labels?: Record<string, string>): number {
    const key = this.getLabelKey(labels);
    return this.values.get(key) || 0;
  }

  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels) return '__default__';
    return JSON.stringify(labels);
  }
}

export const metrics = {
  sequenceGaps: new Counter(
    'action_log_sequence_gaps_total',
    'Number of sequence gaps detected (indicates message loss)',
    ['deviceId']
  ),

  broadcastLatency: new Histogram(
    'action_log_broadcast_duration_seconds',
    'Time to broadcast action log event',
    ['eventType']
  ),

  dbQueryDuration: new Histogram(
    'action_log_db_query_duration_seconds',
    'Database query execution time',
    ['operation']
  ),

  mqttMessagesPublished: new Counter(
    'action_log_mqtt_messages_total',
    'Total MQTT messages published',
    ['topic', 'qos']
  ),

  mqttPublishFailures: new Counter(
    'action_log_mqtt_publish_failures_total',
    'MQTT publish failures',
    ['topic', 'errorType']
  ),

  activeSyncManagers: new Gauge(
    'action_log_active_sync_managers',
    'Number of active ActionLogSyncManager instances'
  ),

  rateLimitHits: new Counter(
    'action_log_rate_limit_hits_total',
    'Number of broadcasts blocked by rate limiter',
    ['limitType']
  ),

  resyncOperations: new Counter(
    'action_log_resync_operations_total',
    'Number of resync operations triggered',
    ['deviceId', 'reason']
  ),

  resyncDuration: new Histogram(
    'action_log_resync_duration_seconds',
    'Time to complete resync operation',
    ['deviceId']
  ),

  pendingBatches: new Gauge(
    'action_log_pending_batches',
    'Number of pending batched broadcasts'
  ),

  actionLogsCreated: new Counter(
    'action_logs_created_total',
    'Total action logs created',
    ['actionType', 'status']
  )
};

export function logMetrics(): void {
  logger.info('[Metrics] Current metrics', {
    sequenceGaps: metrics.sequenceGaps.get(),
    mqttMessages: metrics.mqttMessagesPublished.get(),
    activeSyncManagers: metrics.activeSyncManagers.get(),
    rateLimitHits: metrics.rateLimitHits.get(),
    resyncOps: metrics.resyncOperations.get(),
    pendingBatches: metrics.pendingBatches.get(),
    actionLogsCreated: metrics.actionLogsCreated.get()
  });
}

if (process.env.NODE_ENV !== 'production') {
  setInterval(logMetrics, 5 * 60 * 1000);
}
