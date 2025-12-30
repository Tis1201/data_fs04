# Task-based Seeds

A task/feature-based seed system that allows each developer to create their own seed files without affecting others.

> ⚠️ **Note:** Each task can seed multiple modules in a single file.

## 📁 Structure

```
prisma/seeds/
├── README.md                    # This file
├── _template.seed.ts            # Template for new tasks
└── task-acl-radar.seed.ts       # Task: ACL + Radar (users, groups, permissions, controllers)
```

## 🚀 How to Run

### Run a specific task seed:
```bash
# Run ACL + Radar task
npx tsx prisma/seeds/task-acl-radar.seed.ts

# Run another task
npx tsx prisma/seeds/task-xxx.seed.ts
```

### Run the original seed (system + admin only):
```bash
npx prisma db seed
```

## ➕ Create a New Task Seed

### Simple Approach - Standalone File

Each task creates one file containing all seed logic (can span multiple modules):

```typescript
// prisma/seeds/task-my-feature.seed.ts

import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding data for Task: My Feature...\n');

    // ===== 1. CREATE ACCOUNT (if needed) =====
    const account = await prisma.account.upsert({
        where: { slug: 'my-task-account' },
        update: {},
        create: {
            name: 'My Task Account',
            slug: 'my-task-account',
            status: 'ACTIVE'
        }
    });
    console.log('✓ Account:', account.name);

    // ===== 2. CREATE USERS (if needed) =====
    const user = await prisma.user.upsert({
        where: { email: 'mytask@test.com' },
        update: {},
        create: {
            email: 'mytask@test.com',
            name: 'My Task User',
            password: await hash('test1234'),
            systemRole: 'USER',
            primaryAccountId: account.id
        }
    });
    console.log('✓ User:', user.email);

    // ===== 3. CREATE GROUPS + PERMISSIONS (if needed) =====
    const group = await prisma.group.upsert({
        where: { accountId_name: { accountId: account.id, name: 'My Task Group' } },
        update: {},
        create: {
            name: 'My Task Group',
            accountId: account.id
        }
    });
    
    // Add permissions
    for (const action of ['VIEW', 'CREATE', 'EDIT']) {
        await prisma.permission.upsert({
            where: { groupId_module_action: { groupId: group.id, module: 'USER_DEVICES', action } },
            update: { allowed: true },
            create: { groupId: group.id, module: 'USER_DEVICES', action, allowed: true }
        });
    }
    console.log('✓ Group + Permissions');

    // ===== 4. CREATE MODULE-SPECIFIC DATA (devices, controllers, etc.) =====
    const device = await prisma.device.upsert({
        where: { apiKey: 'my-task-device-key' },
        update: {},
        create: {
            name: 'My Task Device',
            apiKey: 'my-task-device-key',
            accountId: account.id
        }
    });
    console.log('✓ Device:', device.name);

    // ===== SUMMARY =====
    console.log('\n✅ Task seed completed!');
    console.log('─'.repeat(40));
    console.log('Account:', account.name);
    console.log('User: mytask@test.com / test1234');
    console.log('Device:', device.name);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
```

### Run:
```bash
npx tsx prisma/seeds/task-my-feature.seed.ts
```

## 📋 Task: ACL + Radar (`task-acl-radar.seed.ts`)

**Scope:** Only modules with ACL implemented in this task:
- **Admin:** Accounts (ACCOUNTS, COMPANIES, GROUPS) + ADMIN_CONTROLLERS_RADAR
- **User:** USER_CONTROLLERS_RADAR

Run:
```bash
npx tsx prisma/seeds/task-acl-radar.seed.ts
```

### Test Accounts:

**User Mode (systemRole: USER) - Test User Access modules:**

| Email | Password | Groups | Overrides | Test Case |
|-------|----------|--------|-----------|-----------|
| `user-full@test.com` | `test1234` | User Radar - Full Access | None | Full access to USER_CONTROLLERS_RADAR |
| `user-view@test.com` | `test1234` | User Radar - View Only | +CREATE on USER_CONTROLLERS_RADAR | View only + CREATE override |
| `user-noperm@test.com` | `test1234` | None | +VIEW on USER_CONTROLLERS_RADAR | Override only |

**Admin Mode (systemRole: ADMIN) - Test Admin Access modules:**

| Email | Password | Groups | Overrides | Test Case |
|-------|----------|--------|-----------|-----------|
| `admin-full@test.com` | `test1234` | Admin - Full Access | None | Full access to Accounts + Radar |
| `admin-accounts@test.com` | `test1234` | Admin - Accounts Only | None | Full access to Accounts only |
| `admin-radar@test.com` | `test1234` | Admin - Radar Only | None | Full access to Radar only |
| `admin-view@test.com` | `test1234` | Admin - View Only | +CREATE on ADMIN_CONTROLLERS_RADAR | View only + CREATE override |
| `admin-noperm@test.com` | `test1234` | None | +VIEW on ADMIN_CONTROLLERS_RADAR, ACCOUNTS | Override only (ADMIN bypasses anyway) |

