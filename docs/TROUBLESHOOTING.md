# Troubleshooting Guide

**Last Updated**: 2025-10-12  
**Status**: ✅ Production Ready

## Overview

This comprehensive troubleshooting guide consolidates all known issues, fixes, debugging techniques, and performance optimization strategies for the IoT Management System. It covers device management, real-time communication, performance issues, and system configuration problems.

---

## 🚨 Critical Issues & Fixes

### Device Connection & Disconnection Issues

#### Problem: UI Not Detecting Device Disconnects
**Status**: ✅ Fixed (2025-10-12)

**Symptom**: When a device disconnects, the UI remains showing "online" status indefinitely.

**Root Cause**: The `cancel()` function in the SSE stream cleanup only performed cleanup tasks but never published a disconnect event to UI subscribers.

**Solution**:
```typescript
// File: src/routes/api/device/pushpin/listen/+server.ts
async cancel() {
  logger.info(`[Pushpin] SSE stream cancelled for device ${device.id}`);
  clearInterval(heartbeatInterval);
  
  // ✅ Publish disconnect event to UI BEFORE cleanup
  try {
    const disconnectMessage = MessageFactory.createSystemMessage(
      'device:connection',
      `subscription:device:${device.id}`,
      { 
        deviceId: device.id, 
        connected: false, 
        disconnectedAt: new Date().toISOString(), 
        protocol: 'sse' 
      },
      userInfo,
      { echoToSender: false, excludeDevices: true }
    );
    await publisher.publish(disconnectMessage);
    logger.info(`[Pushpin] Disconnect event published for device ${device.id}`);
  } catch (e) {
    logger.warn('[Pushpin] Failed to publish disconnect event', {
      error: e instanceof Error ? e.message : String(e)
    });
  }
  
  // ... rest of cleanup
}
```

**Result**: UI now immediately updates to "offline" when a device disconnects.

---

#### Problem: UI Not Detecting Device Reconnects (After 2nd+ Time)
**Status**: ✅ Fixed (2025-10-12)

**Symptom**: 
- 1st connection: ✅ UI updates to "online"
- Disconnect: ✅ UI updates to "offline"
- 2nd connection: ✅ UI updates to "online"
- 2nd disconnect: ✅ UI updates to "offline"
- **3rd connection: ❌ UI stays "offline"**

**Root Cause**: When a device disconnected, the cleanup code was using `subscriptionRegistry.remove()` which removed **ALL subscriptions** for that device channel, including UI client subscriptions.

**Solution**:
```typescript
// File: src/routes/api/device/pushpin/listen/+server.ts
// ❌ BEFORE: Nuclear option - removes ALL subscriptions
subscriptionRegistry.remove(`subscription:device:${device.id}`)

// ✅ AFTER: Surgical removal - removes ONLY this device's subscription
subscriptionRegistry.removeSubscription(
  `subscription:device:${device.id}`,       // The channel
  `subscriber:connection:${device.id}`      // Only this device's scope
)
```

**Result**: UI subscriptions remain intact across device reconnections.

---

#### Problem: Duplicate Device Subscriptions
**Status**: ✅ Fixed (2025-10-12)

**Symptom**: Server logs showed the same device connection appearing multiple times in the subscription list.

**Root Cause**: When a device reconnected rapidly or had a stale connection, the new connection registration would add a duplicate subscription without removing the old one first.

**Solution**:
```typescript
// File: src/routes/api/device/pushpin/listen/+server.ts
try {
  // ✅ Unregister any existing connection to prevent duplicates
  ConnectionManager.unregisterConnection(device.id);
  
  const connection = new PushpinConnection(
    { id: device.id, userInfo, nodeId: 'device-pushpin-listen', protocol: 'pushpin', deviceId: device.id, connectedAt: Date.now() },
    publishFn
  );
  ConnectionManager.registerConnection(connection);
} catch (e) {
  logger.warn('[Pushpin] Connection registration failed', { error });
}

try {
  // ✅ Remove any existing subscription for this device to prevent duplicates
  await subscriptionRegistry.removeSubscription(
    `subscription:device:${device.id}`,
    `subscriber:connection:${device.id}`
  ).catch(() => {}); // Ignore errors if it doesn't exist
  
  // Now add the new subscription
  await subscriptionRegistry.addSubscription(
    `subscription:device:${device.id}`,
    `subscriber:connection:${device.id}`
  );
} catch (e) {
  logger.warn('[Pushpin] Subscription setup failed', { error });
}
```

