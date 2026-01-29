# Branch vs feature/mqtt-replace: Business Logic Audit

**Purpose:** Identify changes in **redesign-phase-2** (current branch) that may affect business logic or diverge from **feature/mqtt-replace** when merging.

**Principle:** Do not change old logic; only add new behaviour needed for features to work. Preserve existing validation and error behaviour where possible.

**Baseline:** `feature/mqtt-replace` (MQTT-based actions, device.connected for online check, installApp/pushFile/pullFile with signed URLs).

**Audit date:** Based on diff from `redesign-phase-2` to `feature/mqtt-replace`.

---

## 1. Device Actions API (`/api/devices/[id]/actions`)

All changes below are **additions or refinements** on top of feature/mqtt-replace. No removal of MQTT or change of online check (feature/mqtt-replace already uses MQTT and `device.connected`).

### Additions (redesign-phase-2 only)

| Change | Impact | Docs / notes |
|--------|--------|--------------|
| **New actions: `pin_apps`, `unpin_app`** | New action types for pin/unpin. | Align with `docs/architecture/device/PIN_APP_DATA.md`, pin rules. |
| **Broadcast initial status** | After creating action log, `broadcastDeviceActionUpdate` is called with status `initiated` so UI updates immediately. | Ensures UI shows “initiated” without waiting for device reply. |
| **Screenshot: presigned upload URL** | Server generates presigned upload URL for screenshot action (like getLogs). | Device uploads screenshot to storage; same pattern as get_logs. |

### Refinements (redesign-phase-2 only)

| Change | feature/mqtt-replace | redesign-phase-2 | Risk |
|--------|----------------------|-------------------|------|
| **pushFile requiredFields** | `['sourcePath', 'destinationPath']` | `[]`; validated as “must have sourcePath or resourceId”. | **Low.** Allows pushFile with resourceId only; destinationPath optional (device uses Downloads). |
| **pullFile requiredFields** | `['sourcePath', 'destinationPath']` | `['sourcePath']`; destinationPath server-generated. | **Low.** Same behaviour as feature/mqtt-replace intent; only validation relaxed. |
| **installApp packageName** | `payload.packageName \|\| packageName` (from resource). | Always use resource-derived `packageName` so frontend placeholder `"-"` is replaced. | **Fix.** Prevents `packageName: "-"` in MQTT payload. |
| **installApp download URL (LOCAL)** | Only GCloud signed URL. | If `convertGCloudUrlToSignedDownloadUrl` returns null and `resource.path` is local (e.g. `/uploads/iot/xxx.apk`), build full URL from `PUBLIC_APP_URL` + path. | **Fix.** Enables installApp when storage is LOCAL (e.g. dev) without GCloud. |
| **Log message wording** | e.g. `installApp`, `pushFile`. | e.g. `install_app`, `push_file` (snake_case). | Cosmetic only. |

**Conclusion:** Actions API changes vs feature/mqtt-replace are additive and fixes; no breaking change to existing behaviour.

---

## 2. Device App Service (ClickHouse)

All changes below are **on redesign-phase-2**; feature/mqtt-replace does not have them.

| Change | Impact | Notes |
|--------|--------|--------|
| **Lazy ClickHouse client** | Client created on first use. | Avoids init at import; no behaviour change. |
| **`isAvailable()`** | Callers can check if ClickHouse is configured. | Enables “no ClickHouse” handling in API. |
| **`insertDeviceAppReport()`** | Server can write app list into `logs_raw` (e.g. for emulator). | Emulator can report apps so GET apps returns data from ClickHouse, same as production. |
| **On query failure** | **Restored:** service throws on query failure (API returns 5xx). | Old behaviour preserved. When ClickHouse is not configured, API routes use `isAvailable()` and return 200 + empty (additive for dev). |

**Recommendation:** If production must treat “ClickHouse down” as a hard error, consider 503/500 when ClickHouse is configured but unavailable.

---

## 3. Action Log Hooks (new file)

| Change | Impact |
|--------|--------|
| **`actionLogHooks.ts`** | Prisma hooks on `DeviceActionLog` create/update: assign sequence number (if missing), then broadcast via `ActionLogEventBroadcaster` (MQTT). |

**Note:** Not in feature/mqtt-replace. Ensures UI receives action log updates in real time. Aligns with MQTT flow.

---

## 4. Device Deployments API (`/api/devices/[id]/deployments`)

**New file on redesign-phase-2** (does not exist on feature/mqtt-replace).

| Item | Status |
|------|--------|
| **Access control** | **Fixed in audit:** Same rule as device actions — allow ADMIN, or owner (`createdBy`), or member of device’s account (`account.members`). Device query includes `account: { members: { select: { userId: true } } }`. |
| **Behaviour** | GET deployments for a device; pagination, optional status filter. No conflict with feature/mqtt-replace (new endpoint). |

---

## 5. Summary Checklist (vs feature/mqtt-replace)

- [x] **Deployments API** – Access control aligned with device actions (owner or account member).
- [x] **Device actions** – Additions (pin_apps, unpin_app, broadcast initial status, screenshot URL, installApp LOCAL + packageName fix) are consistent with docs; no regression.
- [x] **ClickHouse app service** – Old behaviour preserved: throw on query failure (5xx). Empty list only when `isAvailable()` is false (handled in API route).
- [ ] **Pin/unpin** – Ensure device/MQTT side and docs describe `pin_apps` / `unpin_app` payload and behaviour.

---

## 6. References

- **Baseline branch:** `feature/mqtt-replace`
- Device access: same rule as `src/routes/api/devices/[id]/actions/+server.ts` (owner or account member).
- Pin: `docs/architecture/device/PIN_APP_DATA.md`, user_guides pin_rules.
- MQTT notifications: `docs/architecture/device/mqtt/DEVICE_NOTIFICATION_REPLY.md` (or equivalent).
