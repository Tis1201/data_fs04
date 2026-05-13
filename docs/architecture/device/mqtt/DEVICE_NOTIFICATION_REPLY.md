## Device Notification Reply Pattern

This document describes how devices (and web MQTT clients) reply to
notifications in a way that is:

- **Stateless** across web pods and workers
- **Secure** against spoofing
- **Friendly** to multi-pod deployments

The core idea is that notifications carry a **signed capability token** that is
echoed back with the reply. The worker verifies both the token and the MQTT
identity (topic/username) before routing the result.

---

## 1. Notification from Worker to Device/User

When the worker wants a device to perform an action (e.g. claim confirm,
screenshot, diagnostics), it publishes a notification on the appropriate topic,
for example:

- Device notification topic: `device/factory:<factoryDeviceId>/notifications`
- User notification topic: `user/<userId>/notifications`

Payload structure (example):

```json
{
  "ticket": "<signed-token>"        // opaque capability token carrying all claims
}
```

### 1.1 Ticket (Signed Capability Token)

The `ticket` is a signed token (typically a JWT) created by the worker. Its
payload encodes at least:

- `type`: operation type, e.g. `claim`, `screenshot`
- `userId`: the authenticated user (for user-facing workflows)
- `factoryDeviceId`: the device this ticket is for
- `requestId`: a unique correlation ID
- `exp`: short expiry (e.g. 5–10 minutes)

The ticket is **authoritative**; the worker trusts what is in the ticket after
signature verification, not what the client sends in plain params. All
information required to authorize and route the reply is taken from the ticket
claims plus the MQTT identity (topic/username).

---

## 2. Device/User Reply Flow

The notification recipient does **not** need to understand the ticket contents.
It only needs to:

1. Perform the requested action (e.g. user confirms claim, device takes a
   screenshot).
2. Publish a normal MQTT RPC request that includes the original `ticket`.

### 2.1 Device Reply Example

Device replies to the notification on a dedicated reply topic:

- Topic: `device/<factoryDeviceId>/replys`

The payload is intentionally minimal and contains only the signed ticket and the
operation-specific result:

```json
{
  "ticket": "<signed-token>",
  "result": {                      // operation-specific data
    "imageUrl": "https://.../shot.png"
  }
}
```

### 2.2 Web MQTT Client Reply Example

Similarly, a web MQTT client can reply on a dedicated reply topic:

- Topic: `user/<userId>/replies`

With the same minimal payload shape as the device:

```json
{
  "ticket": "<signed-token>",
  "result": {                      // operation-specific data
    "foo": "bar"
  }
}
```

---

## 3. Worker Verification and Routing

When the worker receives a reply (raw RPC payload), it follows this sequence:

1. **Determine MQTT identity**
   - From topic and broker auth, derive:
     - `sub` (e.g. `factory:<factoryDeviceId>` or `user:<userId>`)
     - Device or user ID from the topic prefix (`device/` or `user/`).

2. **Verify ticket signature**
   - Decode and verify the `ticket` using the server-side signing key.
   - Validate:
     - `exp` is in the future
     - `type` matches the expected operation category

3. **Cross-check identity**
   - For device-originated replies:
     - Check `ticket.factoryDeviceId === deviceIdFromTopic`
   - For user-originated replies:
     - Check `ticket.userId === userIdFromTopic`

4. **Authorize and execute**
   - If all checks pass, the worker executes the corresponding handler (e.g.
     `device.claim.confirm`, `device.screenshot.result`) using **IDs from the
     ticket**, not from arbitrary params.

5. **Route result back to sender/consumer**
   - The handler can:
     - Publish a result on a user MQTT topic (e.g. `user/<userId>/response`)
     - Stream via SSE/WebSocket/WebRTC to the web app
     - Or perform purely server-side actions (e.g. linking device to user)

Because all information required to authorize the reply lives in the signed
ticket + MQTT identity, no request-specific DB state is required for ephemeral
workflows. For long-lived or auditable workflows (e.g. ownership claims), this
pattern can be combined with a DB-backed claim record.

---

## 4. Use Cases

- **Ephemeral commands** (no DB):
  - Screenshot, diagnostics, quick actions.
  - Use ticket + MQTT identity only.

- **Durable workflows** (DB + ticket):
  - Device claim, provisioning, ownership changes.
  - Store a claim record in DB and still use tickets to securely bind device and
    user identities without keeping in-memory state on web pods.

