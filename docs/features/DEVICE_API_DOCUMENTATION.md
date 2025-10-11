# Device Communication API Documentation

## Overview

This document provides a comprehensive reference for all communication between the **Server** and **Device**. The architecture follows a **server-centric design** where the server leads and the device follows with simple status reporting.

## Architecture Principles

1. **Server-Centric Design**: Server initiates all actions, device executes and reports status
2. **Centralized Logic**: All business logic resides on the server
3. **Simple Device Responses**: Device only reports status, never makes decisions
4. **Dual Communication Channels**:
   - **SSE (Server-Sent Events)**: Server → Device commands and real-time updates
   - **HTTP API**: Device → Server status updates and responses

---

## Communication Channels

### 1. SSE Connection (Server → Device)

The device maintains a persistent SSE connection to receive commands from the server.

#### Registration Endpoint
```
GET /api/sse/register
Headers:
  - X-Device-PIN: <6-digit-pin>
  - Authorization: Bearer <factory-token>
  - X-Device-MAC: <MAC-address> (format: 00:00:00:00:00:00)
```

#### Listen Endpoint (After Registration)
```
GET /api/sse/listen
Headers:
  - X-Device-ID: <device-id>
  - X-API-Key: <device-api-key>
```

#### SSE Message Envelope Format

All SSE messages are wrapped in a standardized envelope:

```json
{
  "channel": "device:{deviceId}",
  "type": "channel_message",
  "timestamp": 1728412345678,
  "payload": {
    // BaseResponse or specialized response (see below)
  }
}
```

**Envelope Fields**:
- `channel`: Target channel (e.g., `"device:{deviceId}"`)
- `type`: Always `"channel_message"` for standard messages
- `timestamp`: Unix timestamp in milliseconds
- `payload`: The actual message content (standardized response format)

### 2. HTTP API (Device → Server)

#### Device Status Update Endpoint
```
POST /api/devices/{deviceId}/status
Headers:
  - Content-Type: application/json
  - X-API-Key: <device-api-key>

Body:
{
  "logId": "operation-id",
  "action": "action-name",
  "status": "in_progress|complete|failed",
  "message": "status message",
  "progress": 50  // optional
}
```

#### Device Info Endpoint
```
POST /api/devices/add
Headers:
  - Content-Type: application/json
  - X-API-Key: <device-api-key>

Body: {
  "id": "device-id",
  "pin": "6-digit-pin",
  "deviceType": "string",
  "model": "string",
  "osVersion": "string",
  "hostname": "string",
  "networkInfo": {
    "MAC": "00:00:00:00:00:00",
    // ... other network info
  },
  "senderId": "user-id",
  "senderConnectionId": "connection-id",
  "senderConnectionProtocol": "protocol",
  "timestamp": "ISO8601"
}
```

---

## Standardized Response Format

All messages in the `payload` field follow a standardized response format for consistency across the application.

### BaseResponse Structure

```typescript
{
  "id": "uuid",                          // Optional: Unique response identifier
  "timestamp": "2025-10-08T12:34:56Z",   // ISO string or epoch ms
  "status": 200,                          // ResponseStatus enum value
  "severity": "success",                  // ResponseSeverity: info|success|warning|error|debug
  "category": "device",                   // ResponseCategory: system|auth|device|user|data|notification
  "title": "Operation Complete",          // Optional: Short title for UI
  "message": "Device action completed",   // Detailed message
  "details": "Additional context",        // Optional: Technical details
  "code": "DEVICE_001",                   // Optional: Error/event code
  "meta": {                               // Optional: Additional metadata
    "deviceId": "device-id",
    "logId": "operation-id"
  }
}
```

### Response Status Codes

```typescript
// Success codes (2xx)
SUCCESS = 200
CREATED = 201
ACCEPTED = 202

// Client error codes (4xx)
BAD_REQUEST = 400
UNAUTHORIZED = 401
FORBIDDEN = 403
NOT_FOUND = 404
VALIDATION_ERROR = 422

// Server error codes (5xx)
SERVER_ERROR = 500
SERVICE_UNAVAILABLE = 503

// Application-specific codes (1xxx)
DEVICE_OFFLINE = 1001
DEVICE_BUSY = 1002
```

