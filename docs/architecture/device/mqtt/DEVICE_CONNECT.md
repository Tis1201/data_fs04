## Device Connection (post-claim)

This document describes how a **claimed device** should connect to FS04 over
MQTT using its `deviceId` and API key.

> Note: this is the target behavior. The claim flow is implemented
> (see `DEVICE_CLAIM.md`); the device-connect mint endpoint will follow this
> contract.

---

## 1. Minting a device link JWT

Once a factory device has been claimed, the backend issues a real `Device`
record with:

- `id` – the `deviceId` used for subsequent connections
- `apiKey` – the secret used to authenticate the device

To connect over MQTT, the device (or a provisioning script) **exchanges**
`{ deviceId, apiKey }` for a short-lived **link JWT** and broker URL, via a
mint endpoint (to be implemented), for example:

- `POST /api/device/mqtt/mint`

Request:

```jsonc
{
  "deviceId": "<deviceId>",
  "apiKey": "<apiKey>"
}
``

Response:

```jsonc
{
  "brokerUrl": "wss://mq.datarealities.com/mqtt",
  "jwt": "<link-jwt>"
}
```

The link JWT has a subject and claims similar to:

- `sub = device:<deviceId>`
- `scope = device:mqtt`
- `exp` = short expiry window (e.g. 15 minutes)

The device uses:

- MQTT **username** = `sub` (e.g. `device:cmi123...`)
- MQTT **password** = the link JWT

Broker ACLs then map `sub` to the allowed device topics.

---

## 2. Device topics after claim

For a claimed device with id `<deviceId>`, topics are:

- RPC-style:
  - `device/device:<deviceId>/requests`
  - `device/device:<deviceId>/response`

- Notification-style:
  - `device/device:<deviceId>/notifications`

In practice, most flows follow the same pattern used by the factory link:

1. Device sends RPCs (e.g. telemetry requests) on
   `device/device:<deviceId>/requests` and reads responses on
   `device/device:<deviceId>/response`.
2. Worker sends notifications on `device/device:<deviceId>/notifications`
   (e.g. configuration updates, commands). When a reply is needed, the device
   responds with an RPC on the `.../requests` topic, using signed tickets as
   described in `DEVICE_MQTT.md`.

The exact set of RPC operations and notifications for post-claim device
management will be documented as they are implemented.
