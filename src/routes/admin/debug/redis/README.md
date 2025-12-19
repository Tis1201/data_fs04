# Redis Debug Page

## Overview

The Redis Debug Page (`/admin/debug/redis`) is an administrative tool that provides a web interface for interacting with Redis directly. It allows administrators to perform basic Redis operations, inspect device connection status, and publish messages to devices for debugging purposes.

## Access

- **URL**: `http://localhost:5173/admin/debug/redis`
- **Access Level**: Admin only (requires `SystemRole.ADMIN`)
- **Prerequisites**: Redis must be configured in `.env` (used for MQTT queue and device presence)

## Features

### 1. Redis Key-Value Operations

#### Set Value
- **Purpose**: Store a key-value pair in Redis with optional TTL
- **Fields**:
  - **Key**: Redis key name
  - **Value**: Value to store
  - **TTL**: Time-to-live in seconds (optional, default: 3600)
- **Example**:
  ```
  Key: test:key
  Value: test value
  TTL: 3600
  ```

#### Get Value
- **Purpose**: Retrieve a value from Redis by key
- **Fields**:
  - **Key**: Redis key to search for
- **Features**:
  - Shows whether the key exists
  - Displays the value if found
  - Recent keys are saved for quick access
  - Delete button available for found keys

#### Delete Key
- **Purpose**: Remove a key from Redis
- **Access**: Click the trash icon next to a found key
- **Confirmation**: Immediate deletion (no confirmation dialog)

### 2. Connected Devices Management

#### Device List
- **Purpose**: View all devices connected through MQTT
- **Features**:
  - Lists all devices with `device:*:status` keys
  - Shows device connection status (online/offline)
  - Displays device metadata:
    - First connected timestamp
    - Last disconnected timestamp
    - Connection count
    - Connection history
  - Refresh button to reload device list

#### Device Status Indicators
- **Online**: Green WiFi icon
- **Offline**: Red WiFi-off icon
- **Status Badge**: Visual indicator of current connection state

#### Publish Message to Device
- **Purpose**: Send a message to a connected device via Redis Pub/Sub
- **Access**: Click "Publish" button next to an online device
- **Message Format**: JSON object
- **Example Message**:
  ```json
  {
    "action": "message",
    "type": "notification",
    "message": "Hello from admin"
  }
  ```
- **Delivery**: Message is published to the `messages` Redis channel and relayed to the device through MQTT

### 3. Special Commands

The page supports several special Redis commands via POST requests:

#### KEYS Command
- **Purpose**: List all keys matching a pattern
- **Security**: Only `device:*` patterns are allowed
- **Usage**: 
  ```json
  {
    "key": "device:*:status",
    "value": "_KEYS_PATTERN_",
    "command": "keys"
  }
  ```
- **Response**: Array of matching keys

#### LRANGE Command
- **Purpose**: Get a range of elements from a Redis list
- **Security**: Only `device:*` patterns are allowed
- **Usage**:
  ```json
  {
    "key": "device:device-id:history",
    "value": "0 9",
    "command": "lrange"
  }
  ```
- **Response**: Array of list elements (e.g., last 10 history entries)

#### PUBLISH Command
- **Purpose**: Publish a message to a device via Redis Pub/Sub
- **Usage**:
  ```json
  {
    "key": "device-id",
    "value": "{\"action\":\"message\",\"type\":\"notification\"}",
    "command": "publish"
  }
  ```
- **Delivery**: Message is published to the `messages` channel and relayed to the device

## API Endpoints

### GET `/admin/debug/redis?key=<key>`
Retrieve a value from Redis.

**Query Parameters**:
- `key` (required): Redis key to retrieve

**Response**:
```json
{
  "key": "example:key",
  "value": "example value",
  "exists": true
}
```

### POST `/admin/debug/redis`
Set a value, execute special commands, or publish messages.

**Request Body** (Set Value):
```json
{
  "key": "example:key",
  "value": "example value",
  "ttl": 3600
}
```

**Request Body** (KEYS Command):
```json
{
  "key": "device:*:status",
  "value": "_KEYS_PATTERN_",
  "command": "keys"
}
```

**Request Body** (LRANGE Command):
```json
{
  "key": "device:device-id:history",
  "value": "0 9",
  "command": "lrange"
}
```

**Request Body** (PUBLISH Command):
```json
{
  "key": "device-id",
  "value": "{\"action\":\"message\"}",
  "command": "publish"
}
```

**Response** (Set Value):
```json
{
  "success": true,
  "key": "example:key",
  "ttl": 3600
}
```

**Response** (KEYS Command):
```json
{
  "success": true,
  "keys": ["device:device1:status", "device:device2:status"]
}
```

