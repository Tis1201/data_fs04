# Radar Controller – End-to-End Testing Guide

This guide describes how to test the radar controller flow using the Node emulator and the User Radar UI so that **Live Sensor Preview** and configuration (tracking area, zones, dwell buckets) work correctly.

## Architecture Summary

- **Web UI** (`/user/controllers/radar`): User registers a radar controller (linked to a device), opens controller detail, configures sensor (tracking area, zones, dwell buckets), and uses **Live Sensor Preview** to stream radar data.
- **Worker**: Handles RPC `sensor.preview.start` / `sensor.preview.stop`, sends notifications to the controller on MQTT, and forwards controller data frames to the user’s notification topic.
- **Emulator (device)**: Simulates the device (heartbeat, presence). Run with `npm run dev` in `fs04_device/emulators/node`.
- **Emulator (radar controller)**: Connects with controller-scoped MQTT, subscribes to `device:<deviceId>/controller/radar:<controllerId>/notifications`, and publishes simulated point-cloud data on `.../data` when preview is started. Run with `npm run radar:controller` in the same repo.

Data flow: **User → RPC (sensor.preview.start) → Worker → Controller notification (preview.start) → Emulator publishes frames to .../data → Worker forwards to user/.../notifications → RadarPreview renders.**

## Prerequisites

- **fs04_web**: Dev server and MQTT worker (e.g. `npm run dev`; worker subscribes to controller topics).
- **EMQX** (or configured MQTT broker): Running and configured for JWT auth (same keys as app’s LINK JWT).
- **fs04_device/emulators/node**: Dependencies installed, `.env` with `API_SERVER_URL` and (for device) `SAMPLE_DEVICE_FACTORY_JWT_TOKEN`.

See also: `fs04_device/TODO/EMULATOR_SETUP.md`.

## Step-by-Step Test Flow

### 1. Start the web app and worker

```bash
cd fs04_web
npm run dev
```

Ensure the MQTT worker connects and subscribes (e.g. to `+/controller/+/data`). Check logs for subscription success.

### 2. Run the device emulator (claimed device)

```bash
cd fs04_device/emulators/node
npm run dev
```

- First time: use the displayed PIN to claim the device in the web app (e.g. User/Admin → Devices → Add Device with PIN). After claim, the emulator writes `workings/claimed.json` and reconnects.
- In the UI, confirm the device is **Online**.

### 3. Register a radar controller in the UI

1. Go to **User → Controllers → Radar** (or equivalent radar/sensor section).
2. Open **Register Radar Controller** (e.g. “New” or “Register Controller”).
3. Select the **device** you just claimed (dropdown must list it).
4. Fill **Sensor name** and **Serial number**, then submit.
5. Confirm the new controller appears in the list and is linked to that device.

### 4. Run the radar controller emulator (optional but required for live data)

Using the **same** device and the controller you just created:

```bash
cd fs04_device/emulators/node
npm run radar:controller
```

- The script uses `workings/claimed.json` (device id + API key) and, if present, `workings/controller/radar.json` (controller id). If you did not run the radar controller before, it will call `GET /api/device/controller?type=radar` to fetch/create the controller and can persist it to `workings/controller/radar.json`.
- Check logs for: connected, subscribed to `.../notifications`, and “Radar controller is online and listening for commands”.

If you see **“Bad User Name or Password”** or **“Not authorized”**, see `fs04_device/TODO/EMULATOR_SETUP.md` (Troubleshooting). Typical fixes: EMQX JWT auth aligned with app, different clientId per connection, correct `MQTT_BROKER_URL_EXTERNAL`.

### 5. Open controller detail and test Live Sensor Preview

1. In the radar controllers list, open the **controller detail** page (e.g. click the controller you registered).
2. Confirm the page shows:
   - Controller and linked device info.
   - **Sensor configuration** (tracking area, zones, dwell buckets).
   - **Live Sensor Preview** (only if a device is linked).
3. In Live Sensor Preview:
   - Click **Start Preview**. The UI sends `sensor.preview.start` RPC; the worker sends a `preview.start` notification to the controller; the emulator should log “Starting preview stream” and begin publishing frames.
   - You should see:
     - Status “Live • N frames” and increasing frame count.
     - Points on the radar canvas (and optional tracking area/zones overlay if configured).
     - Countdown if a duration was set.
   - Click **Stop Preview** (or wait for duration). The stream stops and the emulator logs “Stopping preview stream”.

If no frames appear:

- Ensure the **radar controller emulator** is running (`npm run radar:controller`).
- Ensure the **device** is the one linked to this controller and was online when you started preview.
- Check worker logs for “Received /data message” on `device:.../controller/radar:.../data` and for any ticket/session errors in the preview data handler.
- Check browser console for MQTT connection and RPC response (sessionId, flowId) and for incoming `preview.data` notifications.

### 6. Test sensor configuration (tracking area, zones, dwell buckets)

1. On the same controller detail page, click **Configure** (or open the sensor config dialog).
2. **Tracking area**: Set name and bounds (start/end X,Y). Save. Confirm the card shows “Configured” and the overlay in Live Preview (if enabled) matches.
3. **Zones**: Add up to 5 zones (name, zone number, bounds, optional color). Save. Confirm they appear in the config summary and on the preview overlay.
4. **Dwell buckets**: Add buckets (name, min/max duration). Save. Confirm they appear in the config summary.

If the emulator is running and the app sends config updates over MQTT, the emulator may log “Config update received” and re-fetch config from the API (see RADAR.md and SENSOR_PREVIEW.md in `docs/architecture/device/mqtt/controllers/`).

## Verification Checklist

| Step | What to check |
|------|----------------|
| Device online | Device appears Online in UI; emulator logs heartbeat or “Device MQTT client connected”. |
| Register controller | Controller created and linked to device; no “Account is required” or “Device is required” errors. |
| Radar emulator | `npm run radar:controller` connects and subscribes to controller notifications. |
| Start Preview | RPC succeeds; emulator logs “Starting preview stream”; UI shows “Live • N frames” and points. |
| Data flow | Worker receives messages on `.../data`; user receives `preview.data`; canvas updates. |
| Stop Preview | Stream stops; emulator logs “Stopping preview stream”. |
| Config | Tracking area, zones, dwell buckets save and display correctly; overlay in preview matches. |

## Related Docs

- **fs04_device**: `TODO/EMULATOR_SETUP.md` – emulator setup, claiming, radar controller run, troubleshooting.
- **fs04_web**:  
  - `docs/architecture/device/mqtt/controllers/RADAR.md` – controller config and MQTT.  
  - `docs/architecture/device/mqtt/controllers/SENSOR_PREVIEW.md` – preview start/stop and data relay (ticket-based routing).

## Troubleshooting (short)

- **Preview does not start**: MQTT connected in browser? RPC response has `sessionId` and `flowId`? Worker subscribed to `+/controller/+/data`?
- **No frames in UI**: Is the radar controller emulator running and receiving `preview.start`? Check worker logs for “Received /data message” and ticket verification.
- **“Bad User Name or Password” (radar emulator)**: See EMULATOR_SETUP.md (JWT auth, username/clientId, broker URL).
