# Sensor Preview Architecture

Live sensor data streaming from controllers to web users via **Worker-Mediated Relay**.

---

## Flow Overview

```mermaid
sequenceDiagram
    autonumber
    participant U as Web UI
    participant W as Worker
    participant C as Controller

    U->>W: RPC sensor.preview.start
    W->>W: Validate access + create ticket
    W->>C: Notification { ticket }
    C->>W: Reply { ticket, started: true }
    W->>U: Response { flowId, sessionId }

    rect rgb(200, 230, 255)
        Note over C,U: Preview Active
        loop Data Stream
            C->>W: Data { ticket, data }
            W->>W: Verify ticket, extract routing
            W->>U: Notify user/<sub>/notifications { flowId, data }
        end
    end

    U->>W: RPC sensor.preview.stop { sessionId }
    W->>C: Notification { stopTicket }
    C->>W: Reply { stopTicket, stopped: true }
    W->>U: Notification { flowId, type: complete }
```

---

## Message Formats

### Start Request (User → Worker)

```json
{
  "requestId": "uuid",
  "op": "sensor.preview.start",
  "params": { "deviceId": "...", "controllerId": "...", "sensorId": "...", "duration": 60 }
}
```

### Start Response

```json
{
  "requestId": "uuid",
  "flowId": "flow-uuid",
  "result": { "sessionId": "session-uuid", "status": "started", "expiresAt": "..." }
}
```

### Controller Notification (Worker → Controller)

```json
{ "ticket": "<signed-jwt>" }
```

**Ticket Claims**: `type`, `flowId`, `recipient`, `deviceId`, `controllerId`, `sensorId`, `sessionId`, `duration`, `exp`

### Data Frame (Controller → Worker)

```json
{
  "ticket": "<signed-jwt>",
  "type": "preview.frame",
  "timestamp": 1703264100000,
  "data": { "points": [...] }
}
```

### User Notification (Worker → User)

```json
{
  "flowId": "flow-uuid",
  "type": "preview.data",
  "timestamp": 1703264100000,
  "data": { "points": [...] }
}
```

---

## Stateless Routing

> [!IMPORTANT]
> Workers are **stateless**. The controller echoes the ticket with each data frame. Workers verify the ticket and extract routing from claims.

**Worker Logic**:
1. Receive data on `.../controller/<type>:<id>/data`
2. Verify `ticket` signature + check `exp`
3. Extract `recipient` and `flowId` from claims
4. Forward data to recipient

---

## Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `user/<sub>/requests` | User → Worker | Start/stop RPC |
| `user/<sub>/response` | Worker → User | RPC response |
| `user/<sub>/notifications` | Worker → User | Data stream |
| `.../controller/.../notifications` | Worker → Controller | Commands |
| `.../controller/.../replies` | Controller → Worker | Command responses |
| `.../controller/.../data` | Controller → Worker | Data frames |

---

## Security

- User access validated before starting
- Max 5 min duration, max 2 concurrent sessions per user
- Ticket signature verification on all data frames
- Auto-expiry via `exp` claim

---

## Implementation

| Component | File | Status |
|-----------|------|--------|
| Start/Stop RPC | [handle_sensor_preview.ts](file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/mqtt/handlers/web/handle_sensor_preview.ts) | ✅ |
| Data Forwarding | [index.ts](file:///Users/bernard/CascadeProjects/fs04/fs04_web/src/lib/server/mqtt/handlers/index.ts) | ✅ |
| E2E Test | [sensor_preview_e2e.test.ts](file:///Users/bernard/CascadeProjects/fs04/fs04_web/tests/integrations/sensor_preview_e2e.test.ts) | ✅ |
| Controller Handler | TBD | ⏳ |

---

## See Also

- [Device Notification Reply Pattern](../DEVICE_NOTIFICATION_REPLY.md) - Stateless ticket pattern
- [RADAR.md](./RADAR.md) - Radar controller configuration
