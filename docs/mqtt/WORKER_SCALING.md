# MQTT Worker - Concurrent Processing

## Overview

The MQTT worker now implements concurrent message processing with backpressure control to improve throughput and prevent database connection pool exhaustion.

## Architecture Improvements

### ✅ Singleton PrismaClient
- Single `adminPrisma` instance shared across all handlers
- Prevents connection pool exhaustion
- Reduces memory overhead

### ✅ Message Queue with Concurrency Control
- Uses `p-limit` for controlled concurrent processing
- Backpressure mechanism drops messages when queue is full
- Periodic statistics logging for monitoring

### ✅ Redis Queue Integration
- Cross-process MQTT notifications via Redis
- Action log broadcasting
- Device/user notifications

## Environment Variables

### Concurrency Control

```bash
# Maximum concurrent message handlers (default: 10)
# Increase for higher throughput, decrease if seeing DB connection errors
MQTT_CONCURRENCY=10

# Maximum queue depth before dropping messages (default: 1000)
# Acts as backpressure mechanism to prevent memory issues
MQTT_MAX_QUEUE_DEPTH=1000

# Queue statistics logging interval in ms (default: 60000 = 1 minute)
QUEUE_STATS_INTERVAL_MS=60000
```

### Connection Settings

```bash
# MQTT broker URL (required)
MQTT_BROKER_URL=mqtt://localhost:1883

# Worker client ID (default: fs04-worker-{hostname}-{timestamp})
MQTT_WORKER_CLIENT_ID=fs04-worker-prod-1

# Worker username for minting (default: server:fs04-worker)
MQTT_WORKER_USERNAME=server:fs04-worker

# Static credentials (if not using IoT Core minting)
MQTT_SERVER_USERNAME=admin
MQTT_SERVER_PASSWORD=secret

# Clean session (default: true)
MQTT_WORKER_CLEAN_SESSION=true

# Keepalive interval in seconds (default: 10)
MQTT_WORKER_KEEPALIVE=10

# QoS level for subscriptions (default: 1)
MQTT_WORKER_QOS=1

# MQTT path (default: /mqtt)
MQTT_WORKER_PATH=/mqtt
```

### Reconnection Settings

```bash
# Base reconnect delay in ms (default: 2000)
MQTT_WORKER_BASE_RECONNECT_MS=2000

# Maximum reconnect delay in ms (default: 60000)
MQTT_WORKER_MAX_RECONNECT_MS=60000

# JWT refresh before expiry in ms (default: 600000 = 10 minutes)
MQTT_WORKER_JWT_REFRESH_BEFORE_EXPIRY_MS=600000

# JWT expiry time in ms (default: 3600000 = 1 hour)
MQTT_WORKER_JWT_EXPIRY_MS=3600000
```

## Performance Tuning

### Recommended Settings by Load

**Low Load (<100 concurrent devices)**
```bash
MQTT_CONCURRENCY=5
MQTT_MAX_QUEUE_DEPTH=500
```

**Medium Load (100-500 concurrent devices)**
```bash
MQTT_CONCURRENCY=10
MQTT_MAX_QUEUE_DEPTH=1000
```

**High Load (500-1000 concurrent devices)**
```bash
MQTT_CONCURRENCY=20
MQTT_MAX_QUEUE_DEPTH=2000
```

**Very High Load (1000+ concurrent devices)**
```bash
MQTT_CONCURRENCY=30
MQTT_MAX_QUEUE_DEPTH=3000
# Consider horizontal scaling with multiple workers
```

## Monitoring

### Queue Statistics

The worker logs queue statistics every minute (configurable via `QUEUE_STATS_INTERVAL_MS`):

```
[MessageQueue] Stats: processed=1250, failed=3, dropped=0, active=8, pending=45, peakDepth=120
```

**Metrics:**
- `processed`: Total messages successfully processed
- `failed`: Total messages that threw errors
- `dropped`: Messages dropped due to queue depth limit
- `active`: Currently processing messages
- `pending`: Messages waiting in queue
- `peakDepth`: Maximum queue depth reached

### Warning Signs

