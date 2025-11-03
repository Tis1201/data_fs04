# Real-Time Communication Architecture

**Last Updated**: 2025-10-12  
**Status**: ✅ Production Ready

## Overview

This document provides a comprehensive guide to the real-time communication system, covering Server-Sent Events (SSE), WebSocket connections, Pushpin integration, WebRTC implementation, and best practices for scalable real-time applications handling 100k+ devices.

---

## 🏗️ Architecture Overview

### Complete Real-Time Communication Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      REAL-TIME COMMUNICATION ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           CLIENT SIDE                                  │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   SSE       │  │  WebSocket  │  │   WebRTC    │  │   UI        │    │    │
│  │  │   Store     │  │   Store     │  │   Client    │  │ Components  │    │    │
│  │  │src/lib/     │  │src/lib/     │  │src/lib/     │  │src/routes/  │    │    │
│  │  │stores/      │  │stores/      │  │webrtc/      │  │admin/iot/   │    │    │
│  │  │sse-store.ts │  │websocket-   │  │WebRTCClient.│  │devices/[id]/│    │    │
│  │  │             │  │store.ts     │  │ts           │  │+page.svelte │    │    │
│  │  │ • connect() │  │ • connect() │  │ • connect() │  │ • onMount() │    │    │
│  │  │ • on()      │  │ • send()    │  │ • sendOffer │  │ • handleSSE │    │    │
│  │  │ • sendReq() │  │ • onMessage │  │ • handleAns │  │ • updateUI  │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                        PUSHPIN PROXY                                  │    │
│  │                        docker/pushpin/routes                          │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   SSE       │  │  WebSocket  │  │   GRIP      │  │   Routing   │    │    │
│  │  │   Proxy     │  │   Proxy     │  │   Headers   │  │   Rules     │    │    │
│  │  │             │  │             │  │             │  │             │    │    │
│  │  │ • Grip-Hold │  │ • Upgrade   │  │ • Grip-     │  │ • * fs04-   │    │    │
│  │  │ • Grip-     │  │ • Protocol  │  │   Channel   │  │   web.fs04. │    │    │
│  │  │   Channel   │  │ • Auth      │  │ • Grip-     │  │   svc.      │    │    │
│  │  │ • Grip-     │  │ • Routing   │  │   Keep-Alive│  │   cluster.  │    │    │
│  │  │   Keep-Alive│  │             │  │             │  │   local:3000│    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                           SERVER SIDE                                  │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   SSE       │  │  WebSocket  │  │   Message   │  │ Connection  │    │    │
│  │  │  Handler    │  │  Handler    │  │ Publisher   │  │ Manager     │    │    │
│  │  │src/routes/  │  │src/routes/  │  │src/lib/     │  │src/lib/     │    │    │
│  │  │api/sse/     │  │api/websocket│  │server/      │  │server/      │    │    │
│  │  │+server.ts   │  │/+server.ts  │  │messaging/   │  │messaging/   │    │    │
│  │  │             │  │             │  │publisher.ts │  │connection   │    │    │
│  │  │ • GET()     │  │ • GET()     │  │             │  │Manager.ts   │    │    │
│  │  │ • Stream    │  │ • Upgrade   │  │ • publish() │  │             │    │    │
│  │  │ • Headers   │  │ • Auth      │  │ • publishTo │  │ • register  │    │    │
│  │  │ • Cleanup   │  │ • Message   │  │   User()    │  │   Connection│    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                             │
│                                    ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                            REDIS PUB/SUB                               │    │
│  │                    src/lib/server/redis/client.ts                       │    │
│  │                                                                         │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │    │
│  │  │   Device    │  │   Bundle    │  │   User      │  │   System    │    │    │
│  │  │  Channels   │  │  Channels   │  │  Channels   │  │  Channels   │    │    │
│  │  │             │  │             │  │             │  │             │    │    │
│  │  │ • device:   │  │ • bundle:   │  │ • user:     │  │ • system:   │    │    │
│  │  │   {id}      │  │   {id}      │  │   {id}      │  │   alerts   │    │    │
│  │  │ • device:   │  │ • wave:     │  │ • account:  │  │ • system:   │    │    │
│  │  │   status    │  │   {id}      │  │   {id}      │  │   health   │    │    │
│  │  │ • device:   │  │ • bundle:   │  │ • admin:    │  │ • system:   │    │    │
│  │  │   actions   │  │   progress  │  │   {id}      │  │   metrics  │    │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Client-Side**: SSE stores, WebSocket stores, WebRTC client, UI components
2. **Transport Layer**: Pushpin (WebSocket/SSE proxy), Redis (message broker)
3. **Server-Side**: Connection managers, subscription registry, message publishers
4. **Device Layer**: Go device client with SSE connections

