# Sensor Module – Design Analysis and Flow

This document describes the **Figma Sensor design** (listing, detail, modals, alerts), how it maps to the current **Controller Radar** implementation, and the **claim flow** difference (device claim independent from RDM).

---

## 1. Design Overview (from Figma/PDF)

### 1.1 Listing Page

| Element | Design | Current implementation |
|--------|--------|------------------------|
| Page title | **Sensors** | (breadcrumb/context only) |
| Subtitle | View, filter, and manage all radar sensors | (none) |
| Search | Search by Device name | Search by Device name ✓ |
| Primary CTA | Register Device | Register Device ✓ |
| Table columns | Sensor Name, Location, Status, Last Seen, Actions | Same ✓ |
| Status labels | Online, Offline | Online, Offline, Maintenance ✓ |
| Row actions | Live Preview, View, Edit, Delete | Same ✓ |
| Filter | Connection Status, Location; Clear All, Apply | Same ✓ |
| Delete confirmation | Title + message, Cancel, Delete | Same ✓ |

### 1.2 Detail Page (“Devices Details”)

| Element | Design | Current implementation |
|--------|--------|------------------------|
| Page title | Devices Details | Sensor name only |
| Subtitle | View and manage this device's status, details, and activity. | View and manage this controller's status, details, and activity. |
| Header action | Edit Device | Configure |
| Info card title | Device Information | Controller Information |
| Info card subtitle | Key information about this device | Key information about this controller. |
| Fields | Device Name, Device Code, Connection Status, Location, Configuration Template, Alert Template, Created/Updated | Controller Name, Serial Number, Connection Status, Location, Firmware, Linked Device, Created/Updated |
| Tabs | Summary, Configuration, Analytics, Alert, Live Preview | Summary, Configuration, Live Preview (no Analytics, Alert) |

Design also includes: **Device Code** (e.g. 000 000), **Configuration Template** (e.g. Custom), **Alert Template** (e.g. Template 1). These may be new fields or placeholders for future templates.

### 1.3 Summary Tab

- **Real time Detection**: Last 24 hours of detection activity (No Data Available).
- **Zone Activity**: Detection distribution across zones (zone name + value).
- **Recent Events**: Last 10 detection events – Zone, Event Type, Dwell Time, Occurred Time.

Matches current structure; copy and labels should align with design.

### 1.4 Configuration Tab

- Visual Editor (drag/resize zones).
- Device Settings: Device Mode, Timezone, Path Tracking, Data Reporting Interval.
- Tracking Area: Left/Right Range, Forward Start Offset/Range, Computed Coordinates.
- Zones: up to 5 zones, Add Zone, Edit/Deactivate/Delete per zone.
- Modals: Deactivate Zone, Reactivate Zone, Delete Zone, Edit Zone, Add Zone (with position/size, computed bounds).

Current implementation has tracking area, zones, and dwell buckets; design adds Device Mode, Timezone, Path Tracking, and explicit zone Deactivate/Reactivate.

### 1.5 Analytics Tab (design)

- Session Logs, Summary Logs, Path Tracking (tables with date filter, Export Data).
- Can be implemented as placeholders or wired when backend is ready.

### 1.6 Alert Tab (design)

- Alert Rules: Sensor Offline Alert, No Data Alert, Dwell Time Alert (Enable, Threshold).
- Notification Channels: Email, Webhook.

Can be placeholders until alerting backend exists.

### 1.7 Modals and Alerts (design)

- **Filter**: Connection Status, Location dropdowns; Clear All, Apply.
- **Delete Sensor**: “Are you sure you want to delete this sensor? This action cannot be reversed.” Cancel, Delete.
- **Zone**: Deactivate / Reactivate / Delete / Edit / Add Zone modals with success and error toasts.
- **Delete Template** (if templates exist): “Are you sure you want to delete this template? This action can not be reverse.” Cancel, Delete.

---

## 2. Claim Flow: Design vs Current

### 2.1 Current flow (RDM-coupled)

