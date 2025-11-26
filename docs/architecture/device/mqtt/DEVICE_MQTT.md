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
  - `device/<factoryDeviceId>/replies` *(reserved for future generic flows; the
    claim flow replies via the RPC pair instead)*

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

The worker, for the **claim** flow:

1. Sends a notification containing only the `ticket` on
   `device/factory:<factoryDeviceId>/notifications` (or `user/<sub>/notifications`).
2. The device performs the action and replies via an RPC call
   `device.claim.confirm` on `device/factory:<factoryDeviceId>/requests`, with
   the response on the matching `/response` topic.
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

---

## 5. MQTT Credential Minting & Server Worker

MQTT credentials for all actors (factory devices, users, server worker) are
minted centrally by **fs04_iot_core** via `/api/mq/mint`, using an API key.
The fs04_web app does not sign MQTT JWTs directly.

- **Shared mint helper**
  - `src/lib/server/mqtt/mint.ts` exposes:
    - `mintIoTCoreCredentials({ username, pubTopics, subTopics })`
      - Reads `IOT_CORE_BASE_URL` and `IOT_CORE_API_KEY` from the environment.
      - Calls IoT Core `/api/mq/mint` and returns `{ clientId, token, username? }`.
    - `getMqttBrokerUrl()`
      - Reads `MQTT_BROKER_URL` from the environment.

- **Factory device mint endpoint**
  - Route: `POST /api/device/mqtt/mint/factory` in fs04_web.
  - Flow:
    - Verifies the incoming **factory JWT** (kid-based key lookup, scope checks).
    - Upserts/creates a `factoryDevice` record with hardware metadata and
      tracking fields (IP, user-agent, timestamps).
    - Calls `mintIoTCoreCredentials` with:
      - `username = factory:<factoryDeviceId>`
      - `pubTopics = [`
        - `device/factory:<id>/replies`
        - `device/factory:<id>/requests`
        - `device/factory:<id>/loopback` *(diagnostic channel)*
        - `]`
      - `subTopics = [`
        - `device/factory:<id>/response`
        - `device/factory:<id>/notifications`
        - `device/factory:<id>/loopback`
        - `]`
    - Responds with a JSON payload containing:
      - `brokerUrl` (from `MQTT_BROKER_URL`)
      - `clientId` (unique per minted credential)
      - `username` (typically `factory:<id>`)
      - `jwt` (the minted MQTT password/token)

- **Server MQTT worker identity**
  - The `mqtt-transport` worker uses the same helper:
    - `username = server:fs04-worker`
    - `pubTopics = ['#']`, `subTopics = ['#']` (global ACL managed by IoT Core).
  - IoT Core mints a JWT and clientId (e.g. `server:fs04-worker_<suffix>`),
    which the worker uses to connect to the broker.
  - After connecting, the worker subscribes only to the shared device/user
    topics from `getWorkerSubscriptions()` such as:
    - `$share/server_10/device/+/requests|replies|events`
    - `$share/server_10/user/+/requests|replies|events`
  - This keeps **authorization** centralized in IoT Core while the worker
    still behaves as a scoped consumer of device/user traffic.

---

## 6. MQTT E2E tests (Vitest)

The MQTT architecture above is exercised end-to-end using **Vitest** integration
tests under `tests/integrations`. These tests are intended to be run against a
locally running `fs04_web` + MQTT worker + IoT Core stack.

### 6.1. Minting and connectivity

- `tests/integrations/factory_mqtt_mint_e2e.test.ts`
  - Mints factory MQTT credentials via
    `POST /api/device/mqtt/mint/factory` using a DB-backed `FactoryToken`.
  - Connects as `factory:<factoryDeviceId>` and verifies subscriptions and
    publishability on:
    - `device/factory:<id>/requests|replies|loopback`
    - `device/factory:<id>/response|notifications|loopback`.

- `tests/integrations/user_mqtt_mint_e2e.test.ts`
  - Logs in as a sample admin user and calls `POST /api/user/mqtt/mint`.
  - Connects as `user:<userId>:<accountId>` and verifies:
    - Subscriptions on `user/<sub>/response|notifications`.
    - Publish on `user/<sub>/requests`.

- `tests/integrations/device_mqtt_mint_e2e.test.ts`
  - Uses Prisma to find a claimed `Device` with non-null `apiKey`.
  - Calls `POST /api/device/mqtt/mint` with `X-API-Key`.
  - Connects as `device:<deviceId>` and verifies the same ACL pattern as
    factory devices but on the claimed-device subject.

### 6.2. Device claim flow over MQTT

- `tests/integrations/device_claim_e2e.test.ts`
  - Runs a full **factory device → claimed device** flow over MQTT:
    1. Factory client mints credentials and connects as
       `factory:<factoryDeviceId>`.
    2. User client mints credentials and connects as
       `user:<userId>:<accountId>`.
    3. Factory sends `get.pin` RPC on
       `device/factory:<id>/requests` and receives the PIN on `/response`.
    4. User sends `device.claim` RPC on `user/<sub>/requests`.
    5. Worker sends a signed `claim` ticket on
       `device/factory:<id>/notifications`.
    6. Factory responds with `device.claim.confirm` RPC.
    7. Worker provisions a `Device` record (with `apiKey`) and emits a
       `reply:claim` notification on `user/<sub>/notifications`.
  - The test asserts that the device created by the worker matches the IDs
    observed by both factory and user clients.

### 6.3. User-initiated screenshot flow

- `tests/integrations/user_screenshot_e2e.test.ts`
  - Simulates the **user → device → user** screenshot loop entirely over MQTT:
    1. User mints MQTT credentials (`/api/user/mqtt/mint`) and connects as
       `user:<userId>:<accountId>`.
    2. Prisma finds a claimed `Device` (with `apiKey`) in one of the user's
       accounts; device mints MQTT credentials (`/api/device/mqtt/mint`) and
       connects as `device:<deviceId>`.
    3. User sends `device.screenshot` RPC on `user/<sub>/requests`.
    4. Worker publishes a `device.screenshot` notification ticket to
       `device/device:<deviceId>/notifications`.
    5. The simulated device client replies on
       `device/device:<deviceId>/replies` with `{ ticket, result: { data, ... }}`.
    6. Worker processes the reply and emits a reply-style notification ticket to
       `user/<sub>/notifications`, with `params` set to the screenshot payload.
  - The test waits for the notification with the matching `flowId` and asserts
    that `params.data` is a non-empty string (a base64 screenshot placeholder).

### 6.4. Running the tests

Prerequisites:

- MQTT worker process running and connected to the broker via IoT Core.
- `IOT_CORE_BASE_URL`, `IOT_CORE_API_KEY`, and `MQTT_BROKER_URL` configured.
- Sample admin user credentials (`SAMPLE_ADMIN_USERNAME`, `SAMPLE_ADMIN_PASSWORD`).
- At least one active `FactoryToken` and/or a claimed `Device` with `apiKey`
  (the claim E2E can be used to provision one).

Example commands from the `fs04_web` root:

```bash
npx vitest tests/integrations/factory_mqtt_mint_e2e.test.ts
npx vitest tests/integrations/user_mqtt_mint_e2e.test.ts
npx vitest tests/integrations/device_mqtt_mint_e2e.test.ts
npx vitest tests/integrations/device_claim_e2e.test.ts
npx vitest tests/integrations/user_screenshot_e2e.test.ts