---

## 📡 Server-Sent Events (SSE) Implementation

### Client-Side SSE Store

**File**: [`src/lib/stores/sse-store.ts`](../../src/lib/stores/sse-store.ts)

- **Singleton pattern** - One connection per application
- **Automatic reconnection** with exponential backoff
- **Message routing** and event handling
- **Request/response pattern** with timeouts
- **Message history** management

### Server-Side SSE Handler

**File**: [`src/routes/api/sse/+server.ts`](../../src/routes/api/sse/+server.ts)

- **Connection management** with unique IDs
- **User authentication** and session validation
- **Message subscription** to Redis channels
- **GRIP headers** for Pushpin compatibility
- **Automatic cleanup** on disconnect

### Device SSE Implementation

#### Device Listen Endpoint

**File**: [`src/routes/api/device/listen/+server.ts`](../../src/routes/api/device/listen/+server.ts)

- **API Key Authentication** - Validates device API key via `restrictDevice` guard
- **SSE Stream Creation** - Establishes Server-Sent Events connection
- **Message Subscription** - Subscribes to device-specific Redis channels
- **Real-time Communication** - Receives server commands and status updates
- **Connection Management** - Handles connection lifecycle and cleanup

#### Device Listen Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEVICE LISTEN FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Device    │    │   API Key   │    │   SSE       │    │   Redis     │      │
│  │   Client    │───▶│   Auth      │───▶│ Connection  │───▶│ Subscription│      │
│  │   (Go)      │    │src/lib/     │    │src/routes/  │    │src/lib/     │      │
│  │             │    │server/      │    │api/device/  │    │server/      │      │
│  │ • Connect   │    │security/    │    │listen/      │    │messaging/   │      │
│  │   SSE       │    │guards.ts    │    │+server.ts   │    │             │      │
│  │ • Send API  │    │             │    │             │    │ • Subscribe │      │
│  │   Key       │    │ • Validate  │    │ • Create    │    │   to device │      │
│  │ • Receive   │    │   Key       │    │   Stream    │    │   channels  │      │
│  │   Messages  │    │ • Get       │    │ • Handle    │    │ • Route     │      │
│  │ • Handle    │    │   Device    │    │   Messages  │    │   Messages  │      │
│  │   Commands  │    │   Info      │    │ • Cleanup   │    │ • Publish   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Device Listen Request/Response

**Request Headers**:
```http
x-api-key: <device_api_key>
```

**Response Headers**:
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE Message Format**:
```
data: {"type": "device:claim", "action": "claim", "deviceId": "device_uuid", "payload": {...}}

data: {"type": "device:status", "action": "status", "deviceId": "device_uuid", "payload": {...}}

data: {"type": "device:pushFile", "action": "pushFile", "deviceId": "device_uuid", "payload": {...}}
```

#### Pushpin Device Listen (Alternative)

**File**: [`src/routes/api/device/pushpin/listen/+server.ts`](../../src/routes/api/device/pushpin/listen/+server.ts)

