# Sensor Logs API

API endpoints to retrieve radar sensor logs from ClickHouse (session events and path tracking).

## Authentication

Add `x-api-key` header to all requests:

```bash
-H "x-api-key: your-api-key"
```

Uses account-level API keys. The API key must be associated with an account, and the `mac_address` in the request must belong to a device in that account.

---

## Endpoints

### GET /api/sensor-logs/sessions

Get session-level records (per-person events with dwell times, zone info).

**Required Parameters:**
- `mac_address` - Device MAC address
- `start_time` - Start time (ISO format: `2025-12-31T00:00:00`)
- `end_time` - End time (ISO format: `2025-12-31T23:59:59`)

**Optional Parameters:**
- `type` - Response format: `csv` (default) or `json`

**Example:**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:5173/api/sensor-logs/sessions?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59"
```

**JSON Format:**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:5173/api/sensor-logs/sessions?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59&type=json"
```

---

### GET /api/sensor-logs/paths

Get path tracking logs (X/Y coordinates per timestamp).

**Required Parameters:**
- `mac_address` - Device MAC address
- `start_time` - Start time (ISO format: `2025-12-31T00:00:00`)
- `end_time` - End time (ISO format: `2025-12-31T23:59:59`)

**Optional Parameters:**
- `target_id` - Filter by specific target ID
- `type` - Response format: `csv` (default) or `json`

**Example (all targets):**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:5173/api/sensor-logs/paths?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59"
```

**Example (specific target):**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:5173/api/sensor-logs/paths?mac_address=00:1A:2B:3C:4D:5E&target_id=TARGET_123&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59"
```

**JSON Format:**
```bash
curl -H "x-api-key: your-api-key" \
  "http://localhost:5173/api/sensor-logs/paths?mac_address=00:1A:2B:3C:4D:5E&start_time=2025-12-31T00:00:00&end_time=2025-12-31T23:59:59&type=json"
```

---

## Response Formats

**CSV (default):**
- Returns CSV file with headers
- Streams data for large datasets
- Browser will download as file automatically

**JSON:**
- Returns JSON array of objects
- Add `&type=json` to query string

---

## Error Codes

- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (MAC address not in account)
- `500` - Internal Server Error

---

## Backward Compatibility

The legacy paths `/api/v1/sessions` and `/api/v1/paths` permanently redirect (308) to the new endpoints. Existing integrations will continue to work.

---

## Quick Reference

| Endpoint | Purpose | Key Difference |
|----------|---------|----------------|
| `/api/sensor-logs/sessions` | Session events | Dwell times, zone info |
| `/api/sensor-logs/paths` | Coordinate tracking | X/Y positions per timestamp |

**Base URL:** `http://localhost:5173/api/sensor-logs`  
**Auth Header:** `x-api-key: your-api-key`  
**Default Format:** CSV  
**Time Format:** ISO 8601 (`YYYY-MM-DDTHH:MM:SS`)