**Result**: Clean, idempotent connection registration with no duplicates.

---

### WebSocket Connection Issues

#### Problem: WebSocket Connections Failing in Production
**Status**: ✅ Fixed (2025-10-12)

**Symptom**:
```
WebSocket connection to 'wss://iot-dev-2.datarealities-gcp.com/websocket' failed
Max reconnection attempts reached, giving up
```

**Root Cause**: Pushpin `routes` file was configured for local development (`host.docker.internal:5173`) instead of the production Kubernetes service.

**Solution**:
```bash
# Update Pushpin Routes ConfigMap
kubectl create configmap pushpin-config \
  --from-literal=routes="* fs04-web.fs04.svc.cluster.local:3000,over_http,grip" \
  --namespace=fs04 \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Pushpin
kubectl rollout restart deployment/pushpin -n fs04

# Verify
PUSHPIN_POD=$(kubectl get pods -n fs04 -l app=pushpin -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n fs04 "${PUSHPIN_POD}" -c pushpin -- cat /etc/pushpin/routes
```

**Result**: WebSocket connections now route correctly to the backend service.

---

#### Problem: WebSocket Authentication Failures
**Status**: ✅ Fixed (2025-10-12)

**Symptom**:
```
✅ WebSocket Connected!
❌ Closed: 1008 No authentication method provided
```

**Root Cause**: Pushpin doesn't reliably forward `Cookie` headers during WebSocket upgrade, and WebSocket middleware was only checking cookies, not query parameters.

**Solution**:

**Client-Side** (`src/lib/stores/websocket-store.ts`):
```typescript
const connect = (queryParams = '') => {
  // Get session cookie to pass as query parameter (for Pushpin compatibility)
  const sessionCookie = document.cookie.split('; ').find(row => row.startsWith('auth_session='));
  const sessionId = sessionCookie ? sessionCookie.split('=')[1] : null;
  
  // Build query params with session if available
  const params = new URLSearchParams(queryParams);
  if (sessionId && !params.has('session')) {
    params.set('session', sessionId);
  }
  const queryString = params.toString();

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const url = `${protocol}//${host}${WS_URL_PATH}${queryString ? '?' + queryString : ''}`;

  socket = new WebSocket(url);
  // ...
};
```

**Server-Side** (`src/lib/server/websocket/middleware.ts`):
```typescript
// Try to get session ID from query string first (for Pushpin compatibility)
const url = new URL(request.url || '', `http://${request.headers.host}`);
let currentSessionId = url.searchParams.get('session') || url.searchParams.get(lucia.sessionCookieName);
let currentAccountId = url.searchParams.get('account_id');

// Fall back to cookies if not in query string
if (!currentSessionId) {
  const rawCookieHeader = request.headers.cookie || '';
  const parsed = cookie.parse(rawCookieHeader);
  currentSessionId = parsed[lucia.sessionCookieName];
  currentAccountId = parsed['current_account_id'];
}

if (!currentSessionId) {
  ws.close(1008, "No authentication method provided");
  return;
}

// Validate session directly with Lucia (event.locals.auth not available in WS context)
const sessionValidation = await lucia.validateSession(currentSessionId);

if (!sessionValidation.session || !sessionValidation.user) {
  ws.close(1008, "Invalid or expired session");
  return;
}
```

**Result**: WebSocket connections now authenticate successfully via query parameters when cookies aren't forwarded.

---

### HTTP/2 Device Client Issues

#### Problem: Device SSE Connections Disconnecting with Stream Error
**Status**: ✅ Fixed (2025-10-12)

**Symptom**:
```
ERRO[0030] Error reading SSE events: stream error: stream ID 1; INTERNAL_ERROR; received from peer
```

**Root Cause**: GCP Load Balancer and infrastructure use HTTP/2 by default. When device received too many messages (including its own status echoes), the HTTP/2 stream would close with `INTERNAL_ERROR`.

**Solution**:

**Device Client** (`fs04_device/internal/module/sse_service.go`):
```go
// Force HTTP/1.1 to avoid HTTP/2 stream issues with load balancers/proxies
// HTTP/2 can cause "stream error: INTERNAL_ERROR" when infrastructure closes streams
transport := &http.Transport{
    ForceAttemptHTTP2: false, // Disable HTTP/2, use HTTP/1.1 only
    MaxIdleConns:      10,
    IdleConnTimeout:   90 * time.Second,
    // Disable HTTP/2 by setting TLSNextProto to empty map (prevents ALPN negotiation)
    TLSNextProto: make(map[string]func(authority string, c *tls.Conn) http.RoundTripper),
}