**Response** (LRANGE Command):
```json
{
  "success": true,
  "result": ["entry1", "entry2", "entry3"]
}
```

**Response** (PUBLISH Command):
```json
{
  "success": true,
  "recipients": 1,
  "channel": "device-id"
}
```

### DELETE `/admin/debug/redis`
Delete a key from Redis.

**Request Body**:
```json
{
  "key": "example:key"
}
```

**Response**:
```json
{
  "success": true,
  "key": "example:key",
  "deleted": true
}
```

## Security

1. **Admin Only**: All endpoints are restricted to users with `SystemRole.ADMIN`
2. **Pattern Restrictions**: 
   - `KEYS` command only allows `device:*` patterns
   - `LRANGE` command only allows `device:*` patterns
3. **Audit Logging**: All operations are logged with the user ID
4. **Redis Service Check**: Endpoints verify Redis is available before operations

## Use Cases

### 1. Debugging Device Connections
- Check if a device is online: Search for `presence:device:<device-id>`
- View device status: Search for `device:<device-id>:status`
- View device metadata: Search for `device:<device-id>:meta`
- View connection history: Use LRANGE on `device:<device-id>:history`

### 2. Testing Message Delivery
- Publish test messages to devices
- Verify message format and delivery
- Test device response to different message types

### 3. Redis Key Inspection
- Inspect any Redis key value
- Check key existence
- View stored data structures

### 4. Manual Redis Operations
- Set temporary test data
- Delete test keys
- Manage Redis keys during development

## Common Redis Keys

### Device Presence
- `presence:device:<device-id>`: Device presence key (TTL: 300s)
- `device:<device-id>:status`: Device connection status
- `device:<device-id>:meta`: Device metadata (JSON)
- `device:<device-id>:history`: Connection history (list)

### Bundle Processing
- `bundle:<bundle-id>:state`: Bundle processing state
- `wave:<wave-id>:timeout`: Wave timeout tracking

### Messaging
- `messages`: Redis Pub/Sub channel for device messages
- `device_status_changes`: Redis Pub/Sub channel for status updates

## Error Handling

### Common Errors

1. **Redis Service Not Available**
   - **Error**: `Redis service not available. Make sure Redis is configured in your .env file.`
   - **Solution**: Ensure Redis configuration is set in `.env` (REDIS_URL or REDIS_HOST/REDIS_PORT) and Redis is running

2. **Key Pattern Not Allowed**
   - **Error**: `Only device: key patterns are allowed for security reasons`
   - **Solution**: Use only `device:*` patterns for KEYS and LRANGE commands

3. **Invalid JSON**
   - **Error**: `Invalid JSON format. Please check your message content.`
   - **Solution**: Ensure message content is valid JSON when publishing

4. **Key Not Found**
   - **Response**: `exists: false`
   - **Solution**: Verify the key name or check if it has expired (TTL)

## Technical Details

### Implementation Files
- **UI Component**: `src/routes/admin/debug/redis/+page.svelte`
- **API Endpoint**: `src/routes/admin/debug/redis/+server.ts`
- **Redis Service**: `src/lib/server/services/redisService.ts`

### Dependencies
- `@sveltejs/kit`: Framework
- `ioredis`: Redis client
- `svelte-sonner`: Toast notifications
- `lucide-svelte`: Icons

### Redis Service
The page uses `getRedisService(locals)` to access the Redis client. The service provides:
- `get(key)`: Get value
- `set(key, value, ttl?)`: Set value with optional TTL
- `del(key)`: Delete key
- `client.keys(pattern)`: List keys (direct client access)
- `client.lrange(key, start, stop)`: Get list range (direct client access)
- `publish(channel, message)`: Publish to Pub/Sub channel

## Best Practices

1. **Use for Debugging Only**: This tool is for development and debugging. Avoid using it in production for regular operations.

2. **Check Key Patterns**: Before deleting keys, verify they are not critical system keys.

3. **Monitor TTL**: When setting keys, consider appropriate TTL values to avoid memory leaks.

4. **Test Messages**: When publishing test messages, use clear action types and verify device handlers.

5. **Clean Up**: Delete test keys after debugging to keep Redis clean.

## Limitations

1. **Pattern Restrictions**: Only `device:*` patterns are allowed for security
2. **Admin Only**: Regular users cannot access this page
3. **No Batch Operations**: Operations are performed one at a time
4. **No Key Expiration View**: TTL is not displayed for existing keys
5. **Limited Command Support**: Only GET, SET, DELETE, KEYS, LRANGE, and PUBLISH are supported

## Future Enhancements

Potential improvements:
- Display TTL for existing keys
- Support for more Redis commands (HGET, HSET, etc.)
- Batch operations
- Key pattern search with wildcards
- Export/import functionality
- Redis connection status indicator
- Memory usage statistics

