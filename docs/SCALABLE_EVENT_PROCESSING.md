# Scalable Event Processing for 100k+ Devices

## Overview

This document outlines the design for processing bundle installation events from ClickHouse at scale, supporting 100k+ devices with real-time updates, fault tolerance, and efficient resource utilization.

## Problem Statement

The current file-based polling approach has several scalability limitations:

1. **Processing ALL events every poll** - Even completed bundles
2. **In-memory deduplication** - `processedEventIds` Set grows to 100k+ entries
3. **Single-threaded processing** - One device at a time
4. **No batch processing** - Processing events individually
5. **No partitioning** - All devices in one query
6. **Late device responses** - Devices can send data after bundle timeout

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ClickHouse    │───▶│  Event Processor │───▶│   PostgreSQL    │
│  (Event Store)  │    │   (Worker Pool)  │    │  (State Store)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   SSE Publisher  │
                       │  (Real-time UI)  │
                       └──────────────────┘
```

## Environment Configuration

Add these environment variables to your `.env` file:

```bash
# State Management Configuration
STATE_BACKEND=file  # or 'redis' for production
BUNDLE_STATE_FILE=./workings/bundle_states.json
GRACE_PERIOD_HOURS=2

# Redis Configuration (Production)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password

# ClickHouse Configuration (already configured)
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER_NAME=admin
CLICKHOUSE_PASSWORD=admin0823
USE_CLICKHOUSE=true
```

### Local Development (File-based)
- Set `STATE_BACKEND=file`
- State stored in JSON file
- No Redis dependency
- Perfect for development

### Production (Redis-based)
- Set `STATE_BACKEND=redis`
- State stored in Redis
- Better performance and scalability
- Requires Redis server

## Core Components

### 1. Event Processing States

Instead of just "active bundles", we use **event processing states**:

```typescript
enum BundleProcessingState {
  ACTIVE = 'ACTIVE',           // Currently processing devices
  TIMEOUT_PENDING = 'TIMEOUT_PENDING',  // Timed out, but still accepting late responses
  COMPLETED = 'COMPLETED',     // All devices processed successfully
  FAILED = 'FAILED',           // Failed and no longer accepting responses
  CANCELLED = 'CANCELLED'      // Manually cancelled
}

interface BundleProcessingState {
  bundleId: string;
  state: BundleProcessingState;
  timeoutAt: Date | null;
  gracePeriodHours: number; // How long to accept late responses
  lastDeviceResponse: Date | null;
  updatedAt: Date;
}
```

### 2. State Management Backends

**File-based (Local Development)**
- Stores state in JSON file: `./workings/bundle_states.json`
- No external dependencies
- Easy debugging and inspection

**Redis (Production)**
- Distributed state management
- High performance
- Automatic expiration
- Cluster support

**PostgreSQL (Alternative)**
- Uses existing database
- ACID compliance
- No additional infrastructure

### 3. Event Processing Pipeline

#### Phase 1: Smart Event Ingestion
```sql
-- ClickHouse query with smart filtering
SELECT deviceId, waveId, bundleId, status, progress, message, ts, type
FROM mv_bundle_logs 
WHERE ts >= '${windowStart}'
  AND ts <= '${windowEnd}'
  AND bundleId IN (${processableBundleIds.join(',')})  -- Only processable bundles
  AND status IN ('IN_PROGRESS', 'COMPLETED', 'FAILED')  -- Only relevant statuses
ORDER BY ts ASC
LIMIT 10000  -- Batch size limit
```

#### Phase 2: Batch Processing
```typescript
// Process events in batches by bundle
const eventsByBundle = groupBy(events, 'bundleId');

for (const [bundleId, bundleEvents] of eventsByBundle) {
  // Process each bundle in parallel
  await processBundleEvents(bundleId, bundleEvents);
}
```

#### Phase 3: Parallel Processing
```typescript
// Worker pool for parallel processing
const workerPool = new WorkerPool({
  maxWorkers: 10,
  taskQueue: 'bundle_processing'
});

// Each worker processes one bundle at a time
await workerPool.process(bundleId, bundleEvents);
```

## Event Processing Rules

### Late Response Handling

**Scenario**: Device sends response after bundle timeout
```
Timeline:
10:00 - Bundle starts, devices begin processing
10:10 - 10-minute timeout hits, bundle marked as TIMEOUT_PENDING
10:11 - Device finally responds with COMPLETED status
10:12 - Another device responds with FAILED status
```

**Processing Rules**:
1. **ACTIVE**: Always process events
2. **TIMEOUT_PENDING**: Process events within grace period (default: 2 hours)
3. **COMPLETED/FAILED/CANCELLED**: No longer accept events

### Grace Period Management

```typescript
async function shouldProcessEvent(event: ClickHouseEvent): Promise<boolean> {
  const bundleState = await stateManager.getBundleState(event.bundleId);
  
  if (!bundleState) return false;
  
  switch (bundleState.state) {
    case 'ACTIVE':
      return true;
      
    case 'TIMEOUT_PENDING':
      if (!bundleState.timeoutAt) return false;
      
      const gracePeriodEnd = new Date(bundleState.timeoutAt.getTime() + 
        bundleState.gracePeriodHours * 60 * 60 * 1000);
      
      return new Date(event.ts) <= gracePeriodEnd;
      
    default:
      return false;
  }
}
```

## Database Optimizations

### ClickHouse Partitioning
```sql
CREATE TABLE mv_bundle_logs (
  deviceId String,
  waveId String,
  bundleId String,
  status String,
  progress String,
  message String,
  ts DateTime,
  type String,
  -- Add indexes for efficient filtering
  INDEX idx_bundle_status (bundleId, status) TYPE minmax GRANULARITY 1,
  INDEX idx_device_bundle (deviceId, bundleId) TYPE minmax GRANULARITY 1
) 
ENGINE = MergeTree()
PARTITION BY (toYYYYMM(ts), bundleId)  -- Partition by month + bundle
ORDER BY (bundleId, deviceId, ts)
TTL ts + INTERVAL 30 DAY;
```

### PostgreSQL Optimizations
```sql
-- Add indexes for fast lookups
CREATE INDEX idx_bundle_device_progress_bundle_wave 
ON bundle_device_progress(bundleId, waveId);

