# Messaging Refactor: Moving fs04_web to IoT Core RPC/Notifications

## 1. Context & Goals

### 1.1 Background

fs04_web currently uses an in-house messaging stack built around:

- **SSE** for device connections
  - `/api/device/listen` establishes a long-lived SSE stream per device
  - `SSEConnection`, `ConnectionManager`, and `subscriptionRegistry` manage connections & subscriptions
- **WebSockets** for browser connections
  - WebSocket middleware creates `WSConnection` instances and registers them with `ConnectionManager`
  - Messages are routed via a custom dispatcher/publisher system using `scope` and `type`
- **Custom messaging library**
  - Message envelopes (`type`, `scope`, `payload`, `requestId`)
  - Subscription routing (`subscription:device:{deviceId}`, etc.)
  - WebRTC signaling, device status, and general real-time notifications all flow through this stack.

This works but is:

- Complex to reason about (ConnectionManager, dispatcher, publisher, subscription registry, SSE/WS details)
- Harder to scale horizontally
- Overlapping with the new **fs04_iot_core**, which is now the canonical place for IoT connectivity.

### 1.2 Target

Leverage **fs04_iot_core** as the primary real-time layer so that:

- Devices and browser clients communicate via **RPC + notification/reply** patterns managed by IoT Core
- fs04_web becomes a **thin client** for:
  - Issuing RPC requests (via Actions calling IoT Core APIs or minting MQTT tokens)
  - Subscribing to notifications in the browser (likely via MQTT/WebSocket, using IoT Core auth/ACLs)
- The existing SSE/WebSocket messaging stack in fs04_web is **incrementally phased out** without breaking existing features.

Key goals:

- **Reduce complexity** in fs04_web (no long-lived connections managed here)
- **Centralize device communication** concerns inside fs04_iot_core
- **Keep UX and security semantics** (auth, row-based security, audit logging) aligned with the current system
- **Minimize risk** via vertical-slice, feature-flagged rollout.

---

## 2. Current Messaging Architecture (fs04_web)

### 2.1 Device-side (SSE)

Relevant pieces:

- `src/routes/api/device/listen/+server.ts`
  - Authenticates device via `auth_device`
  - Creates an `SSEConnection` with meta `{ id: device.id, deviceId: device.id, protocol: 'sse', ... }`
  - Registers with `ConnectionManager`
  - Auto-subscribes device connection to `subscription:device:{deviceId}`
  - Publishes `device:connection` system messages via `publisher` and `MessageFactory`
  - Updates device status via `DeviceStatusManager`

- `src/lib/server/messaging/connections/sse_connection.ts`
  - Implements SSE heartbeat (`ping`), legacy `send`, and `sendStandardized` methods
  - Wraps payloads into a Pushpin-like `channel_message` envelope
  - Manages lifecycle and cleanup (alive/closed flags, controller cleanup, subscription cleanup via ConnectionManager)

### 2.2 Browser-side (WebSockets)

Relevant pieces:

- `src/lib/server/websocket/middleware.ts`
  - Upgrades HTTP to WebSocket
  - Builds `ConnectionMeta` with user info, protocol `websocket`, etc.
  - Creates `WSConnection` and registers with `ConnectionManager`
  - Manages cleanup on close/error

- `src/lib/server/messaging/connections/ws_connection.ts`
  - Handles `message` events from the WebSocket
  - Parses `{ type, scope, payload, requestId }`
  - Composes `InMessage` including `userInfo`, `protocol`, `connectionId`
  - Short-circuits `ping`/`pong`
  - Delegates everything else to `MessageDispatcher.dispatch`

- `src/lib/stores/websocket-store.ts`
  - Client-side store for WebSocket connection state, message handling, and re-connect logic
  - Used by features like WebRTC signaling and device control UIs.

### 2.3 Messaging Core

- `src/lib/server/messaging/core/connectionManager.ts`
  - Global registry of active connections (SSE + WS)
  - Lookup by `connectionId` (and sometimes `deviceId`)

