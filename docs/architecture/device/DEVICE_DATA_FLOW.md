# Device Data Flow Architecture

## Overview

This document describes the real-time device data flow architecture for handling app data from 100k+ devices using ClickHouse for raw data storage, PostgreSQL for metadata, and Server-Sent Events (SSE) for real-time communication.

> **Related Documentation**: For pin management and hierarchical rules, see [Real-Time App Data Architecture](./REAL_TIME_APP_DATA.md)

## Architecture Flow

```
Device → ClickHouse → SSE Announce → Server pulls data → PostgreSQL + SSE to UI
```

## Components

### 1. Device
- **Purpose**: Source of app data and device information
- **Data**: App lists, installation events, device metadata
- **Communication**: Sends data to ClickHouse via API

### 2. ClickHouse
- **Purpose**: High-volume raw data storage and real-time queries
- **Data**: Raw app lists, device events, time-series data
- **Performance**: Handles 100k+ devices with 50+ apps each

### 3. SSE Announce
- **Purpose**: Real-time notification system
- **Function**: Announces when device data changes
- **Target**: Server processing system

### 4. Server Processing
- **Purpose**: Data processing and business logic
- **Function**: Pulls data from ClickHouse, processes, stores in PostgreSQL
- **Communication**: Sends updates to UI via SSE

### 5. PostgreSQL
- **Purpose**: Metadata storage and relational data
- **Data**: Device relationships, user permissions, processed summaries
- **Performance**: Fast relational queries for UI components

### 6. UI
- **Purpose**: User interface for device management
- **Function**: Displays real-time device data and app information
- **Communication**: Receives updates via SSE

## Detailed Data Flow

### Step 1: Device Uploads Data to ClickHouse
```typescript
// Device sends app data to logs_raw (existing system)
// Data flows: logs_raw → mv_device_apps → device_apps
const deviceData = {
  deviceId: "device-123",
  timestamp: new Date().toISOString(),
  apps: [
    {
      appName: "Cenique Device Manager 2",
      packageName: "com.cenique.cdms2.android.client",
      version: "1.5.1_r",
      type: "System",
      metadata: "{}"
    },
    {
      appName: "QA Screener",
      packageName: "com.inreality.qa.screener", 
      version: "1.6.1_dev.2",
      type: "Normal",
      metadata: "{}"
    }
  ]
};

// Device sends to logs_raw (existing system)
// Materialized view mv_device_apps automatically populates device_apps table
```

### Step 2: ClickHouse Triggers SSE Announcement
```typescript
// After ClickHouse insertion, announce the change
sseService.announce(`device-${deviceId}-apps-changed`, {
  deviceId: "device-123",
  accountId: "account-456",
  timestamp: new Date(),
  action: 'apps_updated',
  appCount: deviceData.apps.length
});
```

### Step 3: Server Processing
```typescript
// Server listens for app data changes
sseService.on('device-123-apps-changed', async (event) => {
  console.log(`Processing app data for device ${event.deviceId}`);
  
  // Pull latest data from ClickHouse (mv_device_apps materialized view)
  const latestApps = await clickhouse.query(`
    SELECT 
      device_id,
      package_name,
      app_name,
      version,
      app_type,
      metadata,
      created_at
    FROM mv_device_apps 
    WHERE device_id = '${event.deviceId}'
    ORDER BY app_name ASC
  `);
  
  // Process and summarize data
  const appSummary = {
    deviceId: event.deviceId,
    totalApps: latestApps.length,
    systemApps: latestApps.filter(app => app.app_type === 'System').length,
    normalApps: latestApps.filter(app => app.app_type === 'Normal').length,
    userApps: latestApps.filter(app => app.app_type === 'User').length,
    lastAppSync: latestApps.max(app => app.created_at),
    processedAt: new Date()
  };
  
  // Update PostgreSQL with processed data
  await prisma.deviceAppSummary.upsert({
    where: { deviceId: event.deviceId },
    data: appSummary
  });
  
  // Broadcast to UI if device detail page is open
  sseService.broadcast(`device-${event.deviceId}-detail`, {
    type: 'apps_updated',
    data: latestApps,
    summary: appSummary,
    timestamp: new Date()
  });
});
```

