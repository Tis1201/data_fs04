# MQTT Worker

The MQTT Worker is a standalone Node.js process that handles MQTT message processing, device presence management, and background job execution.

## Overview

The worker connects to an MQTT broker (EMQX) and subscribes to device/user topics using shared subscriptions for load balancing across multiple worker instances.

## Entry Points

| File | Description |
|------|-------------|
| `src/worker/index.ts` | Main MQTT transport worker entry point |
| `src/worker/iot_client.ts` | MQTT client connection and message handling |
| `src/worker/jobs/index.ts` | Background job worker (BullMQ) |

## Running the Worker

```bash
# MQTT Worker
npm run mqtt:worker

# Job Worker  
npm run job:worker
```

---

## Environment Variables

### Required - MQTT Connection

| Variable | Description | Example |
|----------|-------------|---------|
| `MQTT_BROKER_URL` | MQTT broker WebSocket URL | `wss://mqtt.example.com:8084/mqtt` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |

### MQTT Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_SERVER_USERNAME` | - | Static MQTT username (fallback if JWT minting fails) |
| `MQTT_SERVER_PASSWORD` | - | Static MQTT password (fallback if JWT minting fails) |

### MQTT Worker Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_WORKER_CLIENT_ID` | `fs04-worker-{hostname}-{timestamp}` | MQTT client identifier |
| `MQTT_WORKER_USERNAME` | `server:fs04-worker` | Username for JWT credential minting |
| `MQTT_WORKER_PATH` | `/mqtt` | WebSocket path |
| `MQTT_WORKER_CLEAN_SESSION` | `true` | Clean session on connect (`false` to persist) |
| `MQTT_WORKER_KEEPALIVE` | `10` | Keepalive interval in seconds |
| `MQTT_WORKER_QOS` | `0` | QoS level for subscriptions (0, 1, or 2) |
| `MQTT_SHARED_GROUP` | `server` | Shared subscription group name for load balancing |

### MQTT Reconnection

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_WORKER_BASE_RECONNECT_MS` | `2000` | Base reconnect delay (ms) |
| `MQTT_WORKER_MAX_RECONNECT_MS` | `60000` | Max reconnect delay with exponential backoff (ms) |

### EMQX API (for Device Reconciliation)

| Variable | Default | Description |
|----------|---------|-------------|
| `EMQX_URL` | `http://localhost:18083` | EMQX HTTP API base URL |
| `EMQX_API_KEY` | - | EMQX API key for admin operations |
| `EMQX_API_SECRET` | - | EMQX API secret |

> **Note**: EMQX API credentials are used for device presence reconciliation - fetching connected clients from EMQX and syncing with Redis/DB.

### EMQX JWT Configuration (EMQX side, not worker)

| Variable | Description |
|----------|-------------|
| `EMQX_JWT_JWKS_ENDPOINT` | JWKS endpoint URL for EMQX to validate JWTs (e.g., `http://host.docker.internal:5173/.well-known/jwks-link.json`) |

### Redis (for Job Worker & Presence)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Full Redis connection URL (preferred over host/port) |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password |
| `REDIS_SUBSCRIBE_CHANNEL_NAME` | `device_status_changes` | Pub/sub channel name |

### Browser Client Minting (API endpoints, not worker)

| Variable | Description |
|----------|-------------|
| `MQTT_BROKER_WS_URL` | WebSocket URL returned to browser clients (auto-derived from `MQTT_BROKER_URL` if not set) |
| `MQTT_MINT_URL` | Device minting endpoint for claimed devices |
| `MQTT_MINT_URL_FACTORY` | Factory device minting endpoint |

---

## Subscribed Topics

The worker subscribes to these topic patterns under a shared group (`$share/{group}/...`):

```
device/+/requests          # Device request messages
device/+/events            # Device event messages  
device/+/replies           # Device reply messages
user/+/requests            # User request messages
user/+/events              # User event messages
user/+/replies             # User reply messages
+/controller/+/requests    # Controller requests
+/controller/+/replies     # Controller replies
+/controller/+/data        # Controller data streams (radar, sensors)
$events/client/connected   # MQTT client connect events
$events/client/disconnected # MQTT client disconnect events
```

---

## Architecture

```mermaid
graph TB
    subgraph "MQTT Worker Process"
        A[index.ts] --> B[iot_client.ts]
        B --> C[EMQX Broker]
        A --> D[Device Handlers]
        A --> E[Web Handlers]
        A --> F[Redis Queue]
    end
    
    subgraph "Job Worker Process"
        G[jobs/index.ts] --> H[BullMQ Worker]
        H --> I[Job Registry]
        H --> J[Cron Sync]
    end
    
    subgraph "Reconciliation"
        K[helper.ts] --> L[EMQX HTTP API]
        K --> M[Redis Presence]
    end
    
    B <--> N[(PostgreSQL)]
    F <--> O[(Redis)]
    H <--> O
    M <--> O
```

---

## Startup Sequence

1. **Connect** to MQTT broker (with JWT credential minting via LINK signing key)
2. **Subscribe** to worker topics under shared group
3. **Start heartbeat** (every 60s to `heartbeat` topic)
4. **Subscribe to Redis queue** for cross-process notifications
5. **Fast startup sync** (after 1s) - bulk refresh Redis from broker
6. **Full reconciliation** (after 3s) - update DB and send notifications
7. **Startup reconciliation** - every 30s for first 5 minutes
8. **Periodic reconciliation** - every 2 minutes ongoing

---

## JWT Credential Minting

The worker mints its own MQTT credentials using the LINK signing key stored in the database:

1. Fetches active primary `LINK` key from `jwtSigningKey` table
2. Signs a JWT with `pub: ['#']` and `sub: ['#']` (full access)
3. EMQX validates the JWT using the JWKS endpoint

If minting fails, falls back to static `MQTT_SERVER_USERNAME`/`MQTT_SERVER_PASSWORD`.

---

## Docker

### Build

```bash
docker build --platform=linux/amd64 -f docker/mqtt-worker/Dockerfile -t fs04-web-mqtt-worker .
```

### Publish

```bash
./docker/mqtt-worker/publish.sh dev-latest
```

### Environment File

Create `docker/mqtt-worker/env` with required variables:

```env
# Required
MQTT_BROKER_URL=wss://mqtt.example.com:8084/mqtt
DATABASE_URL=postgresql://user:pass@host:5432/db

# MQTT Auth (fallback if JWT minting fails)
MQTT_SERVER_USERNAME=USER_SERVER
MQTT_SERVER_PASSWORD=secret

# EMQX API (for reconciliation)
EMQX_URL=http://emqx:18083
EMQX_API_KEY=your-api-key
EMQX_API_SECRET=your-api-secret

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# Worker Settings
MQTT_SHARED_GROUP=server
```