**High `dropped` count:**
- Queue depth limit too low
- Processing too slow
- Increase `MQTT_CONCURRENCY` or `MQTT_MAX_QUEUE_DEPTH`

**High `failed` count:**
- Handler errors (check logs)
- Database connection issues
- External API failures

**High `pending` count:**
- Processing slower than message arrival rate
- Increase `MQTT_CONCURRENCY`
- Optimize slow handlers

## Horizontal Scaling

For very high loads, run multiple worker instances:

```bash
# Worker 1
MQTT_WORKER_CLIENT_ID=fs04-worker-1 MQTT_CONCURRENCY=20 pnpm worker:mqtt

# Worker 2
MQTT_WORKER_CLIENT_ID=fs04-worker-2 MQTT_CONCURRENCY=20 pnpm worker:mqtt

# Worker 3
MQTT_WORKER_CLIENT_ID=fs04-worker-3 MQTT_CONCURRENCY=20 pnpm worker:mqtt
```

Workers automatically share load via MQTT shared subscriptions (`$share/server/...`).

## Testing Checklist

### End-to-End (E2E) Tests

- [ ] **Complete Authentication & RPC Flow**
  - [ ] Mint factory token for device registration
  - [ ] Mint device token using factory token
  - [ ] Get device PIN for authentication
  - [ ] Send RPC calls with proper token authentication
  - [ ] Verify RPC response handling
  - [ ] Test MQTT message ingestion with authenticated context
  - [ ] Confirm Redis queue notifications
  - [ ] Validate WebSocket notifications to clients

- [ ] **Concurrency Testing**
  - [ ] Send multiple messages concurrently
  - [ ] Verify queue depth limits work correctly
  - [ ] Test backpressure mechanism (message dropping)
  - [ ] Confirm no database connection pool exhaustion

- [ ] **Error Handling**
  - [ ] Test with invalid message formats
  - [ ] Simulate database connection failures
  - [ ] Test MQTT broker disconnection/reconnection
  - [ ] Verify graceful degradation under load

- [ ] **Performance Validation**
  - [ ] Measure message processing latency
  - [ ] Monitor memory usage under sustained load
  - [ ] Verify queue statistics accuracy
  - [ ] Test with different concurrency settings

### Load Testing

- [ ] **Test Environment Setup**
  - [ ] Deploy test MQTT broker (e.g., Mosquitto)
  - [ ] Configure test database with realistic data
  - [ ] Set up Redis instance for testing
  - [ ] Prepare test client simulators

- [ ] **Load Scenarios**
  - [ ] **Low Load**: 50 devices, 1 msg/sec each
  - [ ] **Medium Load**: 200 devices, 2 msg/sec each
  - [ ] **High Load**: 500 devices, 5 msg/sec each
  - [ ] **Peak Load**: 1000+ devices, 10 msg/sec each

- [ ] **Test Metrics Collection**
  - [ ] Message throughput (msg/sec)
  - [ ] Processing latency (p50, p95, p99)
  - [ ] Queue depth over time
  - [ ] Error rates and types
  - [ ] Database connection pool utilization
  - [ ] Memory and CPU usage

- [ ] **Stress Testing**
  - [ ] Test beyond recommended limits
  - [ ] Verify graceful degradation
  - [ ] Test recovery after load spikes
  - [ ] Validate horizontal scaling with multiple workers

- [ ] **Long-Running Tests**
  - [ ] 24-hour stability test
  - [ ] Memory leak detection
  - [ ] Connection pool stability
  - [ ] MQTT reconnection reliability

### Test Automation

- [ ] **Test Scripts**
  - [ ] Create MQTT message generator
  - [ ] Build performance monitoring dashboard
  - [ ] Implement automated test runner
  - [ ] Set up CI/CD integration

- [ ] **Test Data Management**
  - [ ] Generate realistic device messages
  - [ ] Create test accounts and permissions
  - [ ] Set up test data cleanup procedures
  - [ ] Maintain test environment snapshots

## References

Based on scaling improvements from `ir-device-manager` MQTT worker:
- Singleton PrismaClient pattern
- p-limit for concurrency control
- MessageQueue with backpressure
- Load testing results: 500 requests @ 250 concurrency = 100% success rate