### Step 4: UI Real-Time Updates
```typescript
// Device detail page listens for updates
sseService.subscribe(`device-${deviceId}-detail`, (update) => {
  if (update.type === 'apps_updated') {
    // Update app list instantly
    updateAppList(update.data);
    
    // Update summary statistics
    updateAppSummary(update.summary);
    
    // Show notification
    showNotification('App list updated', 'success');
    
    // Update last sync timestamp
    updateLastSyncTime(update.timestamp);
    
    // Update device status indicator
    updateDeviceStatus('online', update.timestamp);
  }
});
```

## Database Schemas

### ClickHouse Schema
```sql
-- Simple 2-table setup for device app data
-- 1. device_apps - Main table for storing device app data
-- 2. mv_device_apps - Materialized view that populates device_apps from logs_raw

CREATE TABLE device_apps (
    device_id    String,
    package_name String,
    app_name     LowCardinality(String),
    version      LowCardinality(String),
    app_type     LowCardinality(String),
    metadata     String,
    created_at   DateTime64(3, 'UTC') default now64(3)
)
ENGINE = MergeTree 
ORDER BY (created_at, device_id, package_name)
SETTINGS index_granularity = 8192;

CREATE MATERIALIZED VIEW mv_device_apps
TO device_apps
AS
SELECT c2 AS device_id,
       c3 AS package_name,
       c4 AS app_name,
       c5 AS version,
       c8 AS app_type,
       c9 AS metadata,
       c1 AS created_at
FROM logs_raw
WHERE c10 = 'device_app';
```

### PostgreSQL Schema
```sql
-- Device app summary table
CREATE TABLE device_app_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    total_apps_count INTEGER DEFAULT 0,
    system_apps_count INTEGER DEFAULT 0,
    normal_apps_count INTEGER DEFAULT 0,
    last_app_sync TIMESTAMP WITH TIME ZONE,
    last_processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Processing logs should be stored in ClickHouse or application logs
-- Note: Connection status should be stored in Redis or memory for real-time performance
```

### Alternative Storage Strategies

#### Processing Logs
```typescript
// Option 1: ClickHouse (recommended for analytics)
await clickhouse.insert('device_processing_metrics', {
  device_id: deviceId,
  action: 'apps_processed',
  app_count: latestApps.length,
  processing_time_ms: processingTime,
  timestamp: new Date()
});

// Option 2: Application logs (recommended for debugging)
logger.info('Device processing completed', {
  deviceId,
  appCount: latestApps.length,
  processingTime,
  timestamp: new Date()
});
```

#### Connection Status
```typescript
// Note: Connection status is handled by Pushpin integration
// See: docs/features/PUSHPIN.md for connection management details
```

## Performance Characteristics

### ClickHouse Performance
- **Write Speed**: 50,000+ records/second
- **Query Speed**: < 100ms for device app lists
- **Storage**: Optimized for time-series data
- **Scalability**: Handles 1M+ devices
- **Partitioning**: By month and account for optimal performance

### PostgreSQL Performance
- **Query Speed**: < 50ms for metadata queries
- **ACID Compliance**: Reliable for user data
- **Relationships**: Fast joins for UI components
- **Indexing**: Optimized for device and account lookups

### SSE Performance
- **Latency**: < 200ms for real-time updates
- **Concurrency**: Supports 1000+ concurrent connections
- **Bandwidth**: Efficient binary protocol
- **Reliability**: Automatic reconnection on connection drops

## API Endpoints

### Device Data Management
```typescript
// Get device app data
GET /api/devices/{deviceId}/apps
// Returns: Current app list from ClickHouse

// Get device summary
GET /api/devices/{deviceId}/summary
// Returns: Processed summary from PostgreSQL

// Get device connection status
GET /api/devices/{deviceId}/status
// Returns: Connection and sync status

// Trigger device sync
POST /api/devices/{deviceId}/sync
// Forces device to send latest app data
```

### Real-Time Updates
```typescript
// Subscribe to device updates
GET /api/devices/{deviceId}/events
// Returns: SSE stream of real-time updates

// Subscribe to account updates
GET /api/accounts/{accountId}/events
// Returns: SSE stream for all devices in account
```

## Error Handling

