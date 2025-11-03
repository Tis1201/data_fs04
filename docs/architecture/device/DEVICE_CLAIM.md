# Device Claim Processes

## Overview

The system supports two device claiming methods:
1. **PIN-based claim**: Manual user-initiated claiming using a 6-digit PIN
2. **Preclaim-based claim**: Automatic claiming using pre-uploaded MAC addresses

## 1) PIN-based Claim (Manual)

```

#### Re-preclaim Policy (History Preserved)

- If a previous preclaim row is `FULFILLED` but its associated device no longer exists, new uploads may include the same `macId` again.
- Validation allows these rows to be created without deleting historical preclaim data.
- This enables reclaiming hardware after device deletion while retaining audit history.
Device Registration Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Device    │    │   Server    │    │    User     │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       │ SSE /api/device/register           │
       │ Headers: X-Device-PIN, X-Device-MAC │
       │ Authorization: Factory-JWT          │
       ├─────────────────►│                  │
       │                  │ Authenticate Factory JWT
       │                  │ Check if MAC already claimed
       │                  │ Check for preclaim match
       │                  │◄─────────────────┤
       │ SSE connection established          │
       │◄─────────────────│                  │
       │                  │                  │
       │         ┌────────┴────────┐         │
       │         │ Preclaim exists? │         │
       │         └────────┬────────┘         │
       │                  │                  │
       │            ┌─────┴─────┐            │
       │            │    YES    │            │
       │            └─────┬─────┘            │
       │                  │                  │
       │    Auto-claim device:               │
       │    • Update Device.macAddress/wifiMac
       │    • Set PreclaimDevice.status=FULFILLED
       │    • Set claimedAt, claimedBy, deviceId
       │                  │                  │
       │    Send "registered" message with apiKey
       │◄─────────────────│                  │
       │                  │                  │
       │            ┌─────┴─────┐            │
       │            │    NO     │            │
       │            └─────┬─────┘            │
       │                  │                  │
       │                  │   Wait for manual claim
       │                  │◄─────────────────┤
       │       Submit PIN via WebSocket/SSE  │
       │                  ├─────────────────►│
       │                  │ DeviceManager.claimDevice()
       │                  │ Send "registered" message
       │◄─────────────────│                  │
       │                  │                  │
       │ POST /api/device/add with system info
       ├─────────────────►│                  │
       │                  │                  │
       │ Connect to /api/device/listen with apiKey
       ├─────────────────►│                  │
       │                  │                  │
```

**Flow Details:**
- Device generates 6-digit PIN and connects to `/api/device/register` with headers:
    - `X-Device-PIN`: Generated PIN
    - `X-Device-MAC`: Device MAC address
    - `Authorization`: Factory JWT token
- Server authenticates Factory JWT and checks if MAC already claimed
- Server checks for active preclaim matching the MAC
- **If preclaim exists**: Automatically claims device and updates:
    - `Device.macAddress` and `Device.wifiMac` from header
    - `PreclaimDevice.status = FULFILLED`, `claimedAt`, `claimedBy`, `deviceId`
- **If no preclaim**: Waits for user to manually enter PIN via web UI
- Device receives "registered" message with `apiKey` and switches to API key auth

## 2) Preclaim-based Claim (Automatic)

```
Admin Upload Process:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Admin     │    │   Server    │    │   Device    │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       │ Upload CSV with MAC addresses       │
       │ Create PreclaimSet & PreclaimDevice │
       ├─────────────────►│                  │
       │                  │ Store PENDING preclaims
       │                  │ with normalized MACs     │
       │                  │◄─────────────────┤
       │                  │                  │
       │                  │                  │
       │         ┌────────┴────────┐         │
       │         │ Device registration      │
       │         │ (same as PIN flow)       │
       │         └────────┬────────┘         │
       │                  │                  │
       │                  │ SSE /api/device/register
       │                  │ Headers: X-Device-PIN, X-Device-MAC, Factory-JWT
       │                  │◄─────────────────┤
       │                  │                  │
       │         ┌────────┴────────┐         │
       │         │ Check for preclaim       │
       │         │ matching MAC             │
       │         └────────┬────────┘         │
       │                  │                  │
       │            ┌─────┴─────┐            │
       │            │ Preclaim  │            │
       │            │ found     │            │
       │            └─────┬─────┘            │
       │                  │                  │
       │    Auto-claim device:               │
       │    • Update Device.macAddress/wifiMac
       │    • Set PreclaimDevice.status=FULFILLED
       │    • Set claimedAt, claimedBy, deviceId
       │                  │                  │
       │    Send "registered" message with apiKey
       │◄─────────────────│                  │
       │                  │                  │
       │            ┌─────┴─────┐            │
       │            │ No preclaim │          │
       │            └─────┬─────┘            │
       │                  │                  │
       │                  │ Fall back to manual
       │                  │ PIN claim        │
       │                  │◄─────────────────┤
```