### Groups:

**User Mode (Radar only):**
| Group | Permissions |
|-------|-------------|
| User Radar - Full Access | Full USER_CONTROLLERS_RADAR |
| User Radar - View Only | VIEW only |

**Admin Mode (Accounts + Radar):**
| Group | Permissions |
|-------|-------------|
| Admin - Full Access | Full Accounts/Companies/Groups + Radar |
| Admin - Accounts Only | Full Accounts/Companies/Groups |
| Admin - Radar Only | Full ADMIN_CONTROLLERS_RADAR |
| Admin - View Only | VIEW only for all |

### User Permission Overrides:

**User Mode:**
| User | Override |
|------|----------|
| `user-view@test.com` | +CREATE on USER_CONTROLLERS_RADAR |
| `user-noperm@test.com` | +VIEW on USER_CONTROLLERS_RADAR |

**Admin Mode:**
| User | Override |
|------|----------|
| `admin-view@test.com` | +CREATE on ADMIN_CONTROLLERS_RADAR |
| `admin-noperm@test.com` | +VIEW on ADMIN_CONTROLLERS_RADAR, ACCOUNTS |

### Radar Data:

- **Controllers:** Main Entrance, Parking Lot, Warehouse
- **Sensors:** Entry A, Entry B, Parking Zone
- **Device:** Radar Gateway Device

### Testing Scenarios:

**User Mode (systemRole: USER) - Test `/user/*` routes:**
1. `user-full@test.com` /user/controllers/radar → ✅ All buttons visible
2. `user-view@test.com` /user/controllers/radar → ✅ VIEW + CREATE (override)
3. `user-noperm@test.com` /user/controllers/radar → ✅ VIEW only (override)
4. `/user/controllers/radar/new` as user-noperm → ❌ 403 Forbidden
5. `/user/controllers/radar/new` as user-view → ✅ Works (override)

**Admin Mode (systemRole: ADMIN) - Test `/admin/*` routes:**
6. `admin-full@test.com` /admin/* → ✅ All routes accessible (has Full Access group)
7. `admin-accounts@test.com` /admin/accounts/* → ✅ Full access (has Accounts Only group)
8. `admin-accounts@test.com` /admin/controllers/radar → ❌ **No access** (no Radar group, ACL enforced)
9. `admin-radar@test.com` /admin/controllers/radar → ✅ Full access (has Radar Only group)
10. `admin-radar@test.com` /admin/accounts/* → ❌ **No access** (no Accounts group, ACL enforced)
11. `admin-view@test.com` /admin/* → ✅ VIEW only, but CREATE Radar works (override)
12. `admin-noperm@test.com` /admin/* → ❌ **No access** (no groups, only overrides for VIEW)

**✅ Important Note:** 
- **ADMIN systemRole NO LONGER bypasses ACL checks** - all users must have proper group permissions
- Module permissions are account-scoped and apply to ALL users (including ADMIN)
- System admins need to be assigned to groups just like regular users
- Only users with `systemRole: 'ADMIN'` can access `/admin/*` routes (route-level check)
- But within admin routes, module permissions are still enforced

---

## ⚠️ Important Rules

### 1. Name files by task
```
task-<task-name>.seed.ts
```

### 2. Use `upsert` instead of `create`
```typescript
// ✅ Good - no error when re-running
await prisma.user.upsert({
    where: { email: 'test@test.com' },
    update: {},
    create: { ... }
});

// ❌ Bad - duplicate error when re-running
await prisma.user.create({ ... });
```

### 3. Use task-prefixed unique identifiers
```typescript
// ✅ Good - no conflict with other tasks
where: { slug: 'task-abc-account' }
where: { email: 'task-abc-user@test.com' }
where: { apiKey: 'task-abc-device-key' }

// ❌ Bad - may conflict
where: { slug: 'test-account' }
```

### 4. Don't modify original files
- ❌ Don't modify `prisma/seed.ts`
- ❌ Don't modify other task's seeds
- ✅ Create a new file for your task

### 5. Self-contained
Each seed file should create all data it needs, without depending on other seeds:

```typescript
// ✅ Good - creates account if needed
const account = await prisma.account.upsert({ ... });
const user = await prisma.user.upsert({ ..., accountId: account.id });

// ❌ Bad - assumes account exists
const account = await prisma.account.findFirst({ where: { slug: 'test-corp' } });
// Could be null if other seed hasn't run!
```

---

## 🗑️ Clean Up Task Data

To reset task data, add cleanup at the start of your file:

```typescript
// Uncomment to delete data before re-seeding
// await prisma.device.deleteMany({ where: { apiKey: { startsWith: 'task-abc-' } } });
// await prisma.user.deleteMany({ where: { email: { startsWith: 'task-abc-' } } });
```

---

*Last updated: December 2024*
