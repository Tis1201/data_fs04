# Unified Background Job System Design

## Overview

This document outlines the design for a comprehensive background job system for the FS04 Web project. It unifies two key patterns:

1.  **CronJobs**: Database-driven, recurring scheduled tasks (e.g., daily reports, cleanup).
2.  **Async Jobs**: User-triggered, on-demand tasks with polling (e.g., heavy analytics, data prep).

Both patterns share the same underlying infrastructure (**BullMQ + Redis**) and Worker process, ensuring efficient resource usage and centralized management.

---

## High-Level Architecture

```mermaid
flowchart TD
    subgraph "Web Tier"
        API["Web API (SvelteKit)"]
    end

    subgraph "Queue Tier"
        Redis[(Redis)]
        BullMQ["BullMQ Queue"]
    end

    subgraph "Worker Tier"
        Worker["Job Worker (Node.js)"]
    end

    subgraph "Data Tier"
        PG[(PostgreSQL)]
        CH[(ClickHouse)]
    end

    API -- "Add Job" --> BullMQ
    API -- "Poll Status" --> Redis
    BullMQ -- "Persist State" --> Redis
    Worker -- "Consume Jobs" --> BullMQ
    Worker -- "Update CronJob Status" --> PG
    Worker -- "Query Data" --> CH
    Worker -- "Query Data" --> PG
```

### Core Components

| Component        | Responsibility                                                              |
| :--------------- | :-------------------------------------------------------------------------- |
| **Redis**        | Central coordinator. Stores job queues, states, locks, and results.        |
| **BullMQ**       | Job queue engine for handling scheduling, retries, and prioritization.     |
| **Worker**       | Stateless Node.js process (`npm run job:worker`) that executes functions.  |
| **Web API**      | Enqueues jobs, exposes polling endpoints, manages CronJob definitions.     |
| **Prisma (PG)**  | Persists `CronJob` definitions for admin management and audit logging.     |

---

## Pattern 1: Database-Driven CronJobs (Recurring)

CronJobs are defined in the database and synced to BullMQ on worker startup. This ensures that job schedules are persistent and manageable via an Admin UI.

### CronJob Flow Diagram

```mermaid
sequenceDiagram
    participant Admin as Admin UI
    participant DB as PostgreSQL (CronJob)
    participant Sync as Sync Logic
    participant Queue as BullMQ (Repeatable)
    participant Worker as Worker

    Admin->>DB: Create/Update CronJob
    Sync->>DB: Read ACTIVE CronJobs
    Sync->>Queue: Upsert Repeatable Job
    Queue-->>Worker: Trigger at schedule
    Worker->>Worker: Execute functionName(args)
    Worker->>DB: Update lastRunAt, lastResult
```

### Source of Truth
-   **Database (`CronJob` table)**: Defines what jobs *should* run.
-   **BullMQ**: Manages the actual execution schedule.
-   **Sync Logic**: Runs on worker startup and on API hooks (create/update/delete) to keep them aligned.

### Prisma Schema

```prisma
model CronJob {
  id             String    @id @default(cuid())
  name           String    // Human-readable name
  functionName   String    // Maps to Function Registry key
  args           Json?     // Arguments passed to the function
  cronExpression String    // Standard cron format (e.g., "0 0 * * *")
  status         String    @default("ACTIVE") // ACTIVE, INACTIVE, PAUSED
  timezone       String?   @default("UTC")

  // Execution Tracking
  lastRunAt      DateTime?
  nextRunAt      DateTime?
  lastResult     String?   // "success" or error message
  isRunning      Boolean   @default(false)

  // Retry Configuration
  retryCount     Int       @default(0)
  maxRetries     Int       @default(3)
  timeout        Int?      // Execution timeout in ms

  // Audit Fields
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  createdBy      String?
  accountId      String?

  @@index([status])
  @@index([nextRunAt])
}
```

---