1. User claims a **device** in **RDM / Devices** (e.g. via PIN in Devices or Preclaims).
2. Device appears in the account’s device list.
3. User goes to **Sensors** (Radar) → **Register Device**.
4. On “Register Radar Controller” page: **select an existing device** from dropdown, enter Sensor Name, Serial Number, Location, etc.
5. Submit creates **Controller** + **Sensor** for that device (one radar controller per device).

So today, **sensor registration depends on the device already being claimed in RDM**.

### 2.2 Design flow (claim independent from RDM)

From the Figma/PDF **“Add Device”** flow:

1. **Add Device** (or Register Device) opens a **multi-step** flow.
2. **Step 1**
   - **Device Registration Code *** (6-digit PIN, e.g. 000 000).
   - Help text: “Need help finding your device PIN?” / “The PIN is a 6-digit code displayed on your device during setup”.
   - **Sensor Name ***, **Location**.
   - Cancel, **Next**.
3. **Step 2**
   - **Configuration Template *** (e.g. Custom Configuration).
   - **Tracking Area**: X Min/Max, Y Min/Max.
   - **Zones**: Add Zone (e.g. Zone 1).
   - **Device Settings**: Device Mode (Live Preview), Timezone, Path Tracking, Dwell Threshold (e.g. 30 sec).
   - Back, Cancel, **Register**.
4. Success: “Device registered successfully!” (or error message).

So in the design, **claim happens inside the Sensor module** via the **Device Registration Code (PIN)**. The user does not have to go to RDM first; they can “Add Device” here and claim by PIN, then configure sensor and zones.

### 2.3 Implementation (claim independent from Devices)

- **Logic**: The Sensor module uses **PIN-based claim only**. The user does **not** select a device from the Devices module. Flow:
  - Resolve **FactoryDevice** by **Device Registration Code (PIN)** (`FactoryDevice.registrationPin`).
  - If the factory device is already claimed: use that Device for the current account only if it has no radar controller yet; otherwise return a clear error.
  - If not claimed: create a **Device** record, link it to the current account, set **FactoryDevice.claimedDeviceId**, then create **Controller** + **Sensor**.
- **Backend**: The create action accepts **pin** (required), name, serialNumber, location, etc. It resolves the device by PIN, applies device-limit checks when creating a new device, then creates Controller and Sensor.
- **UI**: Add Device is a 2-step flow: Step 1 = Device Registration Code (PIN) *, Sensor Name *, Location; Step 2 = Configuration Template, Tracking Area, Zones, Device Settings (placeholders). No device dropdown.

**Implemented:** Add Device uses PIN only; backend resolves FactoryDevice by PIN, creates or reuses Device, then Controller + Sensor (see §2.3 and Phase 2).

---

## 3. Figma → Design System Mapping

| Figma element | DS component | Notes |
|---------------|--------------|--------|
| Primary button (Register Device) | Button | variant="filled", color="primary", size="lg" |
| Outline filter button | Button | variant="outline", color="gray", icon Filter |
| Search input | InputField / TextField | type="search", prefixIcon Search |
| Table | DataTable | columns, sortable, paginated, moreMenu actions |
| Status badge | Badge | color success/gray/warning |
| Filter modal | Modal | title "Filter", Dropdown for Status + Location |
| Delete modal | Modal | type="error", title "Delete Sensor", confirm "Delete" |
| Card (Device Information) | Card | variant="default", radius="2xl" |
| Tabs | TabGroup | Summary, Configuration, Analytics, Alert, Live Preview |
| Edit/Configure button | Button | variant="filled", color="primary" |
| Zone modals | Modal | Deactivate / Reactivate / Delete / Edit / Add Zone |
| Toasts | toast.success / toast.error | For zone and template actions |

Use design tokens for colors, spacing, radius, typography (see `.cursorrules` and `WORKFLOW.md`).

---

## 4. Implementation Phases

1. **Phase 1 – UI alignment (no claim change)**  
   - Listing: title “Sensors”, subtitle, keep search/filter/table/Delete modal; use DS only.  
   - Detail: “Devices Details” title/subtitle, “Device Information” card, “Edit Device” button label, add Analytics and Alert tabs (placeholders if needed).  
   - New/Register: migrate to DS components; keep current “select device” flow.