### Specialized Response Types

#### 1. DataResponse (with payload)
```typescript
{
  ...BaseResponse,
  "data": {
    // Any data payload
  }
}
```

#### 2. SystemResponse (for events)
```typescript
{
  ...BaseResponse,
  "event": "ping",                    // System event type
  "actionRequired": false,            // Optional: requires user action
  "action": {                         // Optional: action details
    "type": "navigate",
    "label": "View Details",
    "url": "/devices/123"
  }
}
```

#### 3. ProgressResponse (for long operations)
```typescript
{
  ...BaseResponse,
  "progress": 45,                     // Progress percentage (0-100)
  "total": 100,                       // Optional: total steps
  "current": 45,                      // Optional: current step
  "eta": 30                           // Optional: estimated seconds remaining
}
```

#### 4. ErrorResponse
```typescript
{
  ...BaseResponse,
  "error": "ValidationError",         // Error type/name
  "validationErrors": {               // Optional: field-specific errors
    "packageName": ["Package name is required"]
  },
  "stack": "Error stack trace"        // Optional: for development only
}
```

---

## Message Types (Server → Device via SSE)

All SSE messages are wrapped in an envelope with a standardized payload structure.

### Complete Message Example

```json
{
  "channel": "device:abc-123",
  "type": "channel_message",
  "timestamp": 1728412345678,
  "payload": {
    "id": "msg-uuid",
    "timestamp": "2025-10-08T12:34:56Z",
    "status": 200,
    "severity": "info",
    "category": "device",
    "message": "Device action request",
    "meta": {
      "action": "reboot",
      "deviceId": "abc-123",
      "logId": "op-456"
    }
  }
}
```

**Legacy Format Note**: Some older messages may use a different structure without the envelope. The device should handle both formats for backward compatibility.

---

## Migration Guide: Legacy to Standardized Format

### Understanding the Changes

The SSE messaging system has been updated to use a standardized format with two key components:

1. **Envelope Wrapper**: All messages are wrapped in a consistent envelope structure
2. **Standardized Payload**: Message content follows BaseResponse format with status codes, severity levels, and categories

### Old Format (Legacy)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "reboot",
    "deviceId": "abc-123"
  },
  "timestamp": "2025-10-08T12:34:56Z"
}
```

### New Format (Standardized)
```json
{
  "channel": "device:abc-123",
  "type": "channel_message",
  "timestamp": 1728412345678,
  "payload": {
    "id": "msg-uuid",
    "timestamp": "2025-10-08T12:34:56Z",
    "status": 200,
    "severity": "info",
    "category": "device",
    "message": "Reboot request",
    "meta": {
      "action": "reboot",
      "deviceId": "abc-123"
    }
  }
}
```

### Key Differences

| Aspect | Legacy Format | Standardized Format |
|--------|---------------|---------------------|
| **Wrapper** | None | Envelope with `channel`, `type`, `timestamp` |
| **Payload Structure** | Custom per message | Consistent BaseResponse interface |
| **Status Indication** | Custom fields | Standard `status` codes (200, 400, 500, etc.) |
| **Severity** | Not standardized | `severity` field (info, success, warning, error) |
| **Categorization** | Not available | `category` field (system, device, user, etc.) |
| **Metadata** | Mixed in payload | Organized in `meta` object |
| **Timestamps** | ISO string only | ISO string or epoch ms |

### Device Implementation Considerations

When implementing device handlers, consider:

1. **Parse Envelope First**: Extract the `payload` from the envelope
2. **Check Payload Structure**: Determine if it's BaseResponse or legacy format
3. **Extract Action**: In new format, action is in `meta.action` instead of `payload.action`
4. **Status Handling**: Use `status` field for determining success/failure
5. **Error Messages**: Use `message` field for user-friendly text, `details` for technical info

### Example Handler Code Pattern

```javascript
function handleSSEMessage(rawMessage) {
  let payload;
  
  // Handle envelope format
  if (rawMessage.type === 'channel_message' && rawMessage.payload) {
    payload = rawMessage.payload;
  } else {
    // Legacy format - message itself is the payload
    payload = rawMessage;
  }
  
  // Extract action
  const action = payload.meta?.action || payload.action;
  
  // Check status (new format) or infer from structure (legacy)
  const isSuccess = payload.status ? (payload.status >= 200 && payload.status < 300) : true;
  
  // Route to appropriate handler
  routeAction(action, payload);
}
```

---

## 1. Device Registration

### Request (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "registered",
    "id": "device-uuid",
    "apiKey": "device-api-key",
    "claimedBy": "user-id",
    "userId": "user-id"
  },
  "senderId": "user-id",
  "senderConnectionId": "connection-id",
  "senderConnectionProtocol": "sse"
}
```

