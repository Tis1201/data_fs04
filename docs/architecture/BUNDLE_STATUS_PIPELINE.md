# Bundle Status Pipeline

**Last updated: 2025-01-26 – Modular architecture with batch processing**

## Overview
This document explains how bundle installation progress flows from devices to the UI using a modular scheduler architecture with batch processing for optimal performance.

## Pipeline Architecture

### Modular Architecture
The system uses specialized modules for optimal performance:

- **`bundleStatusScheduler.ts`** - Main coordinator for all bundle processing
- **`bundleEventProcessor.ts`** - Batch event processing (500x faster than individual processing)
- **`bundleTimeoutManager.ts`** - Timeout handling for stalled devices
- **`bundleCleanupManager.ts`** - Redis cleanup for completed bundles
- **`fileBasedPoller.ts`** - File-based polling for local development
- **`fileStatusPoller.ts`** - Legacy compatibility layer

### Processing Flow
- Source of truth
  - ClickHouse (production) or file simulation (development) stores progress events
- Modular Scheduler (server-side, every 10 seconds)
  - **Main Coordinator**: `bundleStatusScheduler.ts`
    - Manages state initialization and cleanup
    - Coordinates between modules
    - Handles ClickHouse vs file-based mode switching
  - **Event Processor**: `bundleEventProcessor.ts`
    - Groups events by bundleId for batch processing
    - Groups events by deviceId within each bundle
    - Batch database operations (500x faster than individual processing)
    - Correlates by: `waveId`, `bundleId`, `deviceId`
    - Resolves `bundleDeviceId` via `(bundleId, deviceId)` (schema unique)
    - Batch upserts `BundleDeviceProgress` keyed by `(waveId, bundleDeviceId)`
      - Fields updated: `status`, `result`, `errorDetails`, `startedAt`/`completedAt`, `metadata` (JSON: `{ progress }`), audit fields
  - **Timeout Manager**: `bundleTimeoutManager.ts`
    - Handles timeout logic for stalled devices
    - Marks devices as FAILED after timeout
  - **Cleanup Manager**: `bundleCleanupManager.ts`
    - Cleans up completed bundles from Redis after 24 hours
    - Prevents memory bloat
  - **Wave Recompute**: `bundleEventProcessor.ts`
    - Recomputes `BundleWave` (aggregate counts + computed progress)
    - Updates: `status`, `endTime` only (no numeric `progress` column on wave)
  - **SSE Publishing**: `bundleEventProcessor.ts`
    - Publishes SSE:
      - `subscription:bundle:wave:<waveId>` (wave-level)
      - `subscription:bundle:<bundleId>` (bundle detail pages subscribe here)
- UI
  - Already subscribes at bundle scope; receives live updates
  - On refresh, loader computes wave progress from `BundleDeviceProgress.metadata.progress`

---

## File-backed Simulation (Temporary)
- Event file (JSON Lines):
  - Default: `/Users/macos/Desktop/out/fs04_device/workings/bundle_status.log`
  - One JSON object per line:
```json
{
  "deviceId": "<deviceId>",
  "waveId": "wave:<waveId>",
  "bundleId": "<bundleId>",
  "status": "IN_PROGRESS",
  "progress": 60,
  "message": "Installing...",
  "timestamp": "2025-09-24T21:12:00Z"
}
```
- Offsets:
  - Default: `/Users/macos/Desktop/out/fs04_web/workings/bundle_status.offset`
- Poll interval:
  - `FILE_STATUS_POLL_MS` (default `60000`)
- Env overrides:
  - `FILE_STATUS_LOG`, `FILE_STATUS_OFFSET`, `FILE_STATUS_POLL_MS`

### Simulator script
- Single event:
```bash
node scripts/simulate_bundle_progress.cjs \
  --deviceId <deviceId> \
  --waveId wave:<waveId> \
  --bundleId <bundleId> \
  --status IN_PROGRESS --progress 10 --message "Downloading..."
```
- Demo sequence (10% → 60% → 100%):
```bash
node scripts/simulate_bundle_progress.cjs --demo \
  --deviceId <deviceId> --waveId wave:<waveId> --bundleId <bundleId> --delayMs 500
```

---

## Schema Mapping (Key Models)
- `BundleDevice` (unique on `[bundleId, deviceId]`) → resolved to `bundleDeviceId`
- `BundleDeviceProgress` (per device per wave)
  - Keys: `waveId`, `bundleDeviceId`
  - `status`: `PENDING | IN_PROGRESS | COMPLETED | FAILED | CANCELLED`
  - `metadata`: JSON string with `{ progress: number }`
  - `result`/`errorDetails`: message fields
  - Timestamps: `startedAt`, `completedAt`
- `BundleWave`
  - Aggregate counts computed from child progress rows
  - Updated fields: `status`, `endTime`