2. **Phase 2 – Add Device (PIN-based) flow**  
   - Add 2-step “Add Device” flow (PIN + sensor name + location → Next; configuration + zones → Register).  
   - Backend: claim-by-PIN in Sensor module (resolve FactoryDevice by PIN; create or reuse Device, then Controller + Sensor).  
   - No “Register Device” select-existing-device path; claim is independent from the Devices module.

3. **Phase 3 – Configuration and alerts**  
   - Zone modals (Deactivate, Reactivate, Delete, Edit, Add) to match design copy and behavior.  
   - Alert tab and Configuration Template / Alert Template when backend supports them.

---

## 5. Add & Edit Device – UI/UX (from Add & Edit PDF)

### 5.1 Add Device (Register Device)

**Modal title:** Add Device.

**Step 1 (current implementation can show as single step until PIN flow exists):**

| Field | Design | Notes |
|-------|--------|-------|
| Device Registration Code * | 6-digit (e.g. 000 000) | Design: claim by PIN. Current: use Device dropdown (device already claimed). |
| Help text | “Need help finding your device PIN? The PIN is a 6-digit code displayed on your device during setup. For camera devices, the code may appear on the device's screen. If you can't find the code, try resetting the device.” | Show when PIN is used; for dropdown flow use: “Select a device already claimed to your account.” |
| Sensor Name * | Enter | Required. |
| Location | Enter | Optional. |
| Actions | Cancel, **Next** | Single-step current: Cancel, **Register**. |

**Step 2 (when 2-step is implemented):**

| Block | Fields |
|-------|--------|
| Configuration Template * | Custom Configuration (or Select from templates). |
| Tracking Area | X Min, X Max, Y Min, Y Max (Enter, unit m). |
| Zones | Add Zone; at least 1 zone (default name Zone 1, status Active). Max 5 zones. |
| Device Settings | Device Mode (Live Preview), Timezone (e.g. UTC GMT+0), Path Tracking (Enable movement path recording), Dwell Threshold (e.g. 30 sec). |
| Actions | Back, Cancel, **Register**. |

**Toasts:**

- Success: **“Device registered successfully!”**
- Error: **“Unable to register device. Please try again!”**

**Defaults (design):** At least 1 zone (Zone 1), zone status Active, Dwell default 0 seconds; when only one zone, unable to delete.

---

### 5.2 Edit Device

**Modal/dialog title:** Edit Device.

**Top-level fields (always visible):**

- **Sensor Name *** (prefilled).
- **Location** (Enter).

**Tabs:** **Configuration** | **Alert**.

**Configuration tab:**

- Configuration Template * (Custom or Select).
- Tracking Area: X Min, X Max, Y Min, Y Max.
- Zones: Add Zone, list of zones (max 5).
- Device Settings: Device Mode (Live Preview), Timezone, Path Tracking, Dwell Threshold.
- Actions: Cancel, **Save**.

**Alert tab:**

- Alert Template * (Custom or Select).
- Alert Rules: Sensor Offline Alert (threshold e.g. 5 min), No Data Alert (e.g. 30 min), Dwell Time Alert (Zone & threshold, e.g. 120 sec).
- Notification Channels: Email Notifications (address), Webhook (URL).
- Actions: Cancel, **Save**.

**Toasts:** Success/error for save (e.g. “Device updated” / “Unable to update device. Please try again!”).

**Zone rules (same as Add):** Max 5 zones; “Add Zone” disabled with tooltip when 5 zones; zone name required on save (error + warning if empty).

**Templates (design):** Custom always first; then default template (if set); then others alphabetically. Selecting a template auto-fills fields.

---

## 6. References

- **Logic and API**: [RADAR.md](../architecture/device/mqtt/controllers/RADAR.md) – controller config, MQTT mint, device flow.
- **Design system**: `src/lib/design-system/WORKFLOW.md`, `src/lib/design-system/components/index.ts`.
- **Project rules**: `.cursorrules` – DS components, tokens, no legacy paths.
- **Add & Edit PDF**: Source for Add Device (2-step, PIN, toasts) and Edit Device (Sensor Name, Location, Configuration | Alert tabs).