- **Pushpin Integration** - Uses Pushpin proxy for WebSocket/SSE
- **GRIP Headers** - For message routing and connection management
- **Same Authentication** - Uses API key for device validation
- **Production Ready** - Optimized for Kubernetes deployment

**GRIP Headers for Device Listen**:
```http
Grip-Hold: stream
Grip-Channel: device:{deviceId}
Grip-Keep-Alive: :\n\n; format=cstring; timeout=60
```

---

## 🌐 WebSocket Implementation

### Client-Side WebSocket Store

**File**: [`src/lib/stores/websocket-store.ts`](../../src/lib/stores/websocket-store.ts)

- **Session authentication** via query parameters for Pushpin compatibility
- **Message queuing** for offline scenarios
- **Event subscription** system with wildcard support
- **Request/response pattern** with timeouts
- **Automatic reconnection** with exponential backoff

### Server-Side WebSocket Handler

**File**: [`src/routes/api/websocket/+server.ts`](../../src/routes/api/websocket/+server.ts)

- **Session validation** from query params or cookies
- **Connection upgrade** to WebSocket protocol
- **Message routing** for WebRTC, subscriptions, and ping/pong
- **Channel access control** and subscription management
- **Automatic cleanup** on disconnect

---

## 🎥 WebRTC Implementation

### WebRTC Client

**File**: [`src/lib/webrtc/WebRTCClient.ts`](../../src/lib/webrtc/WebRTCClient.ts)

- **Peer connection** management with STUN servers
- **Data channel** for terminal communication
- **Video streaming** for remote desktop
- **ICE candidate** exchange via WebSocket
- **Terminal input/output** handling
- **RDP mouse/keyboard** input methods
- **Svelte stores** for reactive state management

---

## 🔌 Pushpin Integration

### Pushpin Configuration

**File**: [`docker/pushpin/routes`](../../docker/pushpin/routes)

```
# Production routes - points to K8s service
* fs04-web.fs04.svc.cluster.local:3000,over_http,grip
```

### GRIP Headers for SSE

**File**: [`src/lib/server/messaging/sse_connection.ts`](../../src/lib/server/messaging/sse_connection.ts)

```typescript
export function createSSEResponse(stream: ReadableStream, deviceId: string): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Grip-Hold': 'stream',
      'Grip-Channel': `device:${deviceId}`,
      'Grip-Keep-Alive': ':\\n\\n; format=cstring; timeout=60'
    }
  });
}
```

### Message Publishing

**File**: [`src/lib/server/messaging/publisher.ts`](../../src/lib/server/messaging/publisher.ts)

```typescript
export class MessagePublisher {
  private redis: Redis;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    });
  }
  
  async publish(channel: string, message: any) {
    try {
      const messageStr = JSON.stringify(message);
      await this.redis.publish(channel, messageStr);
      logger.debug(`[Publisher] Published to ${channel}:`, message.type);
    } catch (error) {
      logger.error(`[Publisher] Failed to publish to ${channel}:`, error);
    }
  }
  
  async publishToUser(userId: string, message: any) {
    const connections = ConnectionManager.getConnectionsForUser(userId);
    
    for (const connection of connections) {
      await this.publishToConnection(connection, message);
    }
  }
  
  private async publishToConnection(connection: Connection, message: any) {
    if (connection.type === 'sse' && connection.controller) {
      const sseMessage = `data: ${JSON.stringify(message)}\n\n`;
      connection.controller.enqueue(sseMessage);
    } else if (connection.type === 'websocket' && connection.socket) {
      connection.socket.send(JSON.stringify(message));
    }
  }
}
```

---

## 📊 Message Flow Examples

