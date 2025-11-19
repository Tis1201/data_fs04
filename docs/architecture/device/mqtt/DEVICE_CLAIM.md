## Background

Factory devices arrive with a Factory JWT signed by our backend. The goal is to pair the device with a user account without exposing extra APIs. Devices connect directly to the MQTT broker, receive a PIN from the worker, display it to the user, and the user claims the device over MQTT as well. The worker orchestrates everything (auth checks, PIN lifecycle, conversion to a real device) so HTTP APIs stay minimal.

Key principles:

- **Single transport:** MQTT handles both device and user interactions (device register + user claim) so we avoid SSE/Pushpin duplication.
- **Strict auth:** Factory JWT → short-lived link JWT (username/ACLs). Users stay on standard session auth when connecting over MQTT/WebSocket.
- **Atomic claim:** Only the worker mutates device state, ensuring row-level security and preventing race conditions.

## Steps

1. Device trades its Factory JWT for a broker link (URL + short-lived link JWT containing the factory-device `sub`).
2. Device connects to MQTT using the link JWT as username/password; broker ACLs map the `sub` to factory ACL rules.
3. Device publishes a minimal `register` payload (factory device ID + runtime info). Worker verifies topic, username, and JWT claims.
4. Worker loads the factory device by `sub`, generates a PIN with TTL, stores it, and publishes the PIN back to the device for display.
5. User’s web client (already authenticated) publishes a `claim` request that contains the PIN only.
6. Worker atomically validates the PIN (not expired, not already claimed), converts the factory device into a real device record, issues API credentials, and notifies both user and device scopes.
7. Device disconnects the factory link and reconnects using its new API key / standard MQTT credentials.

## Implementation summary (current code)

To keep this document KISS and aligned with the code, here is how the
device-claim flow is currently implemented. Treat this section as the
single source of truth for the live behavior.

- **Device test client** – `tests/mqtt/device/device.py`
  - Uses `mint_factory_credentials()` to get a broker URL + factory JWT; the
    JWT `sub` has the form `factory:{factoryDeviceId}`.
  - Connects to the broker over WebSockets using `DeviceConnection`.
  - Sends a `get.pin` RPC on
    `device/factory:{factoryDeviceId}/requests` and receives a PIN on
    the corresponding `/response` topic.
  - Saves claim results (`deviceId`, `apiKey`, `accountId`, `factoryDeviceId`)
    into `tests/mqtt/device/claimed.json` when it receives
    `device.claim.confirm` from the worker.
  - On subsequent runs, if `claimed.json` exists, it skips `get.pin` and
    behaves as an already-claimed device.

- **User claim RPC** – `src/lib/server/mqtt/handlers/web/handle_claim_device.ts`
  - Exposes the `user.claim.device` RPC used by `tests/mqtt/web/test_connect.ts`.
  - Topic: `user/{sub}/requests` where `sub = user:{userId}:{accountId}`.
  - Validates the PIN against `FactoryDevice.registrationPin`.
  - Generates a signed claim ticket via
    `sendDeviceNotificationWithTicket({ factoryDeviceId, sub, type: 'claim' })`
    and publishes it to `device/factory:{factoryDeviceId}/notifications`.
  - Returns `{ deviceId: factoryDevice.id, requestId }` where `requestId` is
    the ticket's request id for correlation.

- **Device claim confirm RPC** –
  `src/lib/server/mqtt/handlers/device/handle_claim_confirm.ts`
  - Handles `device.claim.confirm` RPCs on
    `device/factory:{factoryDeviceId}/requests`.
  - Verifies the ticket and resolves `user`, `account`, and `factoryDevice`
    via `resolveDeviceClaimContextFromTicket`.
  - Creates a real `Device` row (with API key, linked to the account) and
    updates the `FactoryDevice` to mark it claimed.
  - Responds to the device with `{ status: 'ok', deviceId, apiKey, accountId }`.
  - Sends a `claim.confirmed` notification to the user on
    `user/{sub}/notifications` with a payload containing
    `{ requestId, deviceId, factoryDeviceId, accountId }`.

- **Web MQTT test client** – `tests/mqtt/web/test_connect.ts`
  - Connects to the broker using a web JWT; uses the JWT `sub` as the
    MQTT username (`user:{userId}:{accountId}`).
  - Sends `user.claim.device` over MQTT with the PIN entered by the user.
  - Reads `{ deviceId, requestId }` from the RPC result and then waits up to
    10 seconds for a matching `claim.confirmed` notification on
    `user/{sub}/notifications`.
  - If the notification arrives and the `requestId` + `factoryDeviceId` match
    the RPC result, it prints a "claim confirmation" message; otherwise it
    logs a timeout or mismatch.