- `src/lib/server/messaging/core/subscriptionRegistry.ts`
  - Tracks which connection IDs are subscribed to which `scope` strings (e.g. `subscription:device:{deviceId}`)

- `src/lib/server/messaging/core/dispatcher.ts` + `publisher.ts`
  - Route messages based on `type`/`scope`
  - Broadcast to relevant subscribers via `ConnectionManager`

- `src/lib/server/messaging/interfaces/message.ts`
  - Defines the shape of messages (`InMessage`, `RoutingMessage`, etc.)

### 2.4 Major Use Cases

- **Device connection status** (online/offline notifications)
- **Device commands & telemetry** (command messages sent from browser to device; updates from device to browser)
- **WebRTC signaling** (offers, answers, ICE candidates)
- **General notifications** (system messages, toasts, etc.).

These are all multiplexed on the same custom messaging layer.

For detailed transport-specific sunset plans, see:

- `docs/refactor/SUNSET_SSE.md`
- `docs/refactor/SUNSET_WEBSOCKET.md`

---

## 3. IoT Core Capabilities (fs04_iot_core)

### 3.1 MQTT-Centric Design

IoT Core is built around an MQTT broker (e.g. VerneMQ) with:

- **JWT-based authentication** (`src/lib/server/mq/auth.ts`)
  - `/api/mq/mint` issues tokens with embedded publish/subscribe ACLs (see `docs/MQTT_AUTH_ARCHITECTURE.md`)
  - MQTT clients (devices, users) use the JWT as the CONNECT password
  - VerneMQ auth webhook validates tokens and caches ACLs in Redis

- **ACL enforcement** (`src/lib/server/mq/acl.ts`)
  - Topic-based permissions using MQTT wildcards
  - Identity-aware defaults for `device` vs `user` identities

- **Presence tracking** (`src/lib/server/mq/presence.ts`)
  - Tracks client online/offline state in Redis
  - Indexed by type, account, and identity for fast lookups

This gives us a robust foundation for **device ↔ user messaging** that is:

- Scalable (MQTT broker manages connections)
- Flexible (topics can encode account, device, and operation)
- Observable (presence and ACLs tracked centrally).

### 3.2 Desired RPC/Notification Model

We will standardize around these patterns (even if implementation details evolve):

- **Command RPC** (user → device)
  - User/browser publishes a request message to `cmd/{target}`
  - Device subscribes and replies on a correlated topic (e.g. `reply/{requestId}` or `cmd/{target}/reply`)
  - IoT Core enforces who can publish/subscribe to which topics

- **Notification/Reply** (device → user/UI)
  - Device publishes events to `events/{deviceId}` or `notifications/{accountId}/{deviceId}`
  - Browsers subscribe to per-account or per-device streams
  - UI uses these notifications to update state (e.g. device status, telemetry, WebRTC offers).

- **Correlation & observability**
  - Each RPC has a `requestId` / `clientMessageId` for traceability
  - IoT Core can log/audit all messages with enough metadata for debugging.

---

## 4. Target Architecture for fs04_web

### 4.1 High-Level Changes

1. **Move long-lived connections out of fs04_web**
   - Devices connect to the MQTT broker managed by IoT Core (not `/api/device/listen` SSE)
   - Browsers connect either directly to MQTT over WebSocket using minted tokens, or via a minimal proxy layer in IoT Core.

2. **Use IoT Core as the message router**
   - Replace internal `ConnectionManager` + `subscriptionRegistry` with topic-based routing
   - Define a small, stable set of MQTT topics for:
     - Device commands / responses
     - Telemetry streams
     - WebRTC signaling
     - General notifications.

3. **Thin integration layer in fs04_web**
   - Use **Actions** to:
     - Mint MQTT tokens via IoT Core’s `/api/mq/mint` (for browser-side MQTT clients)
     - Trigger specific RPC calls (via IoT Core HTTP APIs where appropriate)
   - Client-side Svelte code handles MQTT/WebSocket connections and subscription management.