### ClickHouse Errors
```typescript
// Handle ClickHouse connection errors
try {
  await clickhouse.insert('device_apps_raw', data);
} catch (error) {
  logger.error('ClickHouse insert failed', { error, deviceId });
  // Queue for retry
  await queueForRetry('clickhouse_insert', data);
}
```

### SSE Connection Errors
```typescript
// Handle SSE connection drops
sseService.on('connection_error', (error) => {
  logger.error('SSE connection error', { error });
  // Implement reconnection logic
  setTimeout(() => {
    sseService.reconnect();
  }, 5000);
});
```

### PostgreSQL Errors
```typescript
// Handle PostgreSQL errors
try {
  await prisma.deviceAppSummary.upsert(data);
} catch (error) {
  logger.error('PostgreSQL update failed', { error, deviceId });
  // Fallback to file-based storage
  await fallbackToFile(data);
}
```

## Monitoring and Metrics

### Key Metrics
- **Data Ingestion Rate**: Apps per second from devices
- **ClickHouse Query Performance**: Response times for app queries
- **PostgreSQL Update Performance**: Summary update times
- **SSE Latency**: Time from device update to UI update
- **Error Rates**: Failed insertions, connection drops

### Health Checks
```typescript
async function healthCheck() {
  return {
    clickhouse: await testClickHouseConnection(),
    postgresql: await testPostgresConnection(),
    sse: await testSSEConnection(),
    dataIngestionRate: await getDataIngestionRate(),
    activeConnections: await getActiveSSEConnections(),
    processingQueue: await getProcessingQueueSize()
  };
}
```

## Configuration

### Environment Variables
```bash
# ClickHouse Configuration
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER_NAME=admin
CLICKHOUSE_PASSWORD=admin0823
CLICKHOUSE_DATABASE=fs_04

# PostgreSQL Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/fs04_web

# Processing Configuration
PROCESSING_BATCH_SIZE=1000
PROCESSING_INTERVAL_MS=5000
MAX_RETRY_ATTEMPTS=3
```

## Benefits

### Real-Time Performance
- **Instant Updates**: < 200ms latency from device to UI
- **High Throughput**: 50k+ writes/second to ClickHouse
- **Fast Queries**: < 100ms response times
- **Scalable**: Handles 100k+ devices simultaneously

### Data Consistency
- **ClickHouse**: Source of truth for raw app data
- **PostgreSQL**: Reliable metadata and relationships
- **SSE**: Ensures UI stays in sync with data changes

### Cost Efficiency
- **ClickHouse**: 10x cheaper than PostgreSQL for this volume
- **PostgreSQL**: Only stores essential metadata
- **SSE**: Efficient real-time communication

### User Experience
- **Live Updates**: No page refresh needed
- **Real-Time Indicators**: Connection status, last sync time
- **Responsive UI**: Smooth app management experience

## Troubleshooting

### Common Issues
1. **ClickHouse Connection Drops**: Implement retry logic and connection pooling
2. **SSE Connection Drops**: Implement reconnection logic with exponential backoff
3. **PostgreSQL Timeouts**: Optimize queries and add proper indexing
4. **Data Sync Delays**: Check processing queue and batch sizes
5. **UI Not Updating**: Verify SSE subscription and event handling

### Debug Tools
- ClickHouse query logs and performance metrics
- SSE connection monitoring and reconnection logs
- PostgreSQL query performance and slow query logs
- UI component state inspection and event logs

## Implementation Checklist

### Phase 1: Infrastructure Setup
- [ ] Deploy ClickHouse instance
- [ ] Configure PostgreSQL database
- [ ] Set up SSE server
- [ ] Create database schemas

### Phase 2: Data Ingestion
- [ ] Implement device data upload API
- [ ] Create ClickHouse insertion logic
- [ ] Add data validation and error handling
- [ ] Set up monitoring and logging

### Phase 3: Real-Time Processing
- [ ] Implement SSE announcement system
- [ ] Create server processing logic
- [ ] Add PostgreSQL update mechanisms
- [ ] Set up error handling and retries

### Phase 4: UI Integration
- [ ] Build real-time app list component
- [ ] Implement SSE subscription logic
- [ ] Add connection status indicators
- [ ] Create error handling and user feedback

### Phase 5: Monitoring & Optimization
- [ ] Add performance metrics
- [ ] Implement health checks
- [ ] Set up alerting
- [ ] Optimize query performance
