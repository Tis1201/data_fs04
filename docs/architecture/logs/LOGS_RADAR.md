# Radar Log Formats (SENSOR_RADAR)

> [!IMPORTANT]
> This document defines the CSV payload schemas for `log_type=SENSOR_RADAR`. All payloads **MUST** adhere to the [L-notation standard](file:///Users/bernard/CascadeProjects/fs04/fs04_web/docs/architecture/logs/LOGS.md) established in the main LOGS.md document.

---

## 1. Standard Header (L1–L4) — Required

All `SENSOR_RADAR` logs share these mandatory columns:

| L-Index | Column | Name | Type | Description |
|---------|--------|------|------|-------------|
| **L1** | `c10` | `log_type` | `String` | Always `SENSOR_RADAR` |
| **L2** | `c11` | `log_type_version` | `String` | Payload sub-type + version (e.g., `session_log:1.0`) |
| **L3** | `c12` | `log_creation_time` | `DateTime` | Event timestamp (**UTC**) |
| **L4** | `c13` | `timezone_offset` | `Int16` | Device local offset from UTC in minutes (e.g., `480` = UTC+8) |

> [!NOTE]
> **Sub-typing Convention**: Since `SENSOR_RADAR` covers multiple payload types (session logs, path tracking, etc.), we encode the sub-type in L2 as `<sub_type>:<version>`. This avoids needing separate `log_type` values for each radar event kind.

---

## 2. Session Log (`session_log`)

Records a complete target session (one person entering and exiting the tracking area).

### Schema: `session_log:1.0`

| L-Index | Column | Name | Type | Req | Description |
|---------|--------|------|------|-----|-------------|
| L1 | c10 | `log_type` | String | ✅ | `SENSOR_RADAR` |
| L2 | c11 | `log_type_version` | String | ✅ | `session_log:1.0` |
| L3 | c12 | `log_creation_time` | DateTime | ✅ | Event timestamp (**UTC**) |
| L4 | c13 | `timezone_offset` | Int16 | ✅ | Device local offset (minutes) |
| **L5** | c14 | `timezone_label` | String | ✅ | IANA timezone (e.g., `America/New_York`) |
| **L6** | c15 | `sensor_id` | String | ✅ | Radar controller identifier |
| **L7** | c16 | `sensor_name` | String | ✅ | Radar display name |
| **L8** | c17 | `mac_address` | String | ✅ | Radar hardware MAC |
| **L9** | c18 | `target_id` | String | ✅ | UUID for this tracking session |
| **L10** | c19 | `dwell_tracking_area_sec` | Float32 | ✅ | Total time in tracking area (seconds) |
| **L11** | c20 | `zone_dwell_times_json` | String | ⚪ | JSON object of zone dwell times (`{}` if none) |
| **L12** | c21 | `proximity_m` | Float32 | ⚪ | Closest approach distance (meters) |

#### Example Payload

```csv
SENSOR_RADAR,session_log:1.0,2025-07-12T18:32:45Z,480,America/New_York,radar-001,Lobby Entrance,00:1A:2B:3C:4D:5E,550e8400-e29b-41d4-a716-446655440000,3.2,"{""Entrance"":1.8,""PromoArea"":0.7}",0.85
```

#### Notes

- One row = one person/target session (entry → exit).
- `zone_dwell_times_json` contains dwell times for user-defined zones (up to 5). If no zones are defined, value is `{}`.
- `proximity_m` is optional; omit or leave empty if sensor doesn't support it.

---

## 3. Path Tracking (`path_tracking`)

Records individual position samples during a target's session. **Multiple rows per target.**

### Schema: `path_tracking:1.0`

| L-Index | Column | Name | Type | Req | Description |
|---------|--------|------|------|-----|-------------|
| L1 | c10 | `log_type` | String | ✅ | `SENSOR_RADAR` |
| L2 | c11 | `log_type_version` | String | ✅ | `path_tracking:1.0` |
| L3 | c12 | `log_creation_time` | DateTime | ✅ | Sample timestamp (**UTC**) |
| L4 | c13 | `timezone_offset` | Int16 | ✅ | Device local offset (minutes) |
| **L5** | c14 | `timezone_label` | String | ✅ | IANA timezone (e.g., `America/New_York`) |
| **L6** | c15 | `sensor_id` | String | ✅ | Radar controller identifier |
| **L7** | c16 | `sensor_name` | String | ✅ | Radar display name |
| **L8** | c17 | `mac_address` | String | ✅ | Radar hardware MAC |
| **L9** | c18 | `target_id` | String | ✅ | UUID linking to session |
| **L10** | c19 | `x_m` | Float32 | ✅ | X coordinate (meters) |
| **L11** | c20 | `y_m` | Float32 | ✅ | Y coordinate (meters) |

#### Example Payload (3 samples for same target)

```csv
SENSOR_RADAR,path_tracking:1.0,2025-07-12T18:32:42Z,480,America/New_York,radar-001,Lobby Entrance,00:1A:2B:3C:4D:5E,550e8400-e29b-41d4-a716-446655440000,1.1,3.2
SENSOR_RADAR,path_tracking:1.0,2025-07-12T18:32:43Z,480,America/New_York,radar-001,Lobby Entrance,00:1A:2B:3C:4D:5E,550e8400-e29b-41d4-a716-446655440000,1.2,3.3
SENSOR_RADAR,path_tracking:1.0,2025-07-12T18:32:44Z,480,America/New_York,radar-001,Lobby Entrance,00:1A:2B:3C:4D:5E,550e8400-e29b-41d4-a716-446655440000,1.2,3.4
```

#### Notes

- High-frequency log (10+ Hz typical). **Batch uploads recommended**.
- No Z-axis in v1.0. Future `path_tracking:1.1` may add L10=`z_m`.
- `target_id` links path samples to the corresponding `session_log` entry.

---

## 4. Critical Review & Issues

> [!CAUTION]
> **Original Format Had Significant Problems**

### 4.1 Non-Compliance with L-Notation Standard

The original draft ignored the established L-notation pattern:

| Issue | Original | Correct |
|-------|----------|---------|
| Missing `log_type` (L1) | Started with custom fields | L1 must be `SENSOR_RADAR` |
| Missing `log_type_version` (L2) | Version embedded in header label | L2 must be version string |
| Missing `timezone_offset` (L4) | Used timezone string `America/New_York` | L4 must be integer minutes |
| Organization ID in payload | `organization_id` column | Comes from JWT claims (c2), not CSV |

### 4.2 JWT vs. Payload Confusion

The original included `organization_id` in the CSV body. **This is wrong.** Per [LOGS.md](file:///Users/bernard/CascadeProjects/fs04/fs04_web/docs/architecture/logs/LOGS.md):

- `account_id` (organization) comes from JWT claims → injected as `c2`
- `device_id` comes from JWT claims → injected as `c4`
- Log posters **cannot** control these values; they are pipeline-injected

### 4.3 Timezone Format

| Original | Correct |
|----------|---------|
| `America/New_York` (string) | `480` (Int16, minutes from UTC) |

Using timezone strings requires runtime IANA database lookups. Integer offsets are simpler and match the existing convention.

### 4.4 Recommended Fixes Applied

| Fix | Status |
|-----|--------|
| Prefixed all rows with `SENSOR_RADAR` (L1) | ✅ |
| Added version as L2 (`session_log:1.0`, `path_tracking:1.0`) | ✅ |
| Converted timezone to integer offset (L4) | ✅ |
| Removed `organization_id` (comes from JWT) | ✅ |
| Aligned column indices with L-notation | ✅ |

---

## 5. ClickHouse Routing

These logs route to the `radar` table via the `log_type=SENSOR_RADAR` filter in the ingestion pipeline.

```mermaid
flowchart LR
    CSV[CSV Payload] --> Vector
    Vector -->|log_type=SENSOR_RADAR| MV[mv_radar_logs]
    MV --> Target[radar]
```

---

## 6. Future Considerations

- [ ] **`path_tracking:1.1`** — Add Z-axis support (`z_m`)
- [ ] **`session_log:1.1`** — Add entry/exit timestamps separately
- [ ] **Batching guidance** — Document recommended batch sizes for path tracking uploads
- [ ] **Compression** — Document GZIP expectations for high-frequency path data