### Response (Device → Server)
Device saves credentials locally and sends device info to `/api/devices/add` endpoint.

**Expected Behavior**:
- Device saves `deviceId` and `apiKey` to `./workings/deviceId.txt`
- Device calls `SetCredentials(deviceId, apiKey)`
- Device sends complete device information to server
- Device switches from registration endpoint to listen endpoint

---

## 2. Device Actions

### 2.1 Reboot

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "reboot",
    "deviceId": "device-id",
    "logId": "operation-id"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "reboot",
  "status": "complete",
  "message": "Device rebooted successfully"
}
```

**Expected Behavior**:
- Device simulates reboot (2 second delay)
- Sends completion status via API
- Server updates action log and notifies frontend via SSE

---

### 2.2 Restart

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "restart",
    "deviceId": "device-id",
    "logId": "operation-id"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "restart",
  "status": "complete",
  "message": "Device restarted successfully"
}
```

**Expected Behavior**:
- Device simulates restart (1 second delay)
- Sends completion status via API

---

### 2.3 Install App

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "installApp",
    "deviceId": "device-id",
    "logId": "operation-id",
    "packageName": "com.example.app"
  }
}
```

#### Progress Updates (Device → Server via SSE)
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "installApp",
    "progress": 20,
    "message": "Installing com.example.app... 20%"
  },
  "senderId": "device",
  "timestamp": "ISO8601"
}
```

#### Final Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "installApp",
  "status": "complete",
  "message": "App com.example.app installed successfully"
}
```

**Expected Behavior**:
- Device sends progress updates at 0%, 20%, 40%, 60%, 80%, 100%
- Each progress update sent via SSE to frontend
- Final completion sent via API
- Total duration: ~1 second

---

### 2.4 Uninstall App

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "uninstall",
    "deviceId": "device-id",
    "logId": "operation-id",
    "packageName": "com.example.app"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "uninstall",
  "status": "complete",
  "message": "App com.example.app uninstalled successfully"
}
```

**Expected Behavior**:
- Device simulates uninstallation (1 second delay)
- Sends completion status via API
- No progress updates (simple action like reboot/restart)

---

### 2.5 Restart App

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "restartApp",
    "deviceId": "device-id",
    "logId": "operation-id",
    "packageName": "com.example.app"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "restartApp",
  "status": "complete",
  "message": "App com.example.app restarted successfully"
}
```

**Expected Behavior**:
- Device simulates app restart (500ms delay)
- Sends completion status via API
- No progress updates (simple action like reboot/restart)

---

### 2.6 Configure App

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "config",
    "deviceId": "device-id",
    "logId": "operation-id",
    "packageName": "com.example.app"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "config",
  "status": "complete",
  "message": "App com.example.app configured successfully"
}
```

**Expected Behavior**:
- Device simulates app configuration (800ms delay)
- Sends completion status via API
- No progress updates (simple action like reboot/restart)

---

### 2.7 Push File (Server to Device)

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "pushFile",
    "deviceId": "device-id",
    "logId": "operation-id",
    "sourcePath": "/path/to/source/file.txt",
    "destinationPath": "file.txt"  // optional, defaults to Downloads folder
  }
}
```

#### Progress Updates (Device → Server via SSE)
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "pushFile",
    "type": "progress",
    "progress": 25,
    "message": "Streaming file... 25% (1024/4096 bytes)"
  }
}
```

