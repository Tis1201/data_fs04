# V1 to V2 Migration Strategy

This document outlines the branching and deployment strategy for transitioning from V1 to V2 while maintaining parallel development.

## Overview

V2 introduces a significant architectural change: **MQTT replacement** (`feature/mqtt-replace`). To safely develop and test V2 without disrupting the ongoing V1 development, we use a parallel branch strategy.

## Branch Structure

```
main (v1 production)
├── develop (v1 active development)
│
main-v2 (v2 production - when ready)
├── develop-v2 (v2 active development)
    └── feature/mqtt-replace (merged into develop-v2)
```

### Branch Purposes

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | V1 production releases | Production |
| `develop` | V1 active development | Staging |
| `main-v2` | V2 production releases | Production (V2) |
| `develop-v2` | V2 active development | Staging (V2) |

## Pipeline Configuration

### Bitbucket Pipelines

```yaml
pipelines:
  branches:
    # V1 Pipelines
    develop:
      - step:
          name: Deploy to V1 Staging
          # ... existing v1 staging deployment

    main:
      - step:
          name: Deploy to V1 Production
          # ... existing v1 production deployment

    # V2 Pipelines
    develop-v2:
      - step:
          name: Deploy to V2 Staging
          # ... v2 staging deployment (separate environment)

    main-v2:
      - step:
          name: Deploy to V2 Production
          # ... v2 production deployment (when ready)
```

## Docker Image Naming Strategy

To avoid confusion between V1 and V2 images in the same registry, we will use distinct tag prefixes for V2.

### Tagging Convention

| Environment | Branch | Docker Tag Pattern | Example |
|-------------|--------|--------------------|---------|
| **V1 Staging** | `develop` | `dev-{commit}` | `myapp:dev-a1b2c3d` |
| **V1 Production** | `main` | `v{version}`, `latest` | `myapp:v1.2.0`, `myapp:latest` |
| **V2 Staging** | `develop-v2` | `v2-dev-{commit}` | `myapp:v2-dev-x9y8z7` |
| **V2 Production** | `main-v2` | `v2-{version}`, `v2-latest` | `myapp:v2-1.0.0`, `myapp:v2-latest` |

### Why this approach?
1.  **Single Registry**: Keeps all images in one place (cleaner registry management).
2.  **Explicit Info**: The tag immediately tells you if it's a V2 image or legacy V1.
3.  **Safety**: Prevents accidental deployments of V2 images to V1 environments (since tags are distinct).

## Implementation Steps

### 1. Create V2 Branches

```bash
# Start from the feature branch
git checkout feature/mqtt-replace
git pull origin feature/mqtt-replace

# Create develop-v2 from the feature branch
git checkout -b develop-v2
git push origin develop-v2

# Later, when v2 is production-ready:
git checkout develop-v2
git checkout -b main-v2
git push origin main-v2
```

### 2. Update Pipeline Configuration

Add `develop-v2` and `main-v2` triggers to `bitbucket-pipelines.yml` with:
- Separate deployment environments (e.g., `dev-v2.example.com`)
- Separate infrastructure if needed (databases, message queues, etc.)
- **Updated Docker Build Step**: Ensure `IMAGE_TAG` includes `v2-` prefix for v2 branches.

### 3. Environment Separation

For V2 testing, consider:
- **Separate Kubernetes namespace**: `ir-device-manager-v2`
- **Separate database**: Clone or use a test database
- **Separate MQTT broker**: If testing MQTT replacement

## Workflow

### V1 Development (Ongoing)
```
feature/* → develop → main
```

### V2 Development
```
feature/* → develop-v2 → main-v2
```

### Hotfixes

- **V1 hotfixes**: `main` → `hotfix/*` → `main` + `develop`
- **V2 hotfixes**: `main-v2` → `hotfix-v2/*` → `main-v2` + `develop-v2`

## Key Changes in V2

### MQTT Replacement
- **Before (V1)**: [Describe current MQTT implementation]
- **After (V2)**: [Describe new implementation from `feature/mqtt-replace`]

## Timeline

| Phase | Action | Status |
|-------|--------|--------|
| 1 | Create `develop-v2` branch | ⏳ Pending |
| 2 | Configure V2 pipelines | ⏳ Pending |
| 3 | Deploy V2 to staging | ⏳ Pending |
| 4 | V2 testing & validation | ⏳ Pending |
| 5 | Create `main-v2` branch | ⏳ Pending |
| 6 | V2 production release | ⏳ Pending |
| 7 | V1 deprecation | ⏳ Pending |

## Rollback Strategy

If V2 issues are discovered:
1. V1 remains fully operational on `main`/`develop`
2. V2 can be rolled back independently
3. No cross-contamination between versions

## Notes

- Keep V1 and V2 pipelines completely isolated
- Sync critical security fixes between versions if needed
- Document any breaking changes between V1 and V2 APIs
