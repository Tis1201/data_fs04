# Pushpin Integration Guide

This document explains how Pushpin is integrated into the fs04_web project, focusing on the SvelteKit middleware, the `PushpinConnection` class, and the Redis-based publish mechanism for real-time device messaging.

---

## 1. Pushpin Middleware (`pushpinMiddleware`)

The Pushpin middleware is a SvelteKit `Handle` middleware responsible for:
- Loading all online devices from Redis at server startup
- Registering each device with the `ConnectionManager`
- Subscribing to Redis pub/sub channels to track device status changes in real-time
- Ensuring only a single subscription and device loading occurs per server lifecycle
- Providing the Redis publish capability to each Pushpin connection

**Key Features:**
- Runs after authentication middleware for security
- Uses flags to prevent duplicate subscriptions/device loading
- Publishes messages to devices via Redis

**Example (simplified):**
```typescript
// In pushpin/middleware.ts
async function publish(redisService, channel, message) {
  logger.debug(`Entry to publish: ${channel}:${JSON.stringify(message)}`);
  await redisService.publish(channel, JSON.stringify(message));
}

const publishFn = (channel, message) => publish(redisService, channel, message);
const connection = new PushpinConnection(meta, publishFn);
```

---

## 2. Pushpin Middleware & Device Connection Tracking

This document describes the architecture and operation of the Pushpin middleware as implemented in [`src/lib/server/pushpin/middleware.ts`]. It also explains how Pushpin (WebSocket) and SSE (Server-Sent Events) connections are interchangeable thanks to the unified `Connection` abstraction.

- Handles connection cleanup and status

**Constructor Example:**
```typescript
const connection = new PushpinConnection(meta, publishFn);
```

**Message Publishing Example:**
```typescript
await this.publishFn(`device:${this.meta.deviceId}:messages`, message);
```

---

## 3. Message Publishing Flow

1. **Publishing a Message:**
    - The `PushpinConnection` calls its `publishFn`, which publishes a JSON message to a Redis channel named `device:{deviceId}:messages`.
    - Example:
      ```typescript
      await publish(redisService, 'device:abc123:messages', { type: 'ping', ... });
      ```
2. **Pushpin Delivery:**
    - Pushpin is configured to subscribe to these Redis channels and deliver the messages to the appropriate device over its WebSocket/SSE connection.

**Benefits:**
- Decouples message creation from delivery mechanism
- Allows for easy testing and future extension (e.g., switching to a different broker)

---

## 4. Security and Best Practices
- The middleware only runs after authentication
- Device registration and message publishing are idempotent and safe
- All logs use string interpolation for object serialization
- Only one Redis subscription and device loading per server instance

---

## 5. Example: Full Device Message Publish
```typescript
// In PushpinConnection
async send(payload: unknown): Promise<void> {
  if (!this.isAlive) throw new Error('Connection is closed');
  if (!this.publishFn) throw new Error('No publish function available');
  const channel = `device:${this.meta.deviceId}:messages`;
  await this.publishFn(channel, payload);
}
```

---

## References
- Middleware: `src/lib/server/pushpin/middleware.ts`
- Connection: `src/lib/server/messaging/connections/pushpin_connection.ts`
- Redis Service: `src/lib/server/services/redisService.ts`