sse := &SSEService{
    // ...
    httpClient: &http.Client{Timeout: 0, Transport: transport}, // No timeout for SSE, force HTTP/1.1
}
```

**Server-Side Filter** (`src/lib/server/messaging/connections/sse_connection.ts`):
```typescript
async send(payload: unknown): Promise<void> {
  if (!this.isAlive || this.controllerClosed) {
    throw new Error('Connection is closed');
  }
  try {
    const messageType = (payload as any)?.type;
    // Filter out status/data updates for device connections
    if (this.meta.deviceId === this.meta.id && 
        (messageType === 'device:statusUpdate' || messageType === 'device:dataUpdate')) {
      logger.debug(`[SSEConnection] Skipping ${messageType} for device connection ${this.meta.id}`);
      return;
    }
    
    const data = JSON.stringify({
      ...(payload as object),
      timestamp: new Date().toISOString()
    });
    const message = `data: ${data}\n\n`;
    this.controller.enqueue(new TextEncoder().encode(message));
  } catch (error) {
    logger.error(`[SSEConnection] Failed to send message: ${error}`);
    throw error;
  }
}
```

**Result**: Device connections remain stable indefinitely with HTTP/1.1 and reduced message volume.

---

## 🔧 Common Issues & Solutions

### Device Management Issues

#### Device Registration Failures

**Symptoms**:
- Device registration returns 400/401 errors
- PIN validation failures
- Factory JWT authentication errors

**Debug Steps**:
1. **Check Factory JWT**:
   ```bash
   # Verify JWT token
   echo "JWT_TOKEN" | base64 -d
   
   # Check JWT claims
   jwt decode JWT_TOKEN
   ```

2. **Validate PIN Format**:
   ```bash
   # PIN should be 6 digits
   echo "123456" | grep -E '^[0-9]{6}$'
   ```

3. **Check MAC Address**:
   ```bash
   # Verify MAC format
   echo "AA:BB:CC:DD:EE:FF" | grep -E '^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}$'
   ```

**Solutions**:
- Verify factory JWT has correct `aud: 'device-register'`, `typ: 'factory'`, `scope: 'device:register'`
- Ensure PIN is exactly 6 digits
- Check MAC address format and uniqueness
- Verify preclaim status if applicable

#### Device Authentication Errors

**Symptoms**:
- API key authentication failures
- Device not found errors
- Permission denied errors

**Debug Steps**:
1. **Check API Key**:
   ```bash
   # Test API key authentication
   curl -H "x-api-key: DEVICE_API_KEY" http://localhost:3000/api/device/jwt
   ```

2. **Verify Device Status**:
   ```sql
   -- Check device in database
   SELECT id, name, status, connected, apiKey FROM Device WHERE apiKey = 'DEVICE_API_KEY';
   ```

3. **Check User Permissions**:
   ```sql
   -- Verify user has access to device
   SELECT d.id, d.name, u.email, am.role 
   FROM Device d 
   JOIN User u ON d.createdBy = u.id 
   JOIN AccountMembership am ON u.id = am.userId 
   WHERE d.apiKey = 'DEVICE_API_KEY';
   ```

**Solutions**:
- Verify API key format and existence
- Check device status in database
- Verify user permissions and account membership
- Review audit logs for authentication attempts

### Real-Time Communication Issues

#### SSE Connection Problems

**Symptoms**:
- SSE connections fail to establish
- Connections drop frequently
- Messages not received

**Debug Steps**:
1. **Test SSE Connection**:
   ```bash
   # Test SSE endpoint
   curl -H "x-api-key: DEVICE_API_KEY" -N http://localhost:3000/api/device/pushpin/listen
   ```

2. **Check Pushpin Status**:
   ```bash
   # Check Pushpin routes
   kubectl exec -n fs04 deployment/pushpin -c pushpin -- cat /etc/pushpin/routes
   
   # Check Pushpin logs
   kubectl logs -n fs04 deployment/pushpin -c pushpin --tail=100
   ```

3. **Verify Redis Connectivity**:
   ```bash
   # Test Redis connection
   redis-cli ping
   
   # Check Redis subscriptions
   redis-cli SMEMBERS "subscription:device:DEVICE_ID:subscribers"
   ```

**Solutions**:
- Check network connectivity and firewall rules
- Verify Pushpin configuration and routes
- Ensure Redis is accessible and responsive
- Check GCP Load Balancer timeout settings

#### WebSocket Connection Issues

**Symptoms**:
- WebSocket connections fail to upgrade
- Authentication failures
- Connection drops

**Debug Steps**:
1. **Test WebSocket Connection**:
   ```javascript
   // Test WebSocket connection
   const ws = new WebSocket('ws://localhost:3000/api/websocket?session=SESSION_ID');
   ws.onopen = () => console.log('Connected');
   ws.onerror = (error) => console.error('Error:', error);
   ws.onclose = (event) => console.log('Closed:', event.code, event.reason);
   ```

2. **Check Session Validation**:
   ```bash
   # Test session endpoint
   curl -H "Cookie: auth_session=SESSION_ID" http://localhost:3000/api/auth/session
   ```

3. **Verify WebSocket Middleware**:
   ```bash
   # Check WebSocket middleware logs
   tail -f logs/websocket.log | grep "WebSocket"
   ```

**Solutions**:
- Use query parameter authentication for Pushpin compatibility
- Verify session validity and expiration
- Check WebSocket middleware configuration
- Ensure proper CORS settings

### Performance Issues

#### Connection Exhaustion

**Symptoms**:
- `ETIMEDOUT` errors during load testing
- Connection pool exhaustion
- High latency under load

**Debug Steps**:
1. **Monitor Connection Counts**:
   ```bash
   # Check active connections
   netstat -an | grep :3000 | wc -l
   
   # Check connection limits
   ulimit -n
   ```

2. **Load Testing**:
   ```bash
   # Run load test with reduced concurrency
   node load-test-device-registration.js --concurrent 50 --total 1000
   ```

3. **Monitor Resource Usage**:
   ```bash
   # Check memory usage
   ps aux | grep node
   
   # Check CPU usage
   top -p $(pgrep node)
   ```

**Solutions**:
- Reduce concurrency in load testing
- Implement connection pooling
- Optimize database queries
- Add connection limits and timeouts

#### Memory Leaks

**Symptoms**:
- Memory usage increases over time
- Application becomes unresponsive
- Out of memory errors

**Debug Steps**:
1. **Monitor Memory Usage**:
   ```bash
   # Check memory usage over time
   while true; do
     ps aux | grep node | awk '{print $4, $6}'
     sleep 10
   done
   ```

2. **Check for Unclosed Connections**:
   ```bash
   # Check for open file descriptors
   lsof -p $(pgrep node) | wc -l
   ```

3. **Analyze Heap Dumps**:
   ```bash
   # Generate heap dump
   kill -USR2 $(pgrep node)
   
   # Analyze with Chrome DevTools
   node --inspect app.js
   ```

**Solutions**:
- Implement proper cleanup in `onDestroy` hooks
- Close all connections and subscriptions
- Use weak references where appropriate
- Monitor and limit connection counts

### Database Issues

#### PostgreSQL Performance Problems

**Symptoms**:
- Slow query performance
- Connection timeouts
- High CPU usage

**Debug Steps**:
1. **Check Slow Queries**:
   ```sql
   -- Enable slow query logging
   SET log_min_duration_statement = 1000;
   
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Monitor Connection Pool**:
   ```sql
   -- Check active connections
   SELECT count(*) FROM pg_stat_activity;
   
   -- Check connection limits
   SHOW max_connections;
   ```