#### File Chunk Updates (Device → Server via SSE)
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "pushFile",
    "type": "fileChunk",
    "data": "base64-encoded-chunk-data",
    "position": 1024,
    "total": 4096,
    "fileName": "file.txt"
  }
}
```

#### Final Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "pushFile",
  "status": "complete",
  "message": "File downloaded successfully to: /Users/username/Downloads/file.txt"
}
```

**Expected Behavior**:
- Device reads file from `sourcePath`
- Saves file to Downloads folder (OS-specific path)
- Streams file in 8KB chunks to frontend via SSE
- Sends progress updates every 5%
- Final status via API

**Error Handling**:
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "pushFile",
  "status": "failed",
  "message": "Source file does not exist: /path/to/source/file.txt"
}
```

---

### 2.8 Pull File (Device to Server)

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "pullFile",
    "deviceId": "device-id",
    "logId": "operation-id",
    "sourcePath": "/device/path/file.txt",
    "destinationPath": "/server/path/file.txt"
  }
}
```

#### Progress Updates (Device → Server via SSE)
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "pullFile",
    "progress": 25,
    "message": "Transferring file... 25%"
  }
}
```

#### Final Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "pullFile",
  "status": "complete",
  "message": "File pulled from /device/path/file.txt to /server/path/file.txt successfully"
}
```

**Expected Behavior**:
- Progress updates at 0%, 25%, 50%, 75%, 100%
- Total duration: ~1.5 seconds

---

### 2.9 Update Firmware

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "updateFirmware",
    "deviceId": "device-id",
    "logId": "operation-id",
    "firmware": {
      "version": "2.0.0",
      "url": "https://example.com/firmware.bin"
    }
  }
}
```

**Alternative Format** (Legacy):
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "updateFirmware",
    "deviceId": "device-id",
    "logId": "operation-id",
    "firmwareVersion": "2.0.0"
  }
}
```

#### Progress Updates (Device → Server via SSE)
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "updateFirmware",
    "progress": 30,
    "message": "Updating firmware to 2.0.0..."
  }
}
```

#### Final Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "updateFirmware",
  "status": "complete",
  "message": "Firmware updated to version 2.0.0 successfully"
}
```

**Expected Behavior**:
- Progress updates at 0%, 10%, 20%, ..., 100%
- Total duration: ~5.5 seconds

---

### 2.10 Apply Profile

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "applyProfile",
    "deviceId": "device-id",
    "logId": "operation-id",
    "profileId": "profile-id",
    "message": "Profile assignment requested"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "applyProfile",
  "status": "complete",
  "message": "Profile applied successfully",
  "profileId": "profile-id"
}
```

**Expected Behavior**:
- Device applies the specified profile configuration
- Updates device settings based on profile
- Sends completion status via API
- Server updates DeviceProfileAssignment status to SUCCESS
- Real-time UI updates via SSE notification

---

### 2.11 Reapply Profile

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "applyProfile",
    "deviceId": "device-id",
    "logId": "operation-id",
    "profileId": "profile-id",
    "message": "Profile reapplication requested"
  }
}
```

#### Response (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "applyProfile",
  "status": "complete",
  "message": "Profile reapplied successfully",
  "profileId": "profile-id"
}
```

**Expected Behavior**:
- Device reapplies the existing profile configuration
- Updates device settings based on current profile
- Sends completion status via API
- Server updates DeviceProfileAssignment status to SUCCESS
- Real-time UI updates via SSE notification

---

### 2.12 Get Logs

#### Request (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "payload": {
    "action": "getLogs",
    "deviceId": "device-id",
    "logId": "operation-id",
    "format": "zip|text"  // optional, defaults to text
  }
}
```

#### For Text Format:

**Progress Updates** (Device → Server via SSE):
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "getLogs",
    "type": "progress",
    "progress": 0,
    "message": "Starting log collection..."
  }
}
```

**File Metadata** (Device → Server via SSE):
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "getLogs",
    "type": "fileMetadata",
    "fileName": "device_logs_20250930_235900.txt",
    "totalSize": 2048,
    "message": "Log file generated, starting transfer..."
  }
}
```