## Pattern 2: Async Data Preparation (On-Demand)

Async Jobs are triggered by user actions (e.g., requesting a large analytics export). The API returns a `jobId` immediately, and the client polls for completion.

### Async Job Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant API as Web API
    participant Queue as BullMQ Queue
    participant Redis
    participant Worker

    Client->>API: POST /api/data-jobs { filters }
    API->>Queue: queue.add(jobName, data)
    Queue->>Redis: Store job state (waiting)
    API-->>Client: { jobId: "xyz" }

    loop Polling
        Client->>API: GET /api/data-jobs/xyz
        API->>Redis: queue.getJob("xyz")
        Redis-->>API: { state, returnvalue }
        API-->>Client: { status: "pending" | "completed", result? }
    end

    Queue-->>Worker: Job available
    Worker->>Worker: Execute handler(data)
    Worker->>Redis: Update job state (completed) + returnvalue
```

### Source of Truth
-   **Redis (BullMQ)**: Stores job state, result data. Transient with TTL.

### API Contract

| Endpoint                  | Method | Request Body                     | Response                                        |
| :------------------------ | :----- | :------------------------------- | :---------------------------------------------- |
| `/api/data-jobs`          | `POST` | `{ type: string, params: {...} }`| `{ jobId: string }`                             |
| `/api/data-jobs/:jobId`   | `GET`  | -                                | `{ status: "pending" \| "completed" \| "failed", result?: any, error?: string }` |

---

## Infrastructure & Code Structure

### Directory Layout

```
src/
├── lib/
│   └── server/
│       └── jobs/                   # Core Job System Library
│           ├── client.ts           # BullMQ Queue instance & helper functions
│           ├── worker.ts           # BullMQ Worker setup & processor
│           ├── registry.ts         # Function name -> handler mapping
│           ├── cron-sync.ts        # Sync DB CronJobs <-> BullMQ Repeatables
│           └── handlers/           # Job Handler Implementations
│               ├── analytics/
│               │   └── prepare-report.ts
│               └── system/
│                   └── cleanup-tokens.ts
└── worker/
    └── jobs/
        └── index.ts                # Entry point: "npm run job:worker"
```

### Component Details

#### `client.ts`
Exports the shared BullMQ `Queue` instance and helper functions.
```typescript
import { Queue } from 'bullmq';
import { redisConnection } from '$lib/server/redis';

export const jobQueue = new Queue('main-jobs', { connection: redisConnection });

export async function addAsyncJob(name: string, data: object) {
  return jobQueue.add(name, data, { removeOnComplete: { age: 86400 } }); // Keep 24h
}
```

#### `registry.ts`
Maps job names to handler functions.
```typescript
import { prepareReport } from './handlers/analytics/prepare-report';
import { cleanupTokens } from './handlers/system/cleanup-tokens';