---

## SSE Scopes
- Wave-level: `subscription:bundle:wave:<waveId>`
- Bundle-level: `subscription:bundle:<bundleId>` (bundle detail pages subscribe here)

---

## Server Integration
- Startup: `src/hooks.server.ts`
  - Starts file status poller (`startFileStatusPoller()`)
  - Existing schedulers (e.g., auto-publish) kept intact
- Poller: `src/lib/server/scheduler/fileStatusPoller.ts`
  - Robust logging (reads, offsets, upserts, aggregate, SSE)
  - Safe handling for truncation/rotation and missing rows

---

## UI Integration
- Bundle detail page: `src/routes/admin/iot/bundles/[id]/+page.svelte`
  - Subscribes to bundle scope; invalidates when wave/bundle changes
  - Uses derived waves from server data and live SSE stats
- Server loader: `+page.server.ts`
  - Computes wave progress from `BundleDeviceProgress.metadata.progress`
  - Falls back to `completed/total` if no metadata present

---

## SSE Event Names and Subscriptions
- Bundle detail pages listen to:
  - `bundle:waveStatus` (recommended direct handler)
  - Wildcard `*` if you fan in multiple events
- Subscribe to `subscription:bundle:<bundleId>` on connect (and immediately if a connectionId already exists) so wave events reach the page reliably.

---

## Troubleshooting
- No live UI update
  - Check poller logs for publishes and subscribers
  - Ensure bundle-level scope is published (done by poller)
  - Ensure the client subscribes to `bundle:waveStatus` directly or via `*`, and that the subscribe call is executed after a valid connectionId (or immediately if already present)
- No progress after refresh
  - Confirm `BundleDeviceProgress.metadata` contains `{ progress }`
  - Loader now reads from metadata; verify DB has rows for the wave
- Wrong correlation
  - Use the exact `waveId` from dispatch (keep the `wave:` prefix in file; poller trims it transparently)
  - Ensure `bundleId` and `deviceId` match a row in `BundleDevice`
- Poller not reading new lines
  - Remove offset file; shorten `FILE_STATUS_POLL_MS`; restart server

---

## Future Switch to ClickHouse
- Replace file reader with CH query using a watermark
- Keep the same mapping/upsert/SSE publish logic
- Maintain identical event schema (deviceId, waveId, bundleId, status, progress, message, timestamp)

---

## Setup Checklist (to ensure pages work after enabling poller)
1. Environment
   - Ensure these envs are set (or defaults are acceptable):
     - `FILE_STATUS_LOG` → path to JSONL events file
     - `FILE_STATUS_OFFSET` → path to offset file (writable)
     - `FILE_STATUS_POLL_MS` → polling interval in ms (e.g., `60000`)
2. Server startup
   - `src/hooks.server.ts` includes `startFileStatusPoller()` in the non-building branch.
   - Check server logs for: `File status poller started`.
3. Database mapping
   - There exists a `BundleDevice` row for each `(bundleId, deviceId)` pair you will emit.
   - `BundleDeviceProgress` will be upserted by the poller with `{ waveId, bundleDeviceId }`.
4. UI loader
   - `src/routes/admin/iot/bundles/[id]/+page.server.ts` computes wave progress by averaging `metadata.progress` from `BundleDeviceProgress` for that `waveId`.
   - Pages do not rely on a non-existent `bundleWave.progress` field.
5. SSE subscriptions
   - Bundle detail page subscribes to `subscription:bundle:<bundleId>`.
   - Poller publishes to both `subscription:bundle:wave:<waveId>` and `subscription:bundle:<bundleId>`.
6. Simulation (optional)
   - Use `scripts/simulate_bundle_progress.cjs` to write events and observe updates.
   - Verify poller logs show event processed, upserted ID, aggregate computed, and SSE published.

---

## UI Requirements (progress rendering)
- For each `BundleDeviceProgress` row:
  - If `status === 'COMPLETED'`: render `100%`.
  - If `status === 'FAILED'`: render last known `metadata.progress` (e.g., `10%`) and show `errorDetails`.
  - Else (`IN_PROGRESS`): render live `metadata.progress`.
- Wave aggregate progress shown as the rounded average of all devices with a numeric `metadata.progress`.

---

## Common Pitfalls
- Publishing only to wave scope
  - Ensure the poller also publishes to `subscription:bundle:<bundleId>` so bundle detail pages receive updates.
- Filtering by wrong fields
  - Do not filter `BundleDeviceProgress` by `deviceId`. Resolve `bundleDeviceId` from `(bundleId, deviceId)` first.
- Missing progress on refresh
  - Ensure `metadata` contains a numeric `progress` value and is valid JSON.
- Wave `progress` field on model
  - The schema does not include a numeric wave progress column; compute on the fly in the loader.
