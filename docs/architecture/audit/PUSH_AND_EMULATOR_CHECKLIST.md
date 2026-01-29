# Push & Emulator Checklist

**Purpose:** Confirm that current changes can be pushed without affecting the old app, and what to push in fs04_device so the Node emulator can test the new features.

---

## 1. fs04_web – Can you push without affecting the old app?

**Yes**, with the following understanding:

| Area | Old logic preserved? | What was added only |
|------|----------------------|----------------------|
| **Device actions** | pushFile still requires `sourcePath` + `destinationPath` unless `resourceId` is present (exception only for new flow). pullFile requires `sourcePath`; destinationPath optional. | New actions: `pin_apps`, `unpin_app`. Broadcast initial status. installApp LOCAL URL + packageName fix. Screenshot upload URL. |
| **ClickHouse device apps** | Service **throws** on query failure again (API returns 5xx). | `isAvailable()`, `insertDeviceAppReport()`, lazy init. When ClickHouse not configured, API returns 200 + empty (handled in route). |
| **Deployments API** | New endpoint; no change to existing APIs. | Access control aligned with device actions (owner or account member). |
| **Other** | No removal or change of existing validation/error behaviour beyond what was reverted above. | New: apps/report, pin API, audit doc, clickhouse-init-device-apps-only.sql, etc. |

**Recommendation:** Push **redesign-phase-2** (or your feature branch). Old app = whatever is on the branch you merge into (e.g. feature/mqtt-replace or main). We did not change that behaviour; only added new behaviour and fixed install flow / pushFile exception.

---

## 2. fs04_device – What to push so the emulator can test

The **Node emulator** (`emulators/node/`) has local changes that are **required** to test the new fs04_web features (install app, uninstall, pin/unpin, app list from ClickHouse).

### 2.1 Changes in fs04_device (current branch: `refactor/migrate_to_emqx`)

| File | Role for testing |
|------|-------------------|
| **emulators/node/devices/claimed.ts** | Handles `device:actionRequest` (installApp, uninstall, pin_apps, unpin_app). POSTs to `/api/devices/:id/status` and `/api/devices/:id/apps/report`. Keeps `installedApps` and reports them so GET apps (ClickHouse) shows data. |
| **emulators/node/device.ts** | May have changes for notification routing (e.g. device:actionRequest). |
| **emulators/node/main.ts** | Passes `API_SERVER_URL` into claimed device (apiBaseUrl). |

### 2.2 Do you need to push fs04_device?

**Yes, if:**

- You want the same emulator behaviour for others or on another machine (e.g. CI, teammate).
- You use a remote branch to run the emulator.

**No, if:**

- You only run the emulator locally and are fine with uncommitted changes.

### 2.3 What to push in fs04_device

1. **Commit and push the emulator changes** on your current branch (e.g. `refactor/migrate_to_emqx`):
   - `emulators/node/devices/claimed.ts` (handleActionRequest, installApp, uninstall, pin_apps, unpin_app, apps/report, apiBaseUrl/apiKey, installedApps, HTTP heartbeat).
   - `emulators/node/device.ts` (if it has notification-type or routing changes).
   - Any other modified files under `emulators/node/` that the claimed device depends on.

2. **Do not commit** (add to .gitignore if needed):
   - `device`, `main` (binaries)
   - `CLAIM_FILE` / claim state files (local only)
   - `node_modules` (already ignored)

3. **Optional:** Add or update `emulators/node/README.md` with:
   - `API_SERVER_URL` (e.g. `http://localhost:5173` for local fs04_web).
   - That the emulator calls `/api/devices/:id/apps/report` and `/api/devices/:id/status` for action status.

### 2.4 How to test with the emulator

1. **fs04_web:** Run and push (or run locally) the branch that has:
   - `POST /api/devices/[id]/actions` (installApp, uninstall, pin_apps, unpin_app),
   - `POST /api/devices/[id]/apps/report`,
   - `GET /api/v2/devices/[id]/apps-with-pins` (or equivalent).

2. **fs04_device (Node emulator):**
   - Set `API_SERVER_URL` to your fs04_web base URL (e.g. `http://localhost:5173`).
   - Run the emulator (e.g. `npm run dev` or `ts-node main.ts` in `emulators/node/`).
   - Use a claimed device (claim file with deviceId, apiKey, accountId).

3. **In the UI:** Open the device, install app, uninstall, pin/unpin. The emulator should:
   - Receive `device:actionRequest` via MQTT,
   - POST status to `/api/devices/:id/status`,
   - POST app list to `/api/devices/:id/apps/report` (install/uninstall),
   - So that the “Installed apps” list (from ClickHouse) updates.

---

## 3. Summary

| Repo | Push? | Notes |
|------|--------|------|
| **fs04_web** | Yes | Old logic preserved; only additive + fixes. Safe to push redesign-phase-2 (or your branch). |
| **fs04_device** | Yes, for emulator testing | Push `emulators/node` changes (claimed.ts, device.ts, main.ts as needed) so the emulator supports install/uninstall/pin/unpin and apps/report. Ignore binaries and local state files. |

After both are pushed (and fs04_web is deployed or run locally), you can use the Node emulator to test install app, uninstall, pin/unpin, and the installed apps list.
