## Device MQTT Architecture Overview

This document summarizes how devices communicate with the FS04 backend over
MQTT. It focuses on topic structure and the two main channel pairs used for
device communication. For detailed notification/reply semantics, see
`DEVICE_NOTIFICATION_REPLY.md`.

---

## 1. Topic Structure

Device topics are namespaced by a `factoryDeviceId` and follow these patterns:

- RPC-style:
  - `device/factory:<factoryDeviceId>/requests`
  - `device/factory:<factoryDeviceId>/response`

- Notification-style:
  - `device/factory:<factoryDeviceId>/notifications`
  - `device/<factoryDeviceId>/replies`

User MQTT topics follow the same pattern with `user/<userId>/...`.

The broker ACLs ensure that only the authenticated client for a given device or
user can publish/subscribe to their respective topics.

---

## 2. Channel Pairs

There are two distinct channel pairs for device MQTT communication:

- **RPC pair (requests ↔ response)**
  - Topics: `.../requests` ⟷ `.../response`
  - Used for classic RPC-style interactions.
  - Payloads include fields like `requestId`, `op`, `params`, `result`, and
    `error`.

- **Notification pair (notifications ↔ replies)**
  - Topics: `.../notifications` ⟷ `.../replies`
  - Used for capability-based flows driven by a signed ticket.
  - Payloads are intentionally minimal:
    - Notification: `{ "ticket": "<signed-token>" }`
    - Reply: `{ "ticket": "<signed-token>", "result": { ... } }`

The worker uses the topic prefix (`device/` or `user/`) plus the MQTT
username/subject to derive identity and enforce routing.

---

## 3. Signed-Ticket Notification Pattern (High Level)

For notification flows, the server encodes all authorization and routing
information inside a signed **ticket** (typically a JWT):

- `type`: operation type, e.g. `claim`, `screenshot`.
- `factoryDeviceId`: the device the ticket is valid for.
- `userId`: the user involved (for user-facing workflows).
- `requestId`: correlation ID.
- `exp`: short expiry window.

The worker:

1. Sends a notification containing only the `ticket` on
   `device/factory:<factoryDeviceId>/notifications` (or `user/<userId>/notifications`).
2. The device/user performs the action and replies on `device/<factoryDeviceId>/replies`
   (or `user/<userId>/replies`) with `{ ticket, result }`.
3. The worker verifies the ticket signature and expiry, cross-checks IDs in the
   ticket against the MQTT identity derived from the topic, and then routes or
   applies the `result`.

Because all required information is inside the ticket plus the MQTT identity,
notification flows can remain stateless across web pods and workers. For
long-lived or auditable workflows (e.g. ownership claims), this pattern can be
combined with a DB-backed record.

---

## 4. User MQTT Identity and Subject Schema

For user MQTT clients, identity and account context are encoded directly in the
JWT that is minted by `/api/user/mqtt/mint`:

- `sub`: `user:<user_id>:<account_id>`
- Claim `accountId`: the same `<account_id>` value
- Claim `username`: the user’s email
- Claim `scope`: typically `web:mqtt`

Examples:

- `sub = user:cmi5g818l0008hfkgjiraqq6k:cmi5g7ksw0004hfkgvud85rbp`
- `accountId = cmi5g7ksw0004hfkgvud85rbp`

This allows a single user to operate in different **account contexts** by
minting separate tokens (and MQTT connections) for each account. The worker and
ACLs can:

- Parse `sub` to obtain both `userId` and `accountId`.
- Enforce per-account permissions when handling topics under `user/<userId>/...`
  or any account-scoped resources.

Account selection in the web UI is reflected in the minted token via
`auth.currentAccount` so that each MQTT credential is explicitly bound to a
specific account.

