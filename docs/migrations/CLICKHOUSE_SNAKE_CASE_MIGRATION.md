# ClickHouse Snake Case Migration

**Date: 2025-01-26**

This document describes the migration from camelCase to snake_case column names in the ClickHouse bundle logs schema.

## Overview

The ClickHouse bundle logs table has been updated to use snake_case column names for better consistency with database naming conventions:

### Old Schema (camelCase)
```sql
CREATE TABLE bundle_logs (
    deviceId String,
    waveId String,
    bundleId String,
    status String,
    progress String,
    message String,
    ts DateTime,
    type String
)
```

### New Schema (snake_case)
```sql
CREATE TABLE bundle_logs (
    device_id  String,
    wave_id    String,
    bundle_id  String,
    status     LowCardinality(String),
    progress   Int32,
    message    String,
    ts         DateTime64(3, 'UTC'),
    type       LowCardinality(String),
    event_id   String DEFAULT concat(device_id, ':', wave_id, ':', bundle_id, ':', toString(ts))
)
```

## Changes Made

### 1. Schema Files
- **Created**: `src/lib/server/clickhouse/bundleLogsSchema.sql` - New schema with snake_case columns
- **Updated**: Documentation files to reflect new column names

### 2. TypeScript Interfaces
- **Updated**: `src/lib/server/clickhouse/client.ts`
  - `ClickHouseEvent` type now uses snake_case properties
  - `progress` field changed from `string` to `number`
  - Added `event_id` field

### 3. Query Updates
- **Updated**: All ClickHouse queries to use snake_case column names
- **Updated**: `queryClickHouseEvents()` function in `client.ts`
- **Updated**: Test scripts to use new column names

### 4. Event Processing
- **Updated**: `src/lib/server/scheduler/bundleEventProcessor.ts`
  - Event mapping from ClickHouse to internal format
  - All references to ClickHouse event properties

### 5. Documentation
- **Updated**: `docs/architecture/SCALABLE_EVENT_PROCESSING.md`
- **Updated**: `docs/performance/README.md`
- **Updated**: All references to ClickHouse column names

## Migration Scripts

### 1. Test New Schema
```bash
node scripts/test_snake_case_schema.cjs
```

### 2. Migrate Existing Data
```bash
node scripts/migrate_to_snake_case.cjs
```

### 3. Test ClickHouse Connection
```bash
node scripts/test_clickhouse.cjs
```

## Migration Steps

### For New Installations
1. Run the new schema creation script:
   ```sql
   -- Execute the contents of src/lib/server/clickhouse/bundleLogsSchema.sql
   ```

### For Existing Installations
1. **Backup your data** (recommended)
2. Run the migration script:
   ```bash
   node scripts/migrate_to_snake_case.cjs
   ```
3. Test the new schema:
   ```bash
   node scripts/test_snake_case_schema.cjs
   ```
4. Update your application code to use the new column names
5. Once confirmed working, clean up old tables:
   ```sql
   DROP TABLE bundle_logs;
   DROP TABLE mv_bundle_logs;
   RENAME TABLE bundle_logs_new TO bundle_logs;
   RENAME TABLE mv_bundle_logs_new TO mv_bundle_logs;
   ```

## Breaking Changes

### Column Name Changes
- `deviceId` → `device_id`
- `waveId` → `wave_id`
- `bundleId` → `bundle_id`
- `progress` type changed from `String` to `Int32`

### New Fields
- `event_id` - Auto-generated unique identifier for deduplication

### Data Type Improvements
- `status` and `type` now use `LowCardinality(String)` for better performance
- `ts` now uses `DateTime64(3, 'UTC')` for better precision
- `progress` is now a proper integer instead of string

## Performance Improvements

1. **Better Compression**: `LowCardinality(String)` for status and type fields
2. **Faster Queries**: Proper integer type for progress field
3. **Better Indexing**: Optimized indexes for snake_case column names
4. **Deduplication**: Built-in event_id generation for better event deduplication

## Backward Compatibility

The application code maintains backward compatibility by:
- Converting ClickHouse snake_case data to camelCase for internal processing
- Maintaining the same API interfaces
- File-based polling continues to use camelCase JSON format

## Testing

After migration, verify:
1. ClickHouse queries work with new column names
2. Event processing continues to work correctly
3. UI updates are received properly
4. No data loss during migration

## Rollback Plan

If issues occur:
1. Restore from backup tables (`bundle_logs_backup`)
2. Revert code changes
3. Use old schema until issues are resolved

## Files Modified

- `src/lib/server/clickhouse/client.ts`
- `src/lib/server/scheduler/bundleEventProcessor.ts`
- `scripts/test_clickhouse.cjs`
- `docs/architecture/SCALABLE_EVENT_PROCESSING.md`
- `docs/performance/README.md`
- `src/lib/server/clickhouse/bundleLogsSchema.sql` (new)
- `scripts/test_snake_case_schema.cjs` (new)
- `scripts/migrate_to_snake_case.cjs` (new)
