# Sensor Configuration Architecture

Manage sensor configuration with **offline-first save** and **on-demand push** to controllers.

---

## Design Principle

> [!IMPORTANT]
> **Save** and **Push** are separate operations:
> - **Save**: Always works, stores config in database
> - **Push**: Only works when device is online, syncs config to controller

This allows users to edit configuration anytime, even when devices are offline.

---

## Flow Overview

### Save Config (Offline-Safe)

```mermaid
sequenceDiagram
    autonumber
    participant U as Web UI
    participant W as Worker
    participant D as Database

    U->>W: RPC sensor.config.save
    W->>D: Validate & save config
    W->>D: Mark as "pending sync"
    W->>U: Response { saved: true, synced: false }
```

### Push Config to Device

```mermaid
sequenceDiagram
    autonumber
    participant U as Web UI
    participant W as Worker
    participant D as Database
    participant C as Controller

    U->>W: RPC sensor.config.push
    W->>D: Load pending config
    W->>C: Notification { ticket, config }
    C->>C: Apply config
    C->>W: Reply { applied: true }
    W->>D: Mark as "synced"
    W->>U: Response { synced: true }
```

### Auto-Sync on Device Connect (Optional)

```mermaid
sequenceDiagram
    participant C as Controller
    participant W as Worker
    participant D as Database

    C->>W: Connected event
    W->>D: Check for pending configs
    W->>C: Notification { ticket, config }
    C->>W: Reply { applied: true }
    W->>D: Mark as "synced"
```

---

## Config States

| State | DB Field | Meaning |
|-------|----------|---------|
| `SYNCED` | `syncStatus` | Config matches what's on device |
| `PENDING` | `syncStatus` | Config saved but not pushed to device |
| `FAILED` | `syncStatus` | Push attempted but failed (device error) |

---

## Message Formats

### Web → Worker (RPC)
```json
{
    "op": "sensor.config.push",
    "params": { "sensorId": "sen_xxx" },
    "requestId": "uuid",
    "timestamp": "ISO8601"
}
```

### Worker → Controller (Notification)
The `config.update` notification signals the device to re-fetch config via API.
Device should call the same config endpoint used during initial boot (e.g., `/api/controllers/{id}/radar.json`).

```json
{
    "ticket": "JWT containing config.update notification"
}
```

**JWT Ticket Payload:**
```json
{
    "type": "config.update",
    "recipient": "device:<did>/controller/radar:<cid>",
    "flowId": "uuid",
    "params": {
        "sensorId": "sen_xxx",
        "configVersion": 5
    }
}
```
> **Note:** `config` is NOT included in the notification. Device fetches full config via existing API endpoint.

---

## Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `user/<sub>/requests` | User → Worker | Save/Push RPC |
| `user/<sub>/response` | Worker → User | RPC response |
| `.../controller/.../notifications` | Worker → Controller | Config push |
| `.../controller/.../replies` | Controller → Worker | Push acknowledgment |

---

## UI States

```mermaid
stateDiagram-v2
    direction LR
    
    [*] --> Editing: User opens config
    Editing --> Saving: Click Save
    Saving --> Pending: Save success
    Pending --> Pushing: Click Push
    Pending --> Editing: Edit more
    Pushing --> Synced: Push success
    Pushing --> Failed: Device offline/error
    Failed --> Pushing: Retry
    Synced --> Editing: Edit more
```

**UI Button States:**

| Device Status | Save Button | Push Button |
|--------------|-------------|-------------|
| Online | ✅ Enabled | ✅ Enabled |
| Offline | ✅ Enabled | ⚠️ Disabled (tooltip: "Device offline") |

**Status Indicators:**
- 🟢 **Synced** - "Config synced with device"
- 🟡 **Pending** - "Changes saved, not pushed yet"
- 🔴 **Failed** - "Push failed, click to retry"

---

## Implementation Checklist

### Worker (Web)

| Item | Status | Notes |
|------|--------|-------|
| `sensor.config.save` RPC | ✅ | [handle_sensor_config.ts](file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/mqtt/handlers/web/handle_sensor_config.ts) |
| `sensor.config.push` RPC | ✅ | Same file |
| Auto-sync on device connect | ⬜ | Listen for connection events |
| Config versioning | ✅ | `configVersion` field in Sensor model |

### Controller (Device)

| Item | Status | Notes |
|------|--------|-------|
| Handle `config.update` notification | ✅ | Already in radar.ts |
| Version acknowledgment | ⬜ | Include configVersion in reply |

### User (Browser)

| Item | Status | Notes |
|------|--------|-------|
| Save button → `sensor.config.save` | ⬜ | Always enabled |
| Push button → `sensor.config.push` | ⬜ | Enabled when online |
| Sync status indicator | ⬜ | Show SYNCED/PENDING/FAILED |
| Auto-push toggle | ⬜ | Push automatically on save |

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Save while offline | Always succeeds (DB only) |
| Push while offline | Returns `DEVICE_OFFLINE` error |
| Push fails | Mark as `FAILED`, allow retry |
| Device connects | Auto-push pending configs (if enabled) |

---

## See Also

- [SENSOR_PREVIEW.md](./SENSOR_PREVIEW.md) - Live data streaming
- [RADAR.md](./RADAR.md) - Radar config schema
