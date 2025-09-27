# Device Handler Documentation

The Device Handler is responsible for processing device-related messages in the IoT management system. It routes different types of device actions to specialized handlers and provides comprehensive logging and status tracking.

## Overview

The device handler supports the following actions:
- [`claim`](./claim.md) - Device claiming process
- [`register`](./register.md) - Device registration
- [`status`](./status.md) - Device status updates
- [`updateFirmware`](./firmwareUpdate.md) - Firmware update operations
- [`bundleStatus`](./bundleStatus.md) - Bundle installation status tracking
- [`getLogs`](./getLogs.md) - Device log retrieval
- [`message`](./message.md) - General device messaging (WebRTC, screenshots, terminal)

## Handler Structure

```typescript
export const deviceHandler: Handler = {
  supports(type: string): boolean {
    return type === 'device';
  },

  async handle(message: InMessage): Promise<void> {
    const { payload } = message;
    const { action } = payload;

    switch (action) {
      case 'claim': await handleClaim(message); break;
      case 'register': await handleRegistration(message); break;
      case 'status': await handleStatusUpdate(message); break;
      case 'updateFirmware': await handleFirmwareUpdate(message); break;
      case 'bundleStatus': await handleBundleStatus(message); break;
      case 'getLogs': await handleGetLogs(message); break;
      case 'message': await handleDeviceMessage(message); break;
    }
  }
};
```

---

## Action Handlers

### 1. Claim Action (`handleClaim`)

**Purpose**: Handles device claiming process where users claim devices using PIN codes.

**Handler**: `claimHandler.ts`

**Message Flow**:
1. User provides PIN code
2. System validates PIN and user authentication
3. Device is claimed and associated with user account
4. Success/error response sent back to client

**Key Features**:
- PIN validation
- User authentication required
- Device association with user account
- Comprehensive error handling
- Real-time response to client

**Request Payload**:
```typescript
{
  action: 'claim',
  pin: string, // 6-digit PIN
  // ... other message fields
}
```

**Response Payload**:
```typescript
// Success
{
  action: 'claim',
  success: true,
  message: {
    type: 'success',
    text: 'Device claimed successfully!',
    timestamp: string
  },
  device: {
    id: string,
    name: string,
    deviceType: string,
    status: string
  }
}

// Error
{
  action: 'claim',
  success: false,
  error: string,
  details: string,
  code: string
}
```

**Error Scenarios**:
- Invalid PIN
- Device already claimed
- Authentication failure
- Device not found

---

### 2. Register Action (`handleRegistration`)

**Purpose**: Handles device registration when devices connect to the system.

**Handler**: `registrationHandler.ts`

**Message Flow**:
1. Device sends registration request with device info
2. System validates registration data
3. Device record created/updated in database
4. Registration confirmation sent to device
5. Admin notification sent for new device

**Key Features**:
- Device information validation
- Database record creation/update
- Admin notifications
- Registration confirmation

**Request Payload**:
```typescript
{
  action: 'register',
  deviceId: string,
  pin: string,
  deviceInfo: {
    // Device-specific information
  }
}
```

**Response Payload**:
```typescript
{
  action: 'registered',
  deviceId: string,
  timestamp: string
}
```

**TODO Items**:
- PIN validation and expiration
- Duplicate registration checks
- Device record management

---

### 3. Status Action (`handleStatusUpdate`)

**Purpose**: Handles device status updates from connected devices.

**Handler**: `statusHandler.ts`

**Message Flow**:
1. Device sends status update
2. System logs status change
3. Database updated with new status
4. Relevant users notified

**Key Features**:
- Status change logging
- Real-time status tracking
- User notifications

**Request Payload**:
```typescript
{
  action: 'status',
  deviceId: string,
  status: string // New status value
}
```

**TODO Items**:
- Database status updates
- User notification system
- Status change validation

---

### 4. Firmware Update Action (`handleFirmwareUpdate`)

**Purpose**: Handles firmware update operations for devices.

**Handler**: `firmwareHandler.ts`

**Message Flow**:
1. User initiates firmware update
2. System validates request and device status
3. Action log created for tracking
4. Firmware update command sent to device
5. Progress tracking and timeout handling
6. Status updates sent to UI

**Key Features**:
- Comprehensive validation
- Action logging with timeouts
- Offline device detection
- Real-time progress updates
- 10-minute timeout protection

**Request Payload**:
```typescript
{
  action: 'updateFirmware',
  deviceId: string,
  firmware: {
    resourceId: string,
    resourceName: string,
    size: number,
    path: string,
    packageName?: string,
    version?: string,
    format?: string
  },
  options?: {
    // Update options
  }
}
```

**Response Payload**:
```typescript
{
  action: 'updateFirmware',
  success: boolean,
  error?: string,
  details?: string,
  deviceId: string,
  firmware: {
    resourceId: string
  },
  timestamp: string
}
```

**Status Updates**:
- `in_progress` - Update initiated
- `success` - Update completed
- `failed` - Update failed
- `offline` - Device offline

**Timeout**: 10 minutes

---

### 5. Bundle Status Action (`handleBundleStatus`)

**Purpose**: Handles bundle installation status updates from devices.

**Handler**: `bundleHandler.ts`

