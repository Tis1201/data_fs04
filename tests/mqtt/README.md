# MQTT Testing Suite

## Overview

Comprehensive testing suite for MQTT worker functionality, including E2E tests and load tests.

## Existing E2E Tests

Located in `/tests/integrations/`:

### ✅ Factory MQTT Mint E2E (`factory_mqtt_mint_e2e.test.ts`)
- Mints factory MQTT credentials using factory JWT
- Connects to MQTT broker with minted credentials
- Tests subscribe/publish permissions on factory topics
- Performs loopback roundtrip test

### ✅ Device MQTT Mint E2E (`device_mqtt_mint_e2e.test.ts`)
- Mints device MQTT credentials using device API key
- Connects to MQTT broker with minted credentials
- Tests subscribe/publish permissions on device topics
- Performs loopback roundtrip test

### ✅ User MQTT Mint E2E (`user_mqtt_mint_e2e.test.ts`)
- Mints user MQTT credentials using user session
- Connects to MQTT broker with minted credentials
- Tests subscribe/publish permissions on user topics

### ✅ Controller MQTT Mint E2E (`controller_mqtt_mint_e2e.test.ts`)
- Mints controller MQTT credentials
- Tests controller-specific topics and permissions

### ✅ MQTT Reconciliation E2E (`emqx/mqtt_reconcile_connections_e2e.test.ts`)
- Tests device presence reconciliation
- Verifies Redis TTL updates
- Tests connection state tracking

## Load Testing

### MQTT Worker Load Test (`load-test.ts`)

Tests MQTT worker performance under concurrent load using factory mint → connect → loopback flow.

**Usage:**
```bash
# Default: 100 total requests, 10 concurrent, 5s ramp-up
pnpm mqtt:load

# Custom: 500 total, 20 concurrent, 5s ramp-up
pnpm mqtt:load -- --total=500 --concurrency=20

# Stress test: 1000 total, 50 concurrent, 10s ramp-up
pnpm mqtt:load -- --total=1000 --concurrency=50 --ramp=10000
```

**What it tests:**
1. Factory credential minting under load
2. Concurrent MQTT connections
3. Message queue processing (via MessageQueue with p-limit)
4. Loopback message roundtrip latency
5. Worker stability under sustained load

**Metrics reported:**
- Success rate (%)
- Throughput (req/s)
- Latency (min, avg, p50, p95, p99, max)
- Failure breakdown by error type

## Test Scenarios

### Baseline Test
```bash
pnpm mqtt:load -- --total=100 --concurrency=10 --ramp=5000
```
**Expected:** 100% success rate, ~10-20 req/s throughput

### Scaled Test
```bash
pnpm mqtt:load -- --total=500 --concurrency=50 --ramp=8000
```
**Expected:** 95%+ success rate, ~30-50 req/s throughput

### Stress Test
```bash
pnpm mqtt:load -- --total=1000 --concurrency=100 --ramp=10000
```
**Expected:** May hit rate limits, test backpressure mechanisms

## Prerequisites

### 1. Running Services
```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Start MQTT worker
pnpm mqtt:worker

# Terminal 3: Start Redis (if not already running)
redis-server
```

### 2. Database Setup
- Ensure PostgreSQL is running
- Run migrations: `npx prisma migrate dev`
- Seed admin user: `pnpm seed`

### 3. Factory Token
Create a factory token via admin UI or seed script:
```sql
INSERT INTO "FactoryToken" (id, token, "isUsed", "expiresAt", "issuedAt")
VALUES (
  gen_random_uuid(),
  'your-jwt-token-here',
  false,
  NOW() + INTERVAL '1 year',
  NOW()
);
```

## Environment Variables

Required for load testing:
```bash
# Web app URL (default: http://localhost:5173)
WEB_APP_BASE_URL=http://localhost:5173

# MQTT broker URL
MQTT_BROKER_URL=ws://localhost:8083/mqtt

# Worker concurrency (default: 10)
MQTT_CONCURRENCY=10

# Queue depth limit (default: 1000)
MQTT_MAX_QUEUE_DEPTH=1000
```

## Performance Benchmarks

Based on ir-device-manager load testing results:

| Metric | Baseline (10 concurrent) | Scaled (250 concurrent) |
|--------|-------------------------|------------------------|
| Success Rate | 100% | 100% |
| Throughput | 1.88 req/s | 17.54 req/s |
| p50 Latency | 5,157ms | 5,382ms |
| p95 Latency | 5,312ms | 6,213ms |

**Key findings:**
- Worker handles 25x configured concurrency
- Linear throughput scaling
- Stable latency under load
- Zero failures with proper retry logic

## Monitoring

### Queue Statistics
The MQTT worker logs queue stats every minute:
```
[MessageQueue] Stats: processed=1250, failed=3, dropped=0, active=8, pending=45, peakDepth=120
```

**Watch for:**
- `dropped > 0`: Queue depth limit reached, increase `MQTT_MAX_QUEUE_DEPTH`
- `failed > 0`: Handler errors, check logs
- `pending` high: Processing slower than arrival rate, increase `MQTT_CONCURRENCY`

### Load Test Output
```
============================================================
LOAD TEST RESULTS
============================================================
  Total Requests:  500
  Max Concurrent:  50
  Ramp-up Time:    8000ms
  Total time:      12.45s
  Success:         498/500 (99.6%)
  Throughput:      40.00 req/s

  Latency (ms):
    Min:  1234
    Avg:  2456
    p50:  2400
    p95:  3200
    p99:  3500
    Max:  4000

  Failures (2):
    Timeout: 2
============================================================
```

## Troubleshooting

### High Failure Rate
**Symptoms:** Success rate < 95%
**Causes:**
- MQTT worker not running
- Redis not available
- Database connection pool exhausted
- Network issues

**Solutions:**
1. Check all services are running
2. Increase `MQTT_CONCURRENCY`
3. Reduce load test concurrency
4. Check logs for specific errors

### Timeouts
**Symptoms:** Many "Timeout" errors
**Causes:**
- Worker overloaded
- Slow database queries
- Network latency

**Solutions:**
1. Increase `TIMEOUT_MS` in load test
2. Increase `MQTT_CONCURRENCY`
3. Optimize slow handlers
4. Add database indexes

### Connection Refused
**Symptoms:** "ECONNREFUSED" errors
**Causes:**
- MQTT broker not running
- Wrong `MQTT_BROKER_URL`
- Firewall blocking connections

**Solutions:**
1. Verify MQTT broker is running
2. Check `MQTT_BROKER_URL` in `.env`
3. Test connection manually: `mqtt sub -h localhost -p 1883 -t test`

## Future Enhancements

### Additional E2E Tests Needed
- [ ] RPC method tests (get.pin, device.claim, etc.)
- [ ] Shared subscription load distribution
- [ ] Multi-worker horizontal scaling
- [ ] Credential refresh/expiry handling
- [ ] Error recovery scenarios

### Load Test Improvements
- [ ] Multiple flow types (not just loopback)
- [ ] RPC method load testing
- [ ] Sustained load over time (hours)
- [ ] Gradual ramp-down testing
- [ ] Memory leak detection

## References

- Based on `ir-device-manager` MQTT worker scaling improvements
- Load testing pattern from `ir-device-manager/apps/mqtt-load-test`
- MessageQueue implementation with p-limit for concurrency control