export const jobRegistry: Record<string, (data: any) => Promise<any>> = {
  'analytics:prepare-report': prepareReport,
  'system:cleanup-tokens': cleanupTokens,
};
```

#### `worker.ts`
Defines the BullMQ `Worker` and its processor.
```typescript
import { Worker, Job } from 'bullmq';
import { redisConnection } from '$lib/server/redis';
import { jobRegistry } from './registry';
import { adminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

export function createWorker() {
  return new Worker('main-jobs', async (job: Job) => {
    const handler = jobRegistry[job.name];
    if (!handler) {
      throw new Error(`No handler registered for job: ${job.name}`);
    }

    logger.info({ jobId: job.id, jobName: job.name }, 'Processing job');

    // For CronJobs, update DB status
    if (job.opts.repeat) {
      await adminPrisma.cronJob.update({
        where: { id: job.data.cronJobId },
        data: { isRunning: true },
      });
    }

    try {
      const result = await handler(job.data);
      // Update CronJob on success
      if (job.opts.repeat && job.data.cronJobId) {
        await adminPrisma.cronJob.update({
          where: { id: job.data.cronJobId },
          data: { isRunning: false, lastRunAt: new Date(), lastResult: 'success' },
        });
      }
      return result;
    } catch (error) {
      // Update CronJob on failure
      if (job.opts.repeat && job.data.cronJobId) {
        await adminPrisma.cronJob.update({
          where: { id: job.data.cronJobId },
          data: { isRunning: false, lastResult: String(error) },
        });
      }
      throw error;
    }
  }, { connection: redisConnection, concurrency: 5 });
}
```

---

## Error Handling & Retries

BullMQ provides robust retry mechanisms. Configuration is set per-job or as queue defaults.

```mermaid
stateDiagram-v2
    [*] --> Waiting
    Waiting --> Active : Worker picks up
    Active --> Completed : Success
    Active --> Failed : Error (max retries reached)
    Active --> Delayed : Error (will retry)
    Delayed --> Waiting : Backoff period ends
    Completed --> [*]
    Failed --> [*]
```

### Retry Strategy
-   **Default Attempts**: 3
-   **Backoff**: Exponential (e.g., 1s, 2s, 4s).
-   **Stalled Jobs**: BullMQ auto-detects stalled jobs (worker crashed) and re-queues them.

```typescript
// Example: Adding a job with custom retry options
await jobQueue.add('my-job', { ... }, {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});
```

---

## Rate Limiting

### API Level (Job Creation)
Prevent abuse by limiting how many jobs a user can create.
-   **Limit**: 20 jobs/minute per user.
-   **Response**: `429 Too Many Requests`.

### Worker Level (Execution Throughput)
Protect downstream databases (ClickHouse, Postgres) from being overwhelmed.
-   **BullMQ Limiter**: Max 50 jobs/second processed.

```typescript
const worker = new Worker('main-jobs', processor, {
  connection: redisConnection,
  limiter: { max: 50, duration: 1000 }, // 50 jobs per 1000ms
});
```

---

## Scaling & Deployment

```mermaid
flowchart LR
    subgraph "Docker Compose / K8s"
        Web1["Web API #1"]
        Web2["Web API #2"]
        Worker1["Worker #1"]
        Worker2["Worker #2"]
        Worker3["Worker #3"]
    end

    Redis[(Redis Cluster)]

    Web1 & Web2 -- "Add Jobs" --> Redis
    Worker1 & Worker2 & Worker3 -- "Consume Jobs" --> Redis
```

-   **Horizontal Scaling**: Start multiple worker instances. BullMQ/Redis ensures atomic job claiming (no double processing).
-   **Graceful Shutdown**: Workers should handle `SIGTERM` to finish current jobs before exiting.

---

## Deliverables

1.  **Prisma Migration**: Add `CronJob` table to `schema.prisma`.
2.  **Core Library**: `src/lib/server/jobs/` (client, worker, registry, cron-sync).
3.  **Worker Entry Point**: `src/worker/jobs/index.ts`.
4.  **npm Script**: `"job:worker": "dotenv -- tsx src/worker/jobs/index.ts"`.
5.  **API Routes**:
    -   `POST /api/data-jobs` & `GET /api/data-jobs/:jobId` for async jobs.
    -   CRUD at `src/routes/api/admin/crons/` for CronJob management.
6.  **Documentation**: This file + inline code comments.

---

## Operational Notes

| Topic             | Recommendation                                                                    |
| :---------------- | :-------------------------------------------------------------------------------- |
| **Polling**       | Clients poll `GET /api/data-jobs/:id` every 2-5 seconds.                          |
| **Redis Cleanup** | Use `removeOnComplete: { age: 86400 }` (24h) and `removeOnFail: { count: 1000 }`. |
| **Monitoring**    | Consider BullMQ Dashboard (e.g., `bull-arena` or `taskforce.sh`) for visibility.  |
| **Idempotency**   | Design job handlers to be idempotent where possible (safe to retry).             |