### Example 1: Device Status Update

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DEVICE STATUS UPDATE FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │     UI      │    │     API     │    │   Server    │    │    Redis    │      │
│  │   Action    │───▶│    Call     │───▶│  Handler    │───▶│   Publish   │      │
│  │src/routes/  │    │src/routes/  │    │src/lib/     │    │src/lib/     │      │
│  │admin/iot/   │    │api/devices/ │    │server/      │    │server/      │      │
│  │devices/[id]/│    │[id]/status/ │    │handlers/    │    │messaging/   │      │
│  │+page.svelte │    │+server.ts   │    │deviceStatus │    │publisher.ts │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                   │                   │                   │          │
│         ▼                   ▼                   ▼                   ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Device    │    │   Device    │    │   Device    │    │     UI      │      │
│  │    SSE      │    │ Response    │    │    SSE      │    │    SSE      │      │
│  │src/routes/  │◀───│             │◀───│src/routes/  │◀───│ Update      │      │
│  │api/device/  │    │             │    │api/device/  │    │src/lib/     │      │
│  │pushpin/     │    │             │    │pushpin/     │    │stores/      │      │
│  │listen/      │    │             │    │listen/      │    │sse-store.ts │      │
│  │+server.ts   │    │             │    │+server.ts   │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Example 2: WebRTC Terminal Connection

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      WEBRTC TERMINAL CONNECTION FLOW                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │     UI      │    │  WebSocket  │    │   Server    │    │    Redis    │      │
│  │   Click     │───▶│   Store     │───▶│  Handler    │───▶│   Publish   │      │
│  │src/routes/  │    │src/lib/     │    │src/routes/  │    │src/lib/     │      │
│  │admin/iot/   │    │stores/      │    │api/        │    │server/      │      │
│  │devices/[id]/│    │websocket-   │    │websocket/  │    │messaging/   │      │
│  │terminal/    │    │store.ts     │    │+server.ts  │    │publisher.ts │      │
│  │+page.svelte │    │             │    │            │    │            │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                   │                   │                   │          │
│         ▼                   ▼                   ▼                   ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Device    │    │   Device    │    │   Device    │    │     UI      │      │
│  │    SSE      │    │ WebRTC      │    │    SSE      │    │   WebRTC    │      │
│  │src/routes/  │◀───│ Offer       │◀───│src/routes/  │◀───│ Client      │      │
│  │api/device/  │    │             │    │api/device/  │    │src/lib/     │      │
│  │pushpin/     │    │             │    │pushpin/     │    │webrtc/      │      │
│  │listen/      │    │             │    │listen/      │    │WebRTCClient.│      │
│  │+server.ts   │    │             │    │+server.ts   │    │ts           │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Example 3: Bundle Installation Progress

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     BUNDLE INSTALLATION PROGRESS FLOW                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │     UI      │    │     API     │    │  Database   │    │  Scheduler  │      │
│  │   Create    │───▶│    Call     │───▶│   Update    │───▶│   Process   │      │
│  │   Bundle    │    │src/routes/  │    │prisma/      │    │src/lib/     │      │
│  │src/routes/  │    │api/bundles/ │    │schema.prisma│    │server/      │      │
│  │admin/iot/   │    │+server.ts   │    │             │    │scheduler/   │      │
│  │bundles/new/ │    │             │    │             │    │bundleStatus │      │
│  │+page.svelte │    │             │    │             │    │Scheduler.ts │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                   │                   │                   │          │
│         ▼                   ▼                   ▼                   ▼          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ ClickHouse  │    │   Event     │    │    Redis    │    │     UI      │      │
│  │   Events    │    │ Processor   │    │   Publish   │    │    SSE      │      │
│  │src/lib/     │◀───│src/lib/     │◀───│src/lib/     │◀───│ Update      │      │
│  │server/      │    │server/      │    │server/      │    │src/lib/     │      │
│  │clickhouse/  │    │scheduler/   │    │redis/       │    │stores/      │      │
│  │client.ts    │    │bundleEvent  │    │client.ts    │    │sse-store.ts │      │
│  │             │    │Processor.ts │    │             │    │             │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Performance Optimization

### Connection Pooling

