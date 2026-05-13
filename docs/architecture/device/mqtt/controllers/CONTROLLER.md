## Controller MQTT Architecture

This document describes how **Controller Apps** (e.g., Radar App, Camera App) connect to FS04 over MQTT.

---

## 1. Relationship Hierarchy

The following diagram illustrates the relationship between the Device, Controller Apps, and the Sensors they manage.

```mermaid
graph TD
    subgraph "Device Scope (device:<deviceId>)"
        D[Device Identity]
        
        subgraph "MDM Agent"
            MDM[MDM Core]
            MDM_T["Topics: device/device:<deviceId>/*"]
        end
        
        subgraph "Controller: Radar"
            RC[Radar App]
            RC_T["Topics: device:<deviceId>/controller/radar:<controllerId>/*"]
            RS[Radar Sensor Hardware]
            RC --> RS
        end
        
        subgraph "Controller: Camera"
            CC[Camera App]
            CC_T["Topics: device:<deviceId>/controller/camera:<controllerId>/*"]
            CS[Camera Sensor Hardware]
            CC --> CS
        end
        
        D --> MDM
        D --> RC
        D --> CC
    end
```

---

## 2. Topic Structure

Controller topics are namespaced under the device's root topic, using the `controller/<type>:<controllerId>` pattern.

### 2.1 Controller Topic Patterns

For a device `<deviceId>`, controller type `<type>`, and controller ID `<controllerId>`:
*(Topic convention follows the `type:id` pattern used throughout the system.)*

- **RPC Channels**:
  - `device:<deviceId>/controller/<type>:<controllerId>/requests`
  - `device:<deviceId>/controller/<type>:<controllerId>/response`
  - `device:<deviceId>/controller/<type>:<controllerId>/loopback`

- **Notification Channels**:
  - `device:<deviceId>/controller/<type>:<controllerId>/notifications`
  - `device:<deviceId>/controller/<type>:<controllerId>/replies`

- **Data Channels**:
  - `device:<deviceId>/controller/<type>:<controllerId>/data`

### 2.2 Comparison with Device Topics

| Actor | Topic Pattern | Notes |
| :--- | :--- | :--- |
| Claimed Device (MDM) | `device/device:<deviceId>/requests` | Uses `device/` namespace root |
| Controller (Radar) | `device:<deviceId>/controller/radar:<id>/requests` | `type:id` pattern |
| Controller (Camera) | `device:<deviceId>/controller/camera:<id>/requests` | `type:id` pattern |

This ensures clear separation. Note that while MDM topics are nested under `device/`, Controller topics start directly with the device identity `device:<deviceId>`.

---

## 3. Minting Controller MQTT Credentials

Controllers use a **dedicated mint endpoint** to request scoped credentials.

### 3.1 Endpoint

`POST /api/device/controller/mqtt/mint`

### 3.2 Request

Headers (same as claimed device):
- `X-API-Key: <apiKey>`
- `X-Device-Id: <deviceId>`
- `Content-Type: application/json`

Body:

```jsonc
{
  "type": "radar",           // Required: Controller type ("radar", "camera", "ble", etc.)
  "controllerId": "abc123"   // Optional: Specific controller ID.
                             // If omitted, finds existing controller or creates new one.
}
```

**Auto-Creation Behavior**:
- If `controllerId` is **not provided**: The endpoint will find an existing active controller of the specified type for the device. If none exists, it will automatically create one.
- If `controllerId` **is provided**: The endpoint validates that the controller exists, belongs to the device, and matches the type.
- Only one active controller per (device, type) is created automatically. For multiple controllers of the same type, create them explicitly and specify the ID.

### 3.3 Response

```jsonc
{
  "brokerUrl": "wss://mq.datarealities.com/mqtt",
  "clientId": "device:<deviceId>_<suffix>",
  "username": "device:<deviceId>",
  "jwt": "<link-jwt>",
  "mqttUsername": "device:<deviceId>",
  "controllerId": "<controller-uuid>"   // The actual controller ID (auto-created or found)
}
```

### 3.4 ACL Scoping

When `type` and `controllerId` are present, the mint endpoint generates ACLs restricted to the controller namespace:

- `pubTopics`:
  - `device:<deviceId>/controller/<type>:<controllerId>/replies`
  - `device:<deviceId>/controller/<type>:<controllerId>/requests`
  - `device:<deviceId>/controller/<type>:<controllerId>/data`
  - `device:<deviceId>/controller/<type>:<controllerId>/loopback`

- `subTopics`:
  - `device:<deviceId>/controller/<type>:<controllerId>/response`
  - `device:<deviceId>/controller/<type>:<controllerId>/notifications`
  - `device:<deviceId>/controller/<type>:<controllerId>/loopback`

When `type` is **not** present (legacy/MDM), the existing root device
topics are used as documented in `DEVICE_CONNECT.md`.

---

## 4. Controller Connection Sequence

This sequence is identical to `DEVICE_CONNECT.md` § 1.1, but the controller
requests scoped credentials.

```mermaid
sequenceDiagram
    autonumber
    participant C as Controller App
    participant API as FS04 Web API
    participant IoT as IoT Core
    participant B as MQTT Broker

    Note over C: Has deviceId + apiKey from device provisioning

    C->>API: POST /api/device/controller/mqtt/mint<br/>{ type: "radar", controllerId: "abc123" }
    API->>IoT: Mint with scoped ACLs<br/>username=device:<deviceId><br/>topics=.../controller/radar:abc123/...
    IoT-->>API: { clientId, token }
    API-->>C: { brokerUrl, clientId, username, jwt }

    C->>B: CONNECT (clientId, username, password=jwt)
    B-->>C: CONNACK

    C->>B: SUBSCRIBE<br/>device:<deviceId>/controller/radar:abc123/notifications<br/>device:<deviceId>/controller/radar:abc123/response
```