**File Chunks** (Device → Server via SSE):
```json
{
  "type": "device:progressUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "logId": "operation-id",
    "action": "getLogs",
    "type": "fileChunk",
    "data": "base64-encoded-chunk-data",
    "position": 1024,
    "total": 2048,
    "fileName": "device_logs_20250930_235900.txt"
  }
}
```

**Final Response** (Device → Server via API):
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "getLogs",
  "status": "complete",
  "message": "Device logs retrieved successfully"
}
```

#### For ZIP Format:

**Chunk Metadata** (Device → Server via SSE):
```json
{
  "type": "device",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "action": "getLogs",
    "deviceId": "device-id",
    "logId": "operation-id",
    "success": true,
    "message": "Starting log file stream",
    "format": "zip",
    "chunkCount": 10,
    "totalSize": 65536,
    "fileName": "device_logs_20250930_235900.zip",
    "timestamp": "ISO8601"
  }
}
```

**Chunk Data** (Device → Server via SSE):
```json
{
  "type": "device",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "action": "getLogs",
    "deviceId": "device-id",
    "logId": "operation-id",
    "success": true,
    "message": "Streaming chunk 1/10",
    "format": "zip",
    "chunkIndex": 0,
    "chunkCount": 10,
    "chunkData": "base64-encoded-zip-chunk",
    "timestamp": "ISO8601"
  }
}
```

**Completion** (Device → Server via SSE):
```json
{
  "type": "device",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "action": "getLogs",
    "deviceId": "device-id",
    "logId": "operation-id",
    "success": true,
    "message": "Log file streaming completed",
    "format": "zip",
    "totalSize": 65536,
    "durationMs": 5000,
    "timestamp": "ISO8601"
  }
}
```

**Expected Behavior**:
- Device generates logs (system, application, device, network, hardware)
- For text format: streams line by line
- For zip format: creates zip archive with multiple log files, streams in 64KB chunks
- Sends progress updates during collection
- Final status via API

**ZIP Contents**:
- `system.log` - System logs
- `application.log` - Application logs
- `device.log` - Device-specific logs
- `network.log` - Network logs
- `hardware.log` - Hardware logs

---

## 3. Profile Management & Real-Time UI Updates

### 3.1 Profile Assignment Flow

#### Initial Assignment (Server → Device via SSE)
```json
{
  "type": "device:actionRequest",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "action": "applyProfile",
    "deviceId": "device-id",
    "profileId": "profile-id",
    "logId": "operation-id",
    "message": "Profile assignment requested"
  },
  "senderId": "system",
  "timestamp": "ISO8601"
}
```

#### Status Update (Device → Server via API)
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "applyProfile",
  "status": "complete",
  "message": "Profile applied successfully",
  "profileId": "profile-id"
}
```

#### Real-Time UI Notification (Server → Frontend via SSE)
```json
{
  "type": "device:profileUpdate",
  "scope": "subscription:device:{deviceId}",
  "payload": {
    "action": "applyProfile",
    "deviceId": "device-id",
    "status": "complete",
    "profileId": "profile-id",
    "message": "Profile assignment completed successfully",
    "sentAt": "ISO8601"
  },
  "senderId": "system",
  "timestamp": "ISO8601"
}
```

**Expected Behavior**:
1. Server creates DeviceProfileAssignment record with APPLYING status
2. Server sends device:actionRequest to device via SSE
3. Device applies profile configuration
4. Device sends status update via HTTP API
5. Server updates DeviceProfileAssignment to SUCCESS
6. Server sends device:profileUpdate to frontend via SSE
7. Frontend updates UI in real-time without refresh

### 3.2 Reapply Profile (Bulk & Individual)

#### Bulk Reapply (Server API)
```json
POST /api/admin/iot/device-profiles/{profileId}/reapply
{
  "deviceIds": ["device-id-1", "device-id-2", "device-id-3"]
}
```