### Data Model (Current Implementation)

**PreclaimSet** (`schema.zmodel`):
- `id`, `name`, `description`, `accountId`, `status` (ACTIVE/INACTIVE)
- `expiresAt?`, `createdAt`, `updatedAt`, `createdBy`
- Constraints: `unique([accountId, name])`

**PreclaimDevice** (`schema.zmodel`):
- `id`, `setId`, `accountId`, `macId` (normalized MAC)
- `name?`, `description?`, `status` (PENDING/FULFILLED/EXPIRED)
- `expiresAt?`, `claimedAt?`, `claimedBy?`, `deviceId?`
- `createdAt`, `updatedAt`
- Constraints: `unique([setId, macId])`

### Current Implementation Status

✅ **Implemented:**
- Preclaim detection during device registration (`/api/device/register`)
- Automatic claiming when preclaim matches device MAC
- MAC address persistence to `Device.macAddress` and `Device.wifiMac`
- PreclaimDevice status updates (`FULFILLED`, `claimedAt`, `claimedBy`, `deviceId`)
- Account ID validation fix in SSE handler

🚧 **Pending:**
- Admin UI for preclaim upload/management
- CSV upload functionality
- Preclaim expiry handling

## Technical Implementation Details

### Key Files Modified

**Registration Handler** (`/api/device/register/+server.ts`):
- Added MAC address storage during authentication: `(locals as any).deviceMac = mac`
- Added Device MAC field updates: `Device.macAddress` and `Device.wifiMac`
- Added PreclaimDevice status updates: `status: ClaimStatus.FULFILLED`, `claimedAt`, `claimedBy`, `deviceId`
- Uses `locals.prisma` for database access (project convention)

**SSE Handler** (`/api/sse/+server.ts`):
- Fixed account ID bug: `accountId: currentAccount?.accountId` (was `currentAccount?.id`)
- Ensures correct account validation in device claim flow

**Preclaim Detection** (`devicePreclaim.ts`):
- Checks for active, unexpired preclaims matching device MAC
- Integrated into registration authentication flow

### Auth Headers & Endpoints

| Header | Endpoint | Purpose |
|--------|----------|---------|
| `X-Device-PIN` | `/api/device/register` (SSE) | 6-digit PIN for manual claim |
| `X-Device-MAC` | `/api/device/register` (SSE) | Device MAC for preclaim matching |
| `Authorization: Bearer <factory-jwt>` | `/api/device/register` (SSE) | Factory authentication |
| `X-API-Key` | All device APIs | Post-registration authentication |

### Claim Status Check API (Device → Server)

Devices need a simple way to verify whether they are still claimed/active. Provide a lightweight endpoint authenticated with the device's `X-API-Key`.

Endpoint:
```
GET /api/device/claim/status
Headers:
  X-API-Key: <device_api_key>
```

Response (claimed/active):
```json
{
  "success": true,
  "data": {
    "claimed": true,
    "deviceId": "<uuid>",
    "accountId": "<uuid>",
    "status": "ACTIVE"
  }
}
```

Response (not claimed or deleted):
```json
{
  "success": true,
  "data": {
    "claimed": false,
    "status": "NOT_FOUND"
  }
}
```

Behavior:
- Auth via `X-API-Key` only (no user session required).
- Returns `claimed=false` when the backing `Device` record no longer exists or is not active.
- Devices can poll this on boot or on error to decide whether to switch to register mode.

### Device Removal Notification (Server → Device)

When a device is deleted by a user/admin, proactively notify the device so it can immediately switch to registration mode (no need to wait for polling).

SSE message (Pushpin/SSE):
```json
{
  "type": "device:unclaimed",
  "action": "unclaimed",
  "deviceId": "<uuid>",
  "payload": {
    "reason": "deleted",
    "timestamp": "2025-01-12T03:47:56Z"
  }
}
```

Device handling:
- On `device:unclaimed`, immediately clear local API key and cached metadata.
- Transition to register flow: connect to `/api/device/register` (factory token + PIN).
- Optionally call `GET /api/device/claim/status` to confirm state before switching.

### Database Schema