---

## 5. Channel Pairs

Controllers use the same two channel pairs as devices (see `DEVICE_MQTT.md` § 2):

### 5.1 RPC Pair (requests ↔ response)

- Controller publishes RPC on `.../controller/<type>:<controllerId>/requests`.
- Worker responds on `.../controller/<type>:<controllerId>/response`.

Payload structure is identical to device RPCs:

```jsonc
{
  "requestId": "uuid...",
  "op": "sensor.getConfig",
  "params": { ... }
}
```

### 5.2 Notification Pair (notifications ↔ replies)

- Worker sends notifications on `.../controller/<type>:<controllerId>/notifications`.
- Controller replies on `.../controller/<type>:<controllerId>/replies`.

Uses the signed-ticket pattern from `DEVICE_NOTIFICATION_REPLY.md`:

```jsonc
// Notification (Worker → Controller)
{
  "ticket": "<signed-token>"
}

// Reply (Controller → Worker)
{
  "ticket": "<signed-token>",
  "result": { ... }
}
```

---

## 6. Controller Flows

### 6.1 Configuration Push

Server pushes sensor configuration to the controller.

```mermaid
sequenceDiagram
    autonumber
    participant W as Worker
    participant B as Broker
    participant C as Radar Controller

    Note over W: Admin updates radar config in UI
    W->>B: Publish notification<br/>topic: device:<id>/controller/radar:<cid>/notifications<br/>{ ticket: "jwt...", type: "config.update" }
    B->>C: Deliver notification
    C->>C: Apply new config
    C->>B: Publish reply<br/>topic: device:<id>/controller/radar:<cid>/replies<br/>{ ticket: "jwt...", result: { success: true } }
    B->>W: Deliver reply
```

### 6.2 Real-time Sensor Preview

User requests a live data stream from the sensor (e.g., radar point cloud).

```mermaid
sequenceDiagram
    autonumber
    participant U as Web UI
    participant W as Worker
    participant C as Radar Controller

    U->>W: RPC sensor.preview.start<br/>{ controllerId: "radar", duration: 60 }
    W->>C: Notification { type: "preview.start", ticket }

    loop Every 100ms for duration
        C->>W: Publish to .../controller/radar:<cid>/data<br/>{ points: [...] }
        W->>U: Forward via WebSocket/SSE
    end

    W->>C: Notification { type: "preview.stop", ticket }
    C->>W: Reply { ticket, result: { framesStreamed: 600 } }
```

### 6.3 Sensor Log Upload

Controller uploads diagnostic logs via pre-signed URL.

```mermaid
sequenceDiagram
    autonumber
    participant C as Radar Controller
    participant W as Worker
    participant S as Object Storage

    C->>W: RPC sensor.requestLogUploadUrl<br/>{ controllerId: "radar", logType: "trace" }
    W-->>C: { uploadUrl: "https://...", requestId }

    C->>S: PUT log file to pre-signed URL
    S-->>C: 200 OK

    C->>W: RPC sensor.logUploadComplete<br/>{ requestId }
```

---

## 7. Worker Subscriptions

The worker subscribes to controller topics using shared subscription groups. 
**Note**: Since controller topics start with `device:<id>` (varying roots), we must use the single-level wildcard `+` at the root.

```
$share/server_10/+/controller/+/requests
$share/server_10/+/controller/+/replies
$share/server_10/+/controller/+/data
```

This ensures horizontal scaling across multiple worker instances while routing
all controller traffic through the same processing pipeline.

---

## 8. Security Considerations

- **Scoped ACLs**: A controller cannot subscribe to the root device
  notifications (`device/device:<id>/notifications`), preventing it from
  intercepting MDM commands (e.g., wipe, reboot).
- **Shared device identity**: Controllers still authenticate as the device, so
  the device's claim status and account association apply. A controller cannot
  connect for an unclaimed device.
- **Signed tickets**: All notification-based flows use the same ticket
  verification as `DEVICE_NOTIFICATION_REPLY.md`, preventing spoofing.

---

## 9. Standalone Controller (No MDM)

When a user installs **only** the Controller App (e.g., Radar App):

1. **Provisioning**: The Controller App must perform the device claim flow
   itself (using the factory JWT embedded in the app). This creates the
   `Device` record and issues `apiKey`, following `DEVICE_CLAIM.md`.
2. **Connection**: After claim, the Controller App calls
   `POST /api/device/controller/mqtt/mint` with its `controllerId` to get scoped
   credentials.
3. **Behavior**: The device has no MDM Agent connected; only controller topics
   are active.

From the backend's perspective, there is no difference—a device is claimed and
a controller is connected. The MDM Agent's presence is optional.

---

## 10. Implementation Checklist

- [x] Create `POST /api/device/controller/mqtt/mint` endpoint with scoped ACLs.
- [x] Create `GET /api/device/controller?type=<type>` for config retrieval/auto-creation.
- [x] Add E2E test: `tests/integrations/controller_mqtt_mint_e2e.test.ts`.
- [x] Add E2E test: `tests/integrations/controller_config_e2e.test.ts`.
- [x] Node.js radar controller emulator with two-step flow.
- [ ] Add worker subscription patterns for `+/controller/+/...`.
- [ ] Implement controller-specific RPC handlers (e.g., `sensor.getConfig`,
      `sensor.preview.start`).