**HTTP/1.1 for Device Clients**:
```go
// Force HTTP/1.1 to avoid HTTP/2 stream issues
transport := &http.Transport{
    ForceAttemptHTTP2: false, // Disable HTTP/2
    MaxIdleConns:      10,
    IdleConnTimeout:   90 * time.Second,
    // Disable HTTP/2 ALPN negotiation
    TLSNextProto: make(map[string]func(authority string, c *tls.Conn) http.RoundTripper),
}
```

### Message Filtering

**Prevent Unnecessary Echoes**:
```typescript
// Filter out status updates for device connections
if (this.meta.deviceId === this.meta.id && 
    (messageType === 'device:statusUpdate' || messageType === 'device:dataUpdate')) {
  logger.debug(`Skipping ${messageType} for device connection ${this.meta.id}`);
  return;
}
```

### Load Balancer Configuration

**GCP Load Balancer Timeout**:
```bash
# Increase backend timeout for long-lived connections
gcloud compute backend-services update [BACKEND_SERVICE_NAME] \
  --timeout=3600 \
  --global
```

---

## 🧪 Testing & Monitoring

### Connection Testing

**SSE Connection Test**:
```typescript
// Test SSE connection with timeout
async function testSSEConnection(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const eventSource = new EventSource(url);
    const timeout = setTimeout(() => {
      eventSource.close();
      resolve(false);
    }, 5000);
    
    eventSource.onopen = () => {
      clearTimeout(timeout);
      eventSource.close();
      resolve(true);
    };
    
    eventSource.onerror = () => {
      clearTimeout(timeout);
      eventSource.close();
      resolve(false);
    };
  });
}
```

### Monitoring

**Connection Metrics**:
```typescript
// Track connection health
const metrics = {
  activeConnections: 0,
  totalConnections: 0,
  failedConnections: 0,
  averageConnectionTime: 0,
  messagesPerSecond: 0
};

// Log connection events
logger.info('[SSE] Connection metrics', {
  active: metrics.activeConnections,
  total: metrics.totalConnections,
  failed: metrics.failedConnections
});
```

---

## 🔧 Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Check GCP Load Balancer timeout settings
   - Verify Pushpin GRIP headers
   - Ensure heartbeats are being sent

2. **Authentication Failures**
   - Use query parameters for WebSocket auth
   - Verify session validation in middleware
   - Check cookie forwarding through Pushpin

3. **Multi-Tab Issues**
   - Ensure unique subscription IDs per tab
   - Use proper cleanup in onDestroy
   - Avoid singleton SSE conflicts

4. **Device Disconnections**
   - Check HTTP/2 vs HTTP/1.1 configuration
   - Verify message filtering prevents echoes
   - Monitor subscription registry cleanup

### Debug Commands

**Redis Subscription Check**:
```bash
# Check active subscriptions
redis-cli SMEMBERS "subscription:device:device-id:subscribers"

# Monitor Redis pub/sub
redis-cli MONITOR
```

**Pushpin Routes Verification**:
```bash
# Check Pushpin routes in pod
kubectl exec -n fs04 deployment/pushpin -c pushpin -- cat /etc/pushpin/routes
```

---

## 📚 Related Documentation

- [System Architecture](../system/SYSTEM_ARCHITECTURE.md) - Complete system design
- [Device Management](../device/DEVICE_MANAGEMENT.md) - Device lifecycle and API reference
- [Troubleshooting](./TROUBLESHOOTING.md) - All fixes and debugging guides

---

## 🔑 Key Takeaways

1. **Use singleton SSE connections** - One connection per application
2. **Implement exponential backoff** - For robust reconnection
3. **Validate all messages** - Use Zod schemas for type safety
4. **Filter unnecessary messages** - Prevent device status echoes
5. **Use unique subscription IDs** - For multi-tab support
6. **Configure timeouts properly** - GCP Load Balancer, connection timeouts
7. **Monitor connection health** - Track metrics and log events
8. **Test in production-like environments** - Local vs production differences matter

---

**Status**: ✅ Production ready with comprehensive error handling and monitoring.