```sql
-- Preclaim management
model PreclaimSet {
  status      SetStatus @default(ACTIVE)  -- ACTIVE/INACTIVE
  expiresAt   DateTime?
  claims      PreclaimDevice[]
}

model PreclaimDevice {
  macId       String       -- normalized MAC (uppercase, no separators)
  status      ClaimStatus  -- PENDING/FULFILLED/EXPIRED
  claimedAt   DateTime?
  claimedBy   String?      -- User ID who claimed
  deviceId    String?      -- Linked device when fulfilled
  device      Device?      @relation(fields: [deviceId], references: [id])
}

-- Device with MAC fields
model Device {
  macAddress    String?    -- Primary MAC from X-Device-MAC header
  wifiMac       String?    -- WiFi MAC (same as macAddress currently)
  claimedAt     DateTime?
  claimedBy     String?    -- User ID who claimed
}
```


## Implementation Checklist

- [Data model] [schema.zmodel](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/schema.zmodel:0:0-0:0)
    - Add models: `DeviceClaimSet`, `DeviceClaim`
    - Add enums: `ClaimStatus { PENDING, FULFILLED, EXPIRED, REVOKED }`, `SetStatus { ACTIVE, INACTIVE }`
    - Constraints: unique `(setId, macId)`; indexes on `macId`, `status`, `expiresAt`
    - RLS (Zenstack): restrict read to account members; only admins/creator mutate; prevent edits to `macId/accountId/setId` when `status = FULFILLED`

- [Admin action: upload + list] `src/routes/admin/devices/preclaim/+page.server.ts`
    - Guard: [restrict](cci:1://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/security/guards.ts:42:0-75:1) and ensure user is admin of the target `accountId`
    - Parse CSV (columns: `macId,name,description,expiresAt?`)
    - Validate with Zod; normalize MACs (uppercase, strip non-hex); dedupe
    - Transaction:
        - Ensure/create ACTIVE `DeviceClaimSet` for the account
        - Bulk insert PENDING `DeviceClaim` rows; reject duplicates across ACTIVE sets for same account
    - Return rollups per set (see “Set‑Level Rollups”)

- [Admin page UI] `src/routes/admin/devices/preclaim/+page.svelte`
    - Use existing form components under `src/lib/components/ui_components_sveltekit/form`
    - Use `sveltekit-superforms` for Zod schema binding
    - Display rollups: total, claimed, outstanding, expired, revoked, expiring soon, days to expiry
    - No visual redesign; reuse existing admin layout

- [Factory guard] [src/lib/server/security/guards.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/security/guards.ts:0:0-0:0)
    - Add `restrict_device_factory()` to validate `X-Factory-Token`
    - Helper in [src/lib/server/device/deviceAuth.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceAuth.ts:0:0-0:0) to verify factory token source and scope

- [DeviceManager] [src/lib/server/device/deviceManager.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceManager.ts:0:0-0:0)
    - Add `tryPreclaimByMac(macs: string[], ctx)`:
        - Normalize MACs; find PENDING `DeviceClaim` where effective expiry not passed and set is ACTIVE
        - In a transaction: mark row FULFILLED, upsert/link [Device](cci:2://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/stores/device-store.ts:27:0-37:1) to `accountId`, issue `apiKey`, publish sudo “registered”
        - Concurrency: update with `WHERE id=? AND status='PENDING'` (optionally `version` for OCC)
    - On PIN-claim success, revoke overlapping PENDING pre-claims for any of the device’s MACs

- [Registration endpoint hook] [src/routes/api/device/add/+server.ts](cci:7://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/routes/api/device/add/+server.ts:0:0-0:0)
    - If `X-Factory-Token` present:
        - Invoke `restrict_device_factory()`
        - Extract all MACs from payload; call `DeviceManager.tryPreclaimByMac()`
        - If SSE register connection exists, deliver “registered” via sudo message; else include `apiKey/deviceId` once in the HTTP response
    - If no factory token: keep current behavior (PIN path and API-key path unchanged)

- [PIN flow hardening] (optional)
    - Add PIN expiry in [registerDevice](cci:1://file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/device/deviceManager.ts:27:4-56:5) store and remove on claim/timeout
    - Structured logs around invalid/expired PINs

- [Expiry handling]
    - Lazy expiry: treat rows as expired when effective expiry <= now
    - Optional background task to mark `EXPIRED` for reporting

- [Observability]
    - Logs: upload results, match, fulfill, revoke, conflicts
    - Metrics (optional): `preclaim_rows_total`, `preclaim_fulfilled_total`, `preclaim_conflicts_total`, `preclaim_expired_total`

- [Tests]
    - Unit: MAC normalization, duplicate rejection, status transitions, RLS
    - Integration:
        - Pre-claim upload → auto-claim with factory token → device receives API key
        - Conflict: PIN claim before auto-claim revokes pending row
        - Expiry: pending row past expiry does not match
