## IoT Core local configuration

These environment variables wire `fs04_web` to the local MQTT broker and the
fs04_iot_core service. They are typically set in your `.env.local` when
running the full stack locally.

```env
MQTT_BROKER_URL=ws://localhost:8080
IOT_CORE_BASE_URL=http://localhost:5174
IOT_CORE_API_KEY=sk_test_your_iot_core_api_key_here
```

- **MQTT_BROKER_URL**: WebSocket URL for the MQTT broker that devices, users
  and the worker connect to (the `/mqtt` path is added by the clients if
  missing).
- **IOT_CORE_BASE_URL**: Base URL of the `fs04_iot_core` service providing the
  `/api/mq/mint` endpoint.
- **IOT_CORE_API_KEY**: API key used by `fs04_web` to call IoT Core minting.
  Use a real secret only in local `.env` files or secret stores, not in
  committed documentation.

---

## What is fs04_iot_core?

`fs04_iot_core` is a separate service that acts as the **MQTT credential and
ACL authority** for FS04. It owns the keys and logic for minting short-lived
JWTs that MQTT clients use as passwords.

High level responsibilities:

- Issue MQTT JWTs via `POST /api/mq/mint`.
- Encode the MQTT subject and ACL into the token payload
  (allowed `pub_topics` / `sub_topics`).
- Centralize signing keys so `fs04_web` and the worker never need to hold
  broker keys directly.

See `DEVICE_MQTT.md` for how these credentials are used on the MQTT side.

---

## How fs04_web integrates with IoT Core

`fs04_web` never signs MQTT JWTs itself. Instead it calls IoT Core from a few
places using the shared helper `mintIoTCoreCredentials`:

- **Factory mint** – `POST /api/device/mqtt/mint/factory`
  - Authenticates a factory JWT from the DB-backed `FactoryToken`.
  - Calls IoT Core with `username = factory:<factoryDeviceId>` and the
    factory pub/sub topic set.

- **User mint** – `POST /api/user/mqtt/mint`
  - Authenticates a web session (Lucia) and derives `user:<userId>:<accountId>`.
  - Calls IoT Core with that subject and user topic ACLs.

- **Device mint** – `POST /api/device/mqtt/mint`
  - Uses `restrictDevice` + the device `apiKey` to load the `Device`.
  - Calls IoT Core with `username = device:<deviceId>` and the claimed-device
    pub/sub topics (`requests|response|notifications|replies|loopback`).

All three endpoints normalize their responses with
`buildMqttMintPayload({ brokerUrl, clientId, token, username, ... })` so the
returned JSON shape is consistent.

---

## How the MQTT worker uses IoT Core

The MQTT worker also obtains its own credentials from IoT Core:

- On startup it calls the same mint helper with a worker identity like
  `server:fs04-worker` and broad topic ACLs (see `DEVICE_MQTT.md`).
- It uses the returned `clientId` and `jwt` to connect to the broker pointed
  to by `MQTT_BROKER_URL`.
- After connecting, it subscribes to the shared device/user topics (e.g.
  `$share/server_10/device/+/requests|replies|events`) and processes:
  - raw JSON RPCs on `.../requests`;
  - ticket-driven replies on `.../replies`, which are turned into
    notifications for users/devices.

This keeps MQTT connectivity and authorization **centralized in IoT Core**
while allowing `fs04_web` and the worker to stay focused on domain logic.