CREATE INDEX idx_bundle_device_progress_device_bundle 
ON bundle_device_progress(bundleDeviceId, bundleId);

-- Partition large tables
CREATE TABLE bundle_device_progress_partitioned (
  -- same columns
) PARTITION BY HASH (bundleId);
```

## Performance Optimizations

### 1. Caching Strategy
```typescript
// Cache bundle states
const bundleCache = new Map<string, BundleState>();

// Cache device progress
const deviceProgressCache = new Map<string, DeviceProgress>();

// Use Redis for distributed caching (production)
const cacheKey = `bundle:${bundleId}:state`;
const cachedState = await redis.get(cacheKey);
```

### 2. Database Batching
```typescript
// Batch database updates
const updates = events.map(event => ({
  bundleId: event.bundleId,
  deviceId: event.deviceId,
  status: event.status,
  progress: event.progress
}));

await prisma.bundleDeviceProgress.updateMany({
  where: { bundleId: { in: bundleIds } },
  data: updates
});
```

### 3. Event Deduplication
```typescript
// Use Redis for distributed deduplication (production)
const eventKey = `processed:${deviceId}:${waveId}:${bundleId}:${ts}`;
const isProcessed = await redis.exists(eventKey);

if (!isProcessed) {
  await redis.setex(eventKey, 86400, '1'); // 24h TTL
  // Process event
}
```

## Configuration

### Environment Variables
```bash
# State Management
STATE_BACKEND=file  # 'file' | 'redis' | 'database'
BUNDLE_STATE_FILE=./workings/bundle_states.json

# ClickHouse
CLICKHOUSE_URL=jdbc:clickhouse://localhost:8123/fs_04
CLICKHOUSE_USER_NAME=admin
CLICKHOUSE_PASSWORD=admin0823
USE_CLICKHOUSE=true

# Processing
MAX_WORKERS=10
BATCH_SIZE=10000
WINDOW_HOURS=1
GRACE_PERIOD_HOURS=2

# Redis (Production)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password
```

### Processing Configuration
```typescript
const config = {
  // Processing
  maxWorkers: 10,
  batchSize: 10000,
  windowHours: 1,
  gracePeriodHours: 2,
  
  // Database
  maxConnections: 50,
  queryTimeout: 30000,
  
  // Caching
  cacheTTL: 3600,
  maxCacheSize: 100000,
  
  // Monitoring
  metricsInterval: 60000,
  alertThresholds: {
    processingRate: 1000,
    errorRate: 0.01,
    memoryUsage: 0.8
  }
};
```

## Monitoring and Alerting

### Performance Metrics
```typescript
const metrics = {
  eventsProcessedPerSecond: 0,
  averageProcessingTime: 0,
  activeBundles: 0,
  queuedEvents: 0,
  errorRate: 0,
  memoryUsage: 0,
  cacheHitRate: 0
};

// Alert on performance issues
if (metrics.eventsProcessedPerSecond < 1000) {
  alert('Low processing rate detected');
}
```

### Health Checks
```typescript
// Check system health
async function healthCheck() {
  return {
    clickhouse: await testClickHouseConnection(),
    postgresql: await testPostgresConnection(),
    redis: await testRedisConnection(),
    memoryUsage: process.memoryUsage(),
    activeBundles: await getActiveBundleCount(),
    processingRate: getCurrentProcessingRate()
  };
}
```

## Implementation Phases

### Phase 1: State Management
- [ ] Implement file-based state manager
- [ ] Implement Redis state manager
- [ ] Add state transition logic
- [ ] Add grace period management

### Phase 2: Event Processing
- [ ] Implement smart event filtering
- [ ] Add batch processing
- [ ] Add parallel processing
- [ ] Add deduplication

### Phase 3: Performance Optimization
- [ ] Add caching layer
- [ ] Optimize database queries
- [ ] Add monitoring and alerting
- [ ] Add configuration management

### Phase 4: Testing and Deployment
- [ ] Load testing with 100k+ devices
- [ ] Performance benchmarking
- [ ] Production deployment
- [ ] Monitoring setup

## Benefits

1. **Scalable**: Handles 100k+ devices with parallel processing
2. **Efficient**: Only processes active bundles and recent events
3. **Resilient**: Handles late responses and network delays
4. **Monitorable**: Comprehensive metrics and alerting
5. **Configurable**: Easy to tune for different scales
6. **Flexible**: Multiple state management backends
7. **Production Ready**: Redis support for distributed systems

## Edge Cases Handled

1. **Network Delays**: Grace period for late device responses
2. **Clock Skew**: Sliding window approach
3. **Out-of-Order Events**: Event deduplication
4. **Memory Leaks**: Automatic cleanup of old data
5. **Database Timeouts**: Batch processing and retries
6. **Concurrent Processing**: State-based locking
7. **Partial Failures**: Idempotent operations

## Migration Strategy

1. **Phase 1**: Implement alongside existing system
2. **Phase 2**: Gradually migrate bundles to new system
3. **Phase 3**: Monitor performance and adjust
4. **Phase 4**: Full migration and cleanup

This design ensures reliable, scalable processing of bundle installation events while maintaining real-time UI updates and handling all edge cases gracefully.
