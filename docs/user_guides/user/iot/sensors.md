# Sensors (Radar)

**Last Updated**: 2025-03-27  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

**Sensors** lists all **radar sensors** tied to your account. Each sensor is backed by a physical device that has been registered and linked to a controller. From here you can search and filter sensors, register new devices with a PIN, open a sensor’s detail page to edit layout and settings, and remove sensors you no longer need.

## Prerequisites

- Access to the user portal with your account selected  
- For **Register Device**: a valid **6-digit registration code (PIN)** from the physical device  

## Navigation

- **Menu**: **IoT Management** → **Sensors**
- **URL**: `/user/controllers/radar`

The page title in the app is **Sensors**, with the subtitle *View, filter, and manage all radar sensors*.

## Core functionality

### Sensor list

- **Search** — Find sensors by name, serial number, ID, description, or location (debounced; updates the URL).
- **Sort & pagination** — Sort columns and move between pages; state is reflected in the URL for sharing or bookmarking.
- **Row click** — Opens **Device Details** for that sensor (`/user/controllers/radar/[controllerId]`), where you can view status, zones, tracking area, and related actions.
- **Real-time connection** — Device online/offline status can update from live presence (MQTT) when available.

### Filters

Open **Filter** to narrow the list:

- **Connection status** — e.g. Active, Inactive, Maintenance (aligned with the sensor’s configured status).
- **Location** — One or more locations that exist on your sensors.

Use **Clear All** to reset selections in the modal, then **Apply** to update the list. Filters are stored in the URL query string.

### Register Device (add a sensor)

1. Click **Register Device**.
2. Complete the **Add Device** flow:
   - Enter the device **PIN** (6-digit registration code from the device).
   - Provide sensor metadata (name, location, description, etc.).
   - Configure initial **tracking area**, **zones**, and device options (e.g. timezone, path tracking, dwell threshold) as prompted.
3. The app uses the same **device claim** flow as other IoT enrollment: the device receives credentials and connects.
4. On success, a radar sensor is created for the claimed device and you are taken to that sensor’s **Device Details** page.

If the PIN is wrong or expired, you will see an error and can correct the PIN on step 1.

### Delete a sensor

From the row actions, you can delete a sensor (with confirmation). Deletion is permanent for that sensor record; ensure you no longer need the sensor in the account.

### Open from device workflows

Other pages (for example device editing) may link here with query parameters such as `editSensorId` to focus a specific sensor in the UI.

## Related features

- **[Templates](./templates.md)** — Reusable alert and configuration templates you can assign to sensors.
- **[Data](./data.md)** — Session logs and path tracking for radar analytics.
- **[API Keys](./api_keys.md)** — Account keys for programmatic access to sensor-related APIs (where enabled).
- **[Devices](../devices.md)** — RDM “All Devices” and device detail for general device management; radar sensors are a specialized path under IoT Management.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| PIN rejected | Confirm the 6-digit code, that the device is allowed to register, and that the code has not expired. |
| Sensor not in list | Check filters and search; confirm the device completed registration. |
| Status seems wrong | Refresh the page; connectivity depends on network and device connectivity. |

---

**Status**: Describes the Sensors listing and registration flow as implemented in the user app.