#### Individual Reapply (Server API)
```json
POST /api/admin/iot/device-profiles/{profileId}/reapply
{
  "deviceIds": ["device-id"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Profile reapplied to 3 device(s)",
  "results": {
    "total": 3,
    "successful": 3,
    "failed": 0,
    "details": [
      {"deviceId": "device-id-1", "success": true},
      {"deviceId": "device-id-2", "success": true},
      {"deviceId": "device-id-3", "success": true}
    ]
  }
}
```

**Expected Behavior**:
- Server updates all DeviceProfileAssignment records to APPLYING status
- Server sends device:actionRequest to each device via SSE
- Each device reapplies the profile configuration
- Devices send status updates via HTTP API
- Server updates DeviceProfileAssignment records to SUCCESS
- Real-time UI updates for each device completion

### 3.3 Status Tracking & Timeout Handling

#### Database Status Flow
```
APPLYING → SUCCESS (on device response)
APPLYING → FAILED (on timeout or device error)
```

#### Timeout Handling
- **Timeout Duration**: 3 minutes (180 seconds)
- **Timeout Action**: Automatically mark as FAILED
- **UI Update**: Real-time status change notification

#### Status Values
- `APPLYING`: Profile assignment in progress
- `SUCCESS`: Profile successfully applied
- `FAILED`: Profile assignment failed or timed out

---

## 4. Real-Time Features

### 3.1 Screenshot Request

#### Request (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "screenshot:request",
    "deviceId": "device-id",
    "requestId": "screenshot-request-id",
    "quality": 80  // optional, 1-100, default 80
  },
  "senderConnectionId": "connection-id",
  "requestId": "screenshot-request-id"
}
```

#### Response (Device → Server via HTTP POST)
Device captures screenshot and sends it to the server's message endpoint.

**Success Response**:
```json
{
  "type": "device",
  "requestId": "screenshot-request-id",
  "payload": {
    "action": "message",
    "type": "screenshot:response",
    "requestId": "screenshot-request-id",
    "data": "base64-encoded-image-data",
    "format": "jpeg",
    "width": 1920,
    "height": 1080
  },
  "scope": "subscription:device:{deviceId}"
}
```

**Error Response** (via SSE):
```json
{
  "type": "device",
  "requestId": "screenshot-request-id",
  "payload": {
    "action": "message",
    "type": "screenshot:error",
    "requestId": "screenshot-request-id",
    "error": "Screenshot failed. Please try again."
  },
  "scope": "subscription:device:{deviceId}",
  "echoToSender": true
}
```

**Expected Behavior**:
- Device captures screenshot at specified quality
- Encodes as base64 JPEG
- Sends to server via HTTP POST to message endpoint
- Server forwards to frontend via SSE

**Error Messages**:
- "Server is temporarily unable to process large screenshots. Please try again later."
- "Screenshot request was rejected by the server. Please try again."
- "Screenshot request timed out. Please try again."
- "Unable to connect to the server. Please check your connection and try again."

---

### 3.2 WebRTC Connection

#### Connect Request (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "webrtc:connect"
  },
  "senderConnectionId": "connection-id"
}
```

**Alternative** (Terminal):
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "terminal:connect"
  },
  "senderConnectionId": "connection-id"
}
```

#### Answer (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "webrtc:answer",
    "sdp": "webrtc-sdp-answer"
  }
}
```

#### ICE Candidate (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "webrtc:ice-candidate",
    "candidate": "ice-candidate-data"
  }
}
```

#### Video Request (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "webrtc:video-request",
    "id": "video-stream-id"  // optional, defaults to "default-video-stream"
  }
}
```

**Expected Behavior**:
- Device establishes WebRTC peer connection
- Handles SDP offer/answer exchange
- Processes ICE candidates
- Adds video track when requested
- Maintains data channel for bidirectional communication

---

### 3.3 Ping-Pong