3. **Analyze Query Performance**:
   ```sql
   -- Explain query plan
   EXPLAIN ANALYZE SELECT * FROM Device WHERE apiKey = 'API_KEY';
   ```

**Solutions**:
- Add proper database indexes
- Optimize query patterns
- Increase connection pool size
- Use read replicas for read-heavy workloads

#### Redis Memory Issues

**Symptoms**:
- Redis out of memory errors
- Slow Redis operations
- Connection failures

**Debug Steps**:
1. **Check Redis Memory Usage**:
   ```bash
   # Check memory usage
   redis-cli info memory
   
   # Check memory limits
   redis-cli config get maxmemory
   ```

2. **Monitor Redis Operations**:
   ```bash
   # Monitor Redis commands
   redis-cli monitor
   
   # Check slow operations
   redis-cli slowlog get 10
   ```

3. **Analyze Key Usage**:
   ```bash
   # Check key count
   redis-cli dbsize
   
   # Check key patterns
   redis-cli keys "*device*" | wc -l
   ```

**Solutions**:
- Set appropriate memory limits
- Configure eviction policies
- Optimize key expiration
- Use Redis clustering for large datasets

---

## 🛠️ Debug Commands & Tools

### Connection Monitoring

#### Redis Commands
```bash
# Check active subscriptions
redis-cli SMEMBERS "subscription:device:DEVICE_ID:subscribers"

# Monitor Redis pub/sub
redis-cli MONITOR

# Check Redis memory usage
redis-cli info memory

# Check Redis slow operations
redis-cli slowlog get 10
```