4. **Preserve security + RLS**
   - Enforce account and user/device bindings in IoT Core JWTs and ACLs
   - Ensure fs04_web only requests tokens/permissions consistent with Zenstack RLS policies.

### 4.2 New Responsibility Split

- **fs04_web**
  - Authenticated UI, actions, and admin flows
  - Provides short-lived tokens and metadata for front-end real-time clients
  - Does **not** own connection lifecycle for devices or long-lived client connections.

- **fs04_iot_core**
  - Owns all MQTT-based connectivity & ACL
  - Provides RPC/notification semantics
  - Tracks presence and exposes any necessary read models (e.g. `GET` endpoints for presence/history).

---

## 5. Migration Strategy (Phased)

We will migrate in vertical slices, with feature flags where needed, to avoid a big-bang cutover.

### Phase 0 – Baseline & Contracts

**Objectives**

- Confirm IoT Core deployment, MQTT broker, and `/api/mq/mint` are healthy
- Define shared **topic conventions** and **message schemas** for core use cases
- Decide integration mode for browsers:
  - Direct MQTT-over-WebSocket from browser, or
  - IoT Core-provided WebSocket/SSE that bridges MQTT.

**Deliverables**

- Short design doc inside fs04_iot_core (if not existing) describing:
  - Topic patterns for:
    - `commands` / `replies`
    - `telemetry` / `events`
    - `webrtc` signaling
  - JWT claim structure and how it maps to topics
- Env/infra notes in fs04_web on how to reach IoT Core and broker.

### Phase 1 – Dual-Stack Support (Read Path First)

**Goal**: Introduce IoT Core-backed read models/notifications while keeping the existing messaging stack as the source of truth.

**Steps**

- **1.1 Add IoT Core client utilities in fs04_web**
  - A small server-side client that can:
    - Call IoT Core HTTP endpoints (if needed)
    - Mint MQTT tokens via `/api/mq/mint` for the current user/account.
  - Action-based API in fs04_web that returns the token + broker URL to the browser.

- **1.2 Browser MQTT client** (already present)
  - Use the existing `mqttStore` @`src/lib/stores/mqtt-store.ts`, which:
    - Connects to MQTT over WebSocket using a minted token (see `/api/user/mqtt/mint`)
    - Subscribes to topics (e.g. presence/telemetry, notifications)
    - Exposes a stable store API for UI components
  - In this phase, limit usage to read-only presence/telemetry flows and keep existing WebSocket/SSE messaging untouched for now.

- **1.3 Verify presence & telemetry mirrors**
  - For selected test devices/accounts, ensure presence/telemetry visible both via:
    - Old messaging (SSE/WS)
    - New MQTT path (used only in a debug/secondary UI at this stage).

**Exit Criteria**

- Browser can consume some IoT Core topics without impacting production flows
- No dependency on `ConnectionManager` for this new path
- Observability (logs/metrics) confirm stable connections and correct ACL behavior.

### Phase 2 – Move Device Presence & Status to IoT Core

**Goal**: Use IoT Core as the **source of truth** for presence and basic status; remove SSE-based presence for migrated devices/accounts.

**Steps**

- **2.1 Presence from IoT Core**
  - Implement a presence read model in fs04_web that reads from IoT Core/Redis (via HTTP or direct Redis access if shared)
  - Update relevant UI pages to use IoT Core presence instead of SSE-derived status, behind a feature flag.

- **2.2 Deprecate presence messages on old stack**
  - For feature-flagged accounts, stop publishing `device:connection` messages via `publisher`
  - Ensure no UI relies solely on those messages for presence.

**Exit Criteria**

- For migrated accounts, device online/offline state is driven entirely by IoT Core
- SSE/WebSocket stack is no longer required for presence for those accounts.

### Phase 3 – Migrate Command RPC & WebRTC Signaling

**Goal**: Move high-value interactive flows (commands + WebRTC) to IoT Core RPC/notifications.

**Steps**