#### Ping Request (Server → Device via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "ping",
    "deviceId": "device-id",
    "timestamp": 1727712000000,
    "requestId": "ping-request-id"
  },
  "connectionId": "connection-id",
  "requestId": "ping-request-id"
}
```

#### Pong Response (Device → Server via SSE)
```json
{
  "type": "device",
  "payload": {
    "action": "message",
    "type": "pong",
    "deviceId": "device-id",
    "replyTo": 1727712000000,
    "timestamp": 1727712001000
  },
  "scope": "connection:{connectionId}",
  "requestId": "ping-request-id"
}
```

**Expected Behavior**:
- Device immediately responds to ping with pong
- Includes original timestamp in `replyTo`
- Preserves `requestId` for latency measurement

---

### 3.4 System Ping

#### System Ping (Server → Device via SSE)

The server sends regular ping messages every 30 seconds to maintain connection health.

**Complete Envelope Format**:
```json
{
  "channel": "device:{deviceId}",
  "type": "channel_message",
  "timestamp": 1728412345678,
  "payload": {
    "id": "ping-uuid",
    "timestamp": "2025-10-08T12:34:56Z",
    "status": 200,
    "severity": "info",
    "category": "system",
    "message": "Connection heartbeat",
    "event": "ping",
    "meta": {
      "connectionId": "conn-123",
      "deviceId": "device-abc"
    }
  }
}
```

**Expected Behavior**:
- Server sends ping every 30 seconds (configurable via `PING_INTERVAL_MS`)
- Device logs system ping (optional)
- No response required from device
- Used for connection keep-alive and health monitoring
- If ping fails, connection is automatically cleaned up

---

## Error Handling

### General Error Response Format
```json
POST /api/devices/{deviceId}/status
{
  "logId": "operation-id",
  "action": "action-name",
  "status": "failed",
  "message": "Error description"
}
```

### Common Error Scenarios

1. **Invalid Action**:
   ```json
   {
     "status": "failed",
     "message": "unknown action: invalidAction"
   }
   ```

2. **Missing Parameters**:
   ```json
   {
     "status": "failed",
     "message": "sourcePath is required for pushFile"
   }
   ```

3. **File Not Found**:
   ```json
   {
     "status": "failed",
     "message": "Source file does not exist: /path/to/file"
   }
   ```

4. **Permission Denied**:
   ```json
   {
     "status": "failed",
     "message": "Failed to create destination directory: permission denied"
   }
   ```

---

## Message Flow Summary

### Action Flow (API-Based)
```
Frontend → Server API → Device (SSE) → Device Handler → Device API Response → Server → Frontend (SSE)
```

1. Frontend initiates action via server API
2. Server creates action log entry
3. Server sends command to device via SSE
4. Device executes action
5. Device sends progress updates via SSE (optional)
6. Device sends final status via HTTP API
7. Server updates action log
8. Server notifies frontend via SSE

### Real-Time Flow (SSE-Based)
```
Frontend → Server → Device (SSE) → Device Handler → Server (HTTP) → Frontend (SSE)
```

1. Frontend requests real-time feature (screenshot, WebRTC)
2. Server forwards request to device via SSE
3. Device processes request
4. Device sends response via HTTP or SSE
5. Server forwards to frontend via SSE

---

## Supported Actions Summary

| Action | Type | Progress Updates | Duration | Response Channel |
|--------|------|------------------|----------|------------------|
| `reboot` | Simple | No | 2s | API |
| `restart` | Simple | No | 1s | API |
| `uninstall` | Simple | No | 1s | API |
| `restartApp` | Simple | No | 500ms | API |
| `config` | Simple | No | 800ms | API |
| `applyProfile` | Simple | No | Variable | API + SSE |
| `installApp` | Progress | Yes (0-100%, 20% steps) | 1s | API + SSE |
| `pushFile` | Streaming | Yes (5% increments + chunks) | Variable | API + SSE |
| `pullFile` | Progress | Yes (0-100%, 25% steps) | 1.5s | API + SSE |
| `updateFirmware` | Progress | Yes (0-100%, 10% steps) | 5.5s | API + SSE |
| `getLogs` | Streaming | Yes (chunks + metadata) | Variable | API + SSE |
| `screenshot:request` | Real-time | No | <1s | HTTP POST |
| `webrtc:connect` | Real-time | No | N/A | WebRTC |
| `ping` | Real-time | No | <100ms | SSE |

---

## Implementation Notes

### Device Handler Registry

The device uses a handler registry pattern to process incoming messages:

1. **RegistrationHandler** - Handles device registration
2. **DeviceActionHandler** - Handles all device actions (reboot, install, etc.)
3. **ScreenshotHandler** - Handles screenshot requests
4. **WebRTCHandler** - Handles WebRTC signaling
5. **StreamingLogsHandler** - Handles log streaming
6. **PingHandler** - Handles ping-pong messages
7. **SystemPingHandler** - Handles system ping events

### Message Routing

Messages are routed based on:
- `type`: Message category (device, device:actionRequest)
- `payload.action`: Specific action to execute
- `payload.type`: Sub-type for real-time features

### Connection Management

- **Registration Mode**: Device connects with PIN to `/api/sse/register`
- **Normal Mode**: Device connects with credentials to `/api/sse/listen`
- **Reconnection**: Device automatically reconnects after receiving credentials

### File Operations

- **Push File**: Downloads from device to Downloads folder, streams to frontend
- **Pull File**: Uploads from device to server (simulated)
- **Get Logs**: Generates logs and streams as text or zip

### Progress Tracking

- Progress updates sent via SSE for real-time UI feedback
- Final status sent via API for reliable delivery
- Server maintains action log with timestamps and status

---

## Security Considerations

1. **Authentication**: All requests require valid API key
2. **Authorization**: Device can only access its own resources
3. **Validation**: All inputs validated before processing
4. **Error Handling**: Errors logged but sensitive details not exposed
5. **File Access**: File operations restricted to specific directories

---

## Testing

### Manual Testing

1. **Registration**:
   ```bash
   # Device generates PIN and connects
   # Server sends registration message
   # Device saves credentials and reconnects
   ```

2. **Actions**:
   ```bash
   # Send action via server API
   # Monitor SSE for progress updates
   # Verify final status in action log
   ```

3. **Real-time Features**:
   ```bash
   # Request screenshot
   # Verify image received
   # Test WebRTC connection
   # Measure ping latency
   ```

### Automated Testing

See `/tests/device/` directory for test scripts:
- `dummy_device.py` - Simulates device behavior
- `data_channel.py` - Tests WebRTC data channel
- `debug_sse.py` - Debug SSE connection

---

## Changelog

- **2025-09-30**: Initial documentation created
  - Documented all device actions and real-time features
  - Added error handling and message flow diagrams
  - Included implementation notes and testing guidelines

- **2025-10-04**: Added profile management features
  - Added applyProfile and reapply profile actions
  - Added real-time UI updates for profile assignments
  - Added status tracking with APPLYING/SUCCESS/FAILED states
  - Added timeout handling (3-minute timeout)
  - Added bulk and individual reapply functionality

- **2025-10-08**: Updated SSE message format documentation
  - Added standardized response format (BaseResponse) for all SSE messages
  - Documented SSE envelope structure (channel, type, timestamp, payload)
  - Added response status codes (2xx, 4xx, 5xx, 1xxx application codes)
  - Added specialized response types (DataResponse, SystemResponse, ProgressResponse, ErrorResponse)
  - Updated System Ping documentation with actual implementation details
  - Added backward compatibility notes for legacy message formats
  - Documented ping interval (30 seconds) and connection health monitoring

---

## References

- [REAL_TIME_ARCHITECTURE.md](../REAL_TIME_ARCHITECTURE.md) - Server architecture
- [DEVICE_PROTOCOL.md](../../fs04_device/DEVICE_PROTOCOL.md) - Device protocol specification
- [Response Format Types](../../src/lib/shared/response_format/types.ts) - Standardized response format definitions
- [Response Format Utils](../../src/lib/shared/response_format/utils.ts) - Response creation utilities
- [SSE Connection Implementation](../../src/lib/server/messaging/connections/sse_connection.ts) - SSE connection handler
- Handler implementations in `fs04_device/internal/module/handlers/`