**Message Flow**:
1. Device reports bundle installation status
2. System updates progress records
3. Wave status computed and updated
4. Bundle status recomputed
5. Auto-start next wave if current completed
6. Status broadcasts to UI

**Key Features**:
- Progress tracking per device
- Wave-level aggregation
- Bundle-level status computation
- Automatic wave progression
- Real-time UI updates

**Request Payload**:
```typescript
{
  action: 'bundleStatus',
  deviceId: string,
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
  progress?: number, // 0-100
  sessionId: string, // wave:<waveId>
  batchId?: string
}
```

**Status Values**:
- `IN_PROGRESS` - Installation in progress
- `COMPLETED` - Installation completed successfully
- `FAILED` - Installation failed

**Wave Status Logic**:
- `IN_PROGRESS` - At least one device in progress
- `COMPLETED` - All devices completed successfully
- `FAILED` - At least one device failed
- `CANCELLED` - Deployment cancelled

**Auto-Start Logic**:
- Automatically starts next wave when current wave reaches terminal status
- Checks device online status before sending commands
- Marks offline devices as failed immediately

---

### 6. Get Logs Action (`handleGetLogs` / `handleGetLogsResponse`)

**Purpose**: Handles device log retrieval requests and responses.

**Handler**: `logsHandler.ts`

**Message Flow**:
1. User requests device logs
2. System validates request and device status
3. Action log created for tracking
4. Log request sent to device
5. Device responds with logs
6. Logs processed and sent to client
7. Status updates sent to UI

**Key Features**:
- Request/response handling
- Action logging with timeouts
- Offline device detection
- Direct response routing
- 5-minute timeout protection

**Request Payload**:
```typescript
{
  action: 'getLogs',
  deviceId: string,
  format?: string // Default: 'zip'
}
```

**Response Payload**:
```typescript
{
  action: 'getLogs',
  deviceId: string,
  success: boolean,
  message: string,
  format: string,
  logsData?: any, // Base64 encoded logs
  logs?: any[], // Log entries
  requestId: string,
  logId: string,
  durationMs?: number,
  timestamp: string
}
```

**Status Updates**:
- `in_progress` - Request sent to device
- `success` - Logs retrieved successfully
- `failed` - Request failed or timed out
- `offline` - Device offline

**Timeout**: 5 minutes

---

### 7. Message Action (`handleDeviceMessage`)

**Purpose**: Handles general device messaging including WebRTC, screenshots, and terminal operations.

**Handler**: `messageHandler.ts`

**Message Flow**:
1. Device message received
2. Message type determined (WebRTC, screenshot, terminal)
3. Appropriate action logging created
4. Message forwarded to device or processed
5. Response handling and status updates

**Supported Message Types**:
- `webrtc:connect` - WebRTC connection initiation
- `webrtc:answer` - WebRTC answer
- `webrtc:ice-candidate` - ICE candidate exchange
- `screenshot:request` - Screenshot capture request
- `screenshot:response` - Screenshot response with image
- `terminal:connected` - Terminal connection established

**Key Features**:
- Message type routing
- Action logging for terminal and screenshot operations
- Timeout handling (3min terminal, 2min screenshot)
- Offline device detection
- Enhanced response payloads with status

**WebRTC Messages**:
- Connection scoped routing
- Echo settings for responses
- Action logging for terminal connections

**Screenshot Messages**:
- Image data handling
- Status enhancement in responses
- 2-minute timeout protection

**Terminal Messages**:
- Connection status tracking
- 3-minute timeout protection
- Success/failure logging

**Timeout Values**:
- Terminal: 3 minutes
- Screenshot: 2 minutes

---

## Error Handling

All handlers implement comprehensive error handling:

1. **Validation Errors**: Input validation with detailed error messages
2. **Authentication Errors**: User authentication checks
3. **Device Status Errors**: Offline device detection
4. **Timeout Errors**: Automatic timeout handling with status updates
5. **Database Errors**: Graceful database operation failures
6. **Network Errors**: Message publishing failures

## Logging

The device handler provides structured logging:

- **Debug Level**: Message routing and payload information
- **Info Level**: Successful operations and status changes
- **Warn Level**: Non-critical errors and edge cases
- **Error Level**: Critical failures and exceptions

## Action Logging

Most operations create action logs for tracking:

- **Initiated**: Operation started
- **In Progress**: Operation in progress
- **Success**: Operation completed successfully
- **Failed**: Operation failed with reason

## Message Routing

The handler uses a sophisticated routing system:

- **Subscription Scopes**: `subscription:device:{deviceId}`
- **Connection Scopes**: `connection:{connectionId}`
- **User Scopes**: `user:{userId}`
- **Echo Settings**: Configurable message echoing
- **System Messages**: System-generated status updates

## Performance Considerations

- **Timeout Protection**: Prevents hanging operations
- **Offline Detection**: Fast-fail for offline devices
- **Batch Operations**: Efficient database updates
- **Message Batching**: Optimized message publishing
- **Connection Management**: Proper connection scoping

## Security

- **Authentication**: User authentication required for most operations
- **Authorization**: Device ownership validation
- **Input Validation**: Comprehensive payload validation
- **Error Sanitization**: Safe error message handling
- **Connection Security**: Secure WebSocket connections
