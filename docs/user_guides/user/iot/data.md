# Data (Radar analytics)

**Last Updated**: 2025-03-27  
**Audience**: End Users  
**Complexity**: Intermediate

## Overview

**Data** is the analytics view for **radar sensors**: historical **session logs** and **path tracking** data. Use it to review visits, dwell time, zones, and paths within a selected time range, filter by sensor, search, sort, paginate, and export when your permissions allow.

## Prerequisites

- Sensors producing radar/session data for your account  
- Data retention and features as configured for your environment  

## Navigation

- **Menu**: **IoT Management** → **Data**
- **URL**: `/user/analytics/radar`

The page title is **Data**, with the subtitle *View and export sensors data logs*.

## Tabs

### Session Logs

Shows **session-level** radar events (for example session identifier, sensor name, start time, duration, zone dwell summary, timezone, proximity). Data is loaded for the **selected date range** and supports:

- **Search** — Narrow rows by relevant fields (wired to the session API).
- **Sort** — Column sorting maps to backend fields (e.g. sensor name, start time, duration).
- **Pagination** — Page through results.

### Path Tracking

Shows **path** / coordinate-style tracking rows for the same overall filters (implementation loads via `/api/sensor-data/...` style endpoints in the app). Use **Preview** (if shown) to inspect a row’s raw details in a modal.

> **Note:** A **Summary Logs** tab may exist in code but can be hidden in the UI; if you only see Session Logs and Path Tracking, use those.

## Filters and date range

Open **Filter** to set:

- **Sensor** — Often labeled in the UI as device/sensor selection; restrict logs to one sensor or view **All**.
- **Range** — Typically **Current week**, **Current month**, or **Custom** (From / To dates).

The app builds **start** and **end** timestamps from your choice. For **Custom**, you must pick both **From** and **To** or the app may ask you to complete the range.

Range and sensor selections are reflected in the URL (e.g. `sensorId`, `range`, `startTime`, `endTime`, `tab`) so you can bookmark or share a view.

## Export

Use **Download** / export where available to export the current tab’s dataset according to your organization’s export rules (format and limits may vary).

## Related features

- **[Sensors](./sensors.md)** — Ensure devices are online and configured so data appears here.
- **[API Keys](./api_keys.md)** — Programmatic access to sensor logs may use account API keys on supported endpoints.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Empty results | Widen the date range; clear sensor filter to **All**; confirm the sensor has reported data in that period. |
| “Select a date range” error | For **Custom**, set both start and end dates; for preset ranges, re-open Filter and **Apply**. |
| Export fails | Retry after a shorter range; check network; contact support if exports are restricted. |

---

**Status**: Reflects the Data (radar analytics) UI: session logs, path tracking, filters, and export.