#### Database Commands
```bash
# Check device status
psql -c "SELECT id, name, status, connected, apiKey FROM Device WHERE macAddress = 'MAC_ADDRESS';"

# Check user permissions
psql -c "SELECT d.id, d.name, u.email, am.role FROM Device d JOIN User u ON d.createdBy = u.id JOIN AccountMembership am ON u.id = am.userId WHERE d.apiKey = 'API_KEY';"

# Check slow queries
psql -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
```

#### Kubernetes Commands
```bash
# Check Pushpin routes
kubectl exec -n fs04 deployment/pushpin -c pushpin -- cat /etc/pushpin/routes

# Check Pushpin logs
kubectl logs -n fs04 deployment/pushpin -c pushpin --tail=100

# Check pod status
kubectl get pods -n fs04

# Check service endpoints
kubectl get endpoints -n fs04
```

### Performance Monitoring

#### Load Testing
```bash
# Device registration load test
node load-test-device-registration.js --concurrent 50 --total 1000

# API endpoint testing
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:3000/api/device/jwt" \
  -H "x-api-key: DEVICE_API_KEY"

# WebSocket connection test
node test-websocket-connections.js --concurrent 100 --duration 60
```

#### System Monitoring
```bash
# Check system resources
htop
iostat -x 1
netstat -i

# Check application logs
tail -f logs/application.log | grep ERROR
tail -f logs/websocket.log | grep "Connection"
tail -f logs/sse.log | grep "Device"
```

### Network Debugging

#### Connection Testing
```bash
# Test SSE connection
curl -H "x-api-key: DEVICE_API_KEY" -N http://localhost:3000/api/device/pushpin/listen

# Test WebSocket connection
wscat -c "ws://localhost:3000/api/websocket?session=SESSION_ID"

# Test API endpoints
curl -H "x-api-key: DEVICE_API_KEY" http://localhost:3000/api/device/jwt
```

#### Network Analysis
```bash
# Check network connectivity
ping google.com
traceroute google.com

# Check port availability
netstat -tulpn | grep :3000
lsof -i :3000

# Check firewall rules
iptables -L
ufw status
```

---

## 📊 Performance Optimization

### Database Optimization

#### Indexing Strategy
```sql
-- Device table indexes
CREATE INDEX idx_device_api_key ON Device(apiKey);
CREATE INDEX idx_device_mac_address ON Device(macAddress);
CREATE INDEX idx_device_status ON Device(status);
CREATE INDEX idx_device_connected ON Device(connected);

-- Bundle logs indexes
CREATE INDEX idx_bundle_logs_device_id ON BundleLogs(deviceId);
CREATE INDEX idx_bundle_logs_bundle_id ON BundleLogs(bundleId);
CREATE INDEX idx_bundle_logs_timestamp ON BundleLogs(timestamp);
CREATE INDEX idx_bundle_logs_status ON BundleLogs(status);
```

