# Monorepo Architecture Proposal

> **Status**: Under Investigation  
> **Date**: 2025-12-23

## Overview

This document explores splitting `fs04_web` into a monorepo where the **App**, **MQTT Worker**, and **Cron/Scheduled Tasks** each become independent projects while sharing common code.

---

## Current Architecture

### Three Workloads, One Codebase

| Workload | Entry Point | Script | Purpose |
|----------|-------------|--------|---------|
| **Web App** | `build/` (SvelteKit) | `npm run start:prod` | SvelteKit web app, API routes |
| **MQTT Worker** | `src/worker/index.ts` | `npm run mqtt:worker` | Real-time MQTT message handling |
| **Background Jobs** | `scripts/processes/` | `npm run bundle:process`, `gcloud:cleanup` | Scheduled tasks, cleanup |

### Current Docker Setup

```
docker/
├── Dockerfile           # Main app
├── mqtt-worker/
│   └── Dockerfile       # MQTT worker (copies full src/, uses tsx)
└── ...
```

### Shared Code (`$lib/server/`)

All workloads depend on these shared modules:

| Module | Location | Used By |
|--------|----------|---------|
| **Prisma/ZenStack** | `prisma/`, `$lib/server/prisma.ts` | All |
| **Redis** | `$lib/server/redis.ts` | All |
| **Logger** | `$lib/server/logger.ts` | All |
| **MQTT Core** | `$lib/server/mqtt/` | App, Worker |
| **Scheduler** | `$lib/server/scheduler/` | App, Cron |
| **Storage/S3** | `$lib/server/storage/` | All |
| **Auth** | `$lib/server/auth/` | App |
| **Email** | `$lib/server/email/` | App, Cron |

---

## Proposed Monorepo Structure

### Option A: pnpm + Turborepo (Recommended)

```
fs04_web/
├── packages/
│   └── shared/                    # @fs04/shared - ONLY primitives
│       ├── src/
│       │   ├── db/                # Prisma client, enhance()
│       │   ├── redis/             # Redis client, distributed locks
│       │   ├── logger/            # Pino logger config
│       │   ├── storage/           # S3/GCloud storage client
│       │   └── mqtt/
│       │       └── transport.ts   # MQTT publish/subscribe primitives ONLY
│       ├── prisma/
│       │   └── schema.prisma
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── web/                       # SvelteKit app
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── lib/
│   │   │   │   ├── client/        # UI stores, components
│   │   │   │   └── server/
│   │   │   │       └── mqtt/      # Web-specific MQTT (e.g., SSE push)
│   │   │   └── hooks.server.ts
│   │   ├── package.json           # depends on @fs04/shared
│   │   ├── svelte.config.js
│   │   └── Dockerfile
│   │
│   ├── mqtt-worker/               # Standalone MQTT worker
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── iot_client.ts      # MQTT connection management
│   │   │   ├── handlers/          # ALL message handlers (device, web, etc.)
│   │   │   │   ├── device.ts
│   │   │   │   ├── web.ts
│   │   │   │   └── index.ts
│   │   │   └── utils/
│   │   │       └── reconciliation.ts
│   │   ├── package.json           # depends on @fs04/shared
│   │   └── Dockerfile
│   │
│   └── cron/                      # Scheduled tasks runner
│       ├── src/
│       │   ├── index.ts           # Entry point with node-cron
│       │   ├── jobs/              # ALL scheduled jobs live here
│       │   │   ├── bundle-cleanup.ts
│       │   │   ├── bundle-timeout.ts
│       │   │   ├── device-app-scheduler.ts
│       │   │   └── gcloud-cleanup.ts
│       │   └── scheduler.ts       # Cron scheduling logic
│       ├── package.json           # depends on @fs04/shared
│       └── Dockerfile
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json                   # Root scripts
└── docker-compose.yml             # All services together
```

> **Key Principle**: `@fs04/shared` contains **only stateless primitives** (clients, configs).  
> All **business logic** (handlers, jobs) stays in its respective app.

### Option B: Nx Monorepo

Similar structure using Nx CLI with `libs/` instead of `packages/` and `nx.json` + `workspace.json`.

### Option C: Enhanced Single Repo (Minimal Change)

Keep current structure, improve separation via separate `tsconfig` per workload and dedicated Docker builds.

---

## Benefits of Monorepo Split

| Benefit | Description |
|---------|-------------|
| **Independent Deployment** | Deploy worker without touching app |
| **Faster CI/CD** | Build only affected packages |
| **Cleaner Dependencies** | Each app declares exactly what it needs |
| **Scalability** | Scale MQTT workers independently |
| **Smaller Docker Images** | Worker doesn't need SvelteKit deps |

---

## Migration Steps

### Phase 1: Extract Shared Package
1. Create `packages/shared/` 
2. Move shared server code (`prisma`, `redis`, `logger`, `mqtt/core`)
3. Set up TypeScript path aliases
4. Update imports to use `@fs04/shared`

### Phase 2: Isolate MQTT Worker
1. Create `apps/mqtt-worker/`
2. Move `src/worker/` logic
3. Create dedicated `package.json` and `Dockerfile`

### Phase 3: Extract Cron Service
1. Create `apps/cron/`
2. Move scheduler jobs from `$lib/server/scheduler/`
3. Add cron framework (node-cron, croner, or Bull)

### Phase 4: Refactor Web App
1. Move remaining code to `apps/web/`
2. Remove duplicated logic now in `@fs04/shared`

---

## Key Decisions Needed

- [ ] **Tooling**: pnpm + Turborepo vs Nx vs other?
- [ ] **Shared Package Scope**: What belongs in shared vs app-specific?
- [ ] **Cron Framework**: node-cron, Bull queues, or Kubernetes CronJobs?
- [ ] **Deployment Strategy**: Separate images or mono-deploy?

---

## References

- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)

## Tooling Comparison: Nx vs. Turborepo

Since you asked "Is Nx good?", here is a direct comparison relevant to your project:

### 1. Nx
**Verdict**: Extremely powerful, but "heavy". Best if you want strict rules and code generation.

*   **Pros**:
    *   **Deep Integration**: Understands your code structure (AST). automatically detects dependencies.
    *   **Generators**: Can scaffold entire apps, components, or libraries with one command.
    *   **Module Boundaries**: Can strictly enforce rules (e.g., "Web App cannot import from Worker directly").
    *   **Graph Visualization**: Best-in-class interactive dependency graph.
*   **Cons**:
    *   **Steeper Curve**: Requires learning Nx-specific commands and `project.json` configuration.
    *   **"Magic"**: Does a lot for you, which can be confusing if things break.
    *   **Migration**: harder to migrate an existing non-standard repo into Nx than Turborepo.

### 2. Turborepo (with pnpm)
**Verdict**: Lightweight, fast, and easier to adopt for existing projects. **(Recommended for fs04_web)**

*   **Pros**:
    *   **Simple**: It's just a task runner. It doesn't care about your code structure, only your scripts.
    *   **Fast Adoption**: You can keep your current structure and just add a `turbo.json`.
    *   **Standard Tooling**: You still use standard `npm`/`pnpm` commands.
    *   **Workspaces Native**: Built to work seamlessly with pnpm workspaces.
*   **Cons**:
    *   **Less Safety**: Doesn't enforce boundary rules (you have to be disciplined).
    *   **No Generators**: You have to manually create folders and files for new packages.

### Recommendation
For `fs04_web`, **Turborepo** is likely the better fit because:
1.  You already have a working, non-standard structure.
2.  You want to "refactor" rather than "rewrite".
3.  The team size seems small/agile; Nx might be overkill.