- **3.1 Command RPC over MQTT**
  - Define RPC topics for device commands (e.g. `cmd/{accountId}/{deviceId}` + correlated replies)
  - In fs04_web Actions, replace calls that currently send messages via `publisher`/`ConnectionManager` with:
    - Publishing to IoT Core RPC (HTTP call or MQTT publish via a service account), or
    - Returning signed MQTT credentials so the browser can publish the command directly.
  - Handle `reply` messages in browser via MQTT subscriptions.

- **3.2 WebRTC signaling via IoT Core**
  - Map existing WebRTC signaling messages (`webrtc:offer`, `webrtc:answer`, ICE candidates) to MQTT topics
    - e.g. `webrtc/{deviceId}/offer`, `webrtc/{deviceId}/answer`, `webrtc/{deviceId}/ice`
  - Update device and browser logic to use IoT Core topics instead of `subscription:device:{deviceId}` messages.
  - Ensure message schemas stay backwards compatible where possible (same fields, different transport).

- **3.3 Feature-flagged rollout**
  - Start with internal/test accounts
  - Monitor connection stability, latency, and error rates
  - Gradually enable for more accounts.

**Exit Criteria**

- Commands and WebRTC flows for migrated accounts do **not** rely on fs04_web’s SSE/WebSocket messaging
- All such flows operate via IoT Core RPC/notifications.

### Phase 4 – Decommission SSE/WebSocket Messaging in fs04_web

**Goal**: Remove unused messaging infrastructure once all relevant features have been migrated.

**Steps**

- Identify remaining users of:
  - `ConnectionManager`
  - `subscriptionRegistry`
  - `publisher` / `MessageDispatcher`
  - `SSEConnection` and `WSConnection`
- For each, refactor to use IoT Core instead (following the patterns from Phases 2–3).
- When all call sites are gone:
  - Physically remove SSE/WebSocket endpoints from fs04_web
  - Delete messaging core modules
  - Update tests and docs accordingly.

**Exit Criteria**

- No remaining imports of `src/lib/server/messaging/*` or websocket middleware in fs04_web
- All device/user real-time flows are handled by IoT Core.

---

## 6. Cross-Cutting Concerns

### 6.1 Security & RLS

- JWT contents minted by IoT Core must align with fs04_web’s Zenstack row-level security:
  - A user should only receive tokens that permit topics for devices/accounts they can access
  - Device identity should be embedded in MQTT username/claims and validated server-side
- For any server-to-server RPC from fs04_web → fs04_iot_core, use signed service credentials and strict ACLs.

### 6.2 Observability & Audit

- Preserve/extend the existing messaging audit behavior:
  - Correlate RPC requests/responses with `requestId` / `clientMessageId`
  - Log message envelopes (with redaction for sensitive fields)
- Use IoT Core metrics (`trackAuth`, `trackAcl`, `trackConnection`) as primary signals for connection health
- Expose summary views in fs04_web admin where useful (e.g. active connections via Redis presence data).

### 6.3 Backwards Compatibility & Rollout

- Use **feature flags** per account or environment for each phase
- Ensure old and new paths can co-exist during migration:
  - No breaking changes to message schemas consumed by devices until all devices are migrated
  - Transport (SSE/WS vs MQTT) can differ while payloads remain compatible.

---

## 7. Next Steps Checklist

Short-term actions to start the migration:

1. **Finalize topic and schema contracts** in fs04_iot_core for:
   - Presence, telemetry
   - Commands + replies
   - WebRTC signaling
2. **Refine IoT Core integration layer in fs04_web** (server-side client + Actions for token minting; align with existing MQTT utilities and `/api/user/mqtt/mint`)
3. **Adopt the existing browser MQTT client store** (`mqttStore` in fs04_web) for read-only presence/telemetry, then expand to commands/WebRTC
4. **Select a pilot account/device set** for dual-stack testing
5. **Iterate on vertical slices** (presence → commands → WebRTC), updating this doc as we learn.