#### Query Optimization
```sql
-- Use proper WHERE clauses
SELECT * FROM Device WHERE apiKey = 'API_KEY' AND status = 'ACTIVE';

-- Use LIMIT for large result sets
SELECT * FROM BundleLogs WHERE deviceId = 'DEVICE_ID' ORDER BY timestamp DESC LIMIT 100;

-- Use JOINs instead of subqueries
SELECT d.*, u.email FROM Device d JOIN User u ON d.createdBy = u.id WHERE d.status = 'ACTIVE';
```

### Redis Optimization

#### Memory Management
```bash
# Set memory limits
redis-cli config set maxmemory 2gb
redis-cli config set maxmemory-policy allkeys-lru

# Optimize key expiration
redis-cli config set expire-check-interval 10
redis-cli config set expire-check-keys 100
```

#### Connection Pooling
```typescript
// Redis connection pool configuration
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxLoadingTimeout: 10000,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  db: 0
});
```

### Application Optimization

#### Connection Management
```typescript
// Connection pooling for database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error'],
  // Connection pool settings
  __internal: {
    engine: {
      connectTimeout: 60000,
      queryTimeout: 30000,
      poolTimeout: 30000,
      maxConnections: 20,
      minConnections: 5
    }
  }
});
```

#### Memory Management
```typescript
// Proper cleanup in Svelte components
onDestroy(() => {
  // Close SSE connections
  if (sseConnection) {
    sseConnection.close();
  }
  
  // Close WebSocket connections
  if (wsConnection) {
    wsConnection.close();
  }
  
  // Clear intervals and timeouts
  if (interval) {
    clearInterval(interval);
  }
  
  if (timeout) {
    clearTimeout(timeout);
  }
});
```

---

## 🔍 Monitoring & Alerting

### Key Metrics to Monitor

#### System Metrics
- **CPU Usage**: < 80% average
- **Memory Usage**: < 85% of available
- **Disk I/O**: < 80% of capacity
- **Network I/O**: Monitor for spikes

#### Application Metrics
- **Response Time**: < 100ms average
- **Error Rate**: < 1% of requests
- **Connection Count**: Monitor for limits
- **Queue Depth**: Monitor message queues

#### Database Metrics
- **Query Performance**: < 100ms average
- **Connection Pool**: Monitor utilization
- **Slow Queries**: Alert on > 1s queries
- **Lock Contention**: Monitor for deadlocks

### Alerting Rules

#### Critical Alerts
```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"

# High memory usage
- alert: HighMemoryUsage
  expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.85
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High memory usage detected"

# Database connection pool exhaustion
- alert: DatabaseConnectionPoolExhausted
  expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.8
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Database connection pool nearly exhausted"
```

#### Warning Alerts
```yaml
# Slow response time
- alert: SlowResponseTime
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Slow response time detected"

# High Redis memory usage
- alert: HighRedisMemoryUsage
  expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High Redis memory usage detected"
```

---

## 📚 Related Documentation

- [System Architecture](./SYSTEM_ARCHITECTURE.md) - Complete system design
- [Device Management](./DEVICE_MANAGEMENT.md) - Device lifecycle and API reference
- [Real-Time Communication](./REAL_TIME_COMMUNICATION.md) - SSE, WebSocket, and WebRTC

---

## 🔑 Key Takeaways

1. **Always publish disconnect events** - UI needs to know about disconnections
2. **Use surgical removal** - `removeSubscription(key, scope)` instead of `remove(key)`
3. **Remove before add** - Prevent duplicates by cleaning up stale entries
4. **Timing matters** - Small delays can ensure async operations complete
5. **Test reconnection cycles** - Always test beyond the 1st connection
6. **Query parameters are more reliable than cookies** for WebSocket upgrades
7. **HTTP/1.1 can be more stable** than HTTP/2 for long-lived connections
8. **Filter unnecessary messages** - Reduce load by not sending devices their own status updates
9. **Monitor key metrics** - Set up proper alerting for critical issues
10. **Document all fixes** - Keep troubleshooting knowledge up to date

---

**Status**: ✅ Production ready with comprehensive troubleshooting coverage.
