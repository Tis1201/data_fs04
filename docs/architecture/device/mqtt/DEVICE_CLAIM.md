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

## Message Schemas

Devices and web clients publish bare payloads (KISS); the worker wraps/unwraps them with a `meta` block so we can enrich logs, retries, and downstream routing without complicating client code.

All MQTT messages handled by the worker therefore use the following internal envelope (clients only care about the `payload.type` + `payload.values` contract):

```jsonc
{
  "meta": {
    "id": "uuid",                 // unique per message for tracing / retries
    "type": "device:register | device:pin-issued | device:claim | device:claim-success | device:claim-failed",
    "source": "factory-device | web-client | worker",
    "timestamp": "ISO-8601",
    "correlationId": "optional uuid"
  },
  "payload": {
    "type": "action string",
    "values": { /* message-specific fields */ }
  }
}
```

Specific payloads (note: the worker derives `factoryDeviceId` from the authenticated link JWT, so the device only sends runtime data):

1. **device:register** (device → worker on `mqtt/device/{factoryId}/requests`)
   ```jsonc
   {
     "type": "device:register",
     "values": {
       "runtime": {
         "model": "string",
         "os": "string",
         "version": "string"
       }
     }
   }
   ```

2. **device:pin-issued** (worker → device on `mqtt/device/{factoryId}/events`)
   ```jsonc
   {
     "type": "device:pin-issued",
     "values": {
       "pin": "string",
       "expiresAt": "ISO-8601",
       "factoryDeviceId": "string"
     }
   }
   ```

3. **device:claim** (user client → worker on `mqtt/web/{userId}/requests`)
   ```jsonc
   {
     "type": "device:claim",
     "values": {
       "pin": "string"
     }
   }
   ```

4. **device:claim-success** (worker → device scope only)
   ```jsonc
   {
     "type": "device:claim-success",
     "values": {
       "deviceId": "uuid",
       "accountId": "uuid",
       "apiKey": "string",
       "claimedAt": "ISO-8601"
     }
   }
   ```

5. **device:details** (device → worker on `mqtt/device/{deviceId}/events`)
   ```jsonc
   {
     "type": "device:details",
     "values": {
       "deviceId": "uuid",
       "hardware": {
         "model": "string",
         "serial": "string"
       },
       "software": {
         "os": "string",
         "version": "string"
       }
     }
   }
   ```

6. **device:details-updated** (worker → web scopes; worker joins stored metadata before broadcasting)
   ```jsonc
   {
     "type": "device:details-updated",
     "values": {
       "deviceId": "uuid"
     }
   }
   ```

7. **device:claim-failed**
   ```jsonc
   {
     "type": "device:claim-failed",
     "values": {
       "pin": "string",
       "reason": "expired | invalid | already-claimed",
       "retryAfter": "ISO-8601 | null"
     }
   }
   ```

## TODO

- Implement storage (TTL) for PINs + factory device metadata in Prisma/Zenstack with row-based security.
- Add end-to-end tests covering device register → user claim → device reconnect.
