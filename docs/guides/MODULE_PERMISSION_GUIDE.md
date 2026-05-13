# Module Permission Development Guide

Detailed guide for developing and protecting modules with the permission system.

## 📋 Table of Contents

1. [System Overview](#1-system-overview)
2. [Adding a New Module Process](#2-adding-a-new-module-process)
3. [Files to Update](#3-files-to-update)
4. [Backend Protection](#4-backend-protection)
5. [Frontend Permission Checking](#5-frontend-permission-checking)
6. [Testing Permissions](#6-testing-permissions)
7. [Best Practices](#7-best-practices)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Svelte)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ canCreate()  │  │ canEdit()    │  │ PermissionGuard      │   │
│  │ canDelete()  │  │ canView()    │  │ ActionButtons        │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (SvelteKit Server)                    │
│  ┌──────────────────┐  ┌─────────────────────────────────────┐  │
│  │ restrictModule() │  │ hasModulePermission()               │  │
│  │ restrictByRoute()│  │ getUserModulePermissions()          │  │
│  └──────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Database                                 │
│  ┌──────────┐  ┌────────────┐  ┌──────────────────────────┐     │
│  │ Group    │  │ Permission │  │ UserPermissionOverride   │     │
│  └──────────┘  └────────────┘  └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### Permission Hierarchy

```
0. SYSTEM_ACCOUNT members → full access (bypass all checks)
   Account OWNER (for USER_* modules only) → full access in their account
   ↓
1. UserPermissionOverride (highest priority - overrides group)
   ↓
2. Group Permissions (from GroupMembership)
   ↓
3. SystemRole: ADMIN (NO bypass - must have group permissions)
```

- **SYSTEM_ACCOUNT**: Members of the system account bypass all module checks.
- **Account OWNER (user-side only)**: A user who is **OWNER** of the current account automatically has access to all **USER_*** modules (e.g. USER_CONTROLLERS_RADAR, USER_DEVICES) in that account. They do not need to be in a group or have overrides for user-side features. Admin-side (ADMIN_*) modules still require group/override permissions.
- **Everyone else**: Permissions come from Group Permissions and/or UserPermissionOverride only.

### Why OWNER gets full USER_* access (ACL design)

This is an **explicit design decision**, not a shortcut:

1. **Account OWNER** is the person who manages the account (creates groups, assigns users, uses user-side features). If OWNER had to be in a group to see "Register Device" or use Radar, they would be locked out until an admin (e.g. system admin) adds them to a group. That would be inconsistent with "OWNER creates groups and assigns permissions" (see seed flow: OWNER is not added to any group).
2. **Scope**: Only **USER_*** modules in **their account**. Admin-side (ADMIN_*) still requires group/override, so system-wide admin features stay controlled.
3. **Alternative (strict ACL)**: If product requirement is "everyone, including OWNER, must get permissions only via group or override", then we would remove the OWNER special case in `guards.ts` and `modulePermissions.ts`, and ensure OWNER is added to a group (e.g. by seed or by system admin) so they get permissions like any other user.

Current implementation follows the "OWNER has full user-side access in their account" model so that the account owner is never locked out of user features.

---

## 2. Adding a New Module Process

### Checklist

When adding a new module (e.g., `USER_REPORTS`), update the following files:

- [ ] `src/lib/constants/permissions.ts` - Define module
- [ ] `src/lib/constants/routeModuleMap.ts` - Map routes to module
- [ ] Route files (`+page.server.ts`) - Protect with `restrictModule()`
- [ ] Svelte components (buttons) - Check permissions with `canCreate()`, etc.
- [ ] Sidebar component (`UserSidebar.svelte` or `AdminSidebar.svelte`) - Filter menu items

---

## 3. Files to Update

### 3.1. `src/lib/constants/permissions.ts`

Define module and actions:

```typescript
// Add to USER_SIDEBAR_ITEMS or ADMIN_SIDEBAR_ITEMS
export const USER_SIDEBAR_ITEMS: Record<string, SidebarItem> = {
  // ... existing modules ...
  
  // === NEW MODULE ===
  USER_REPORTS: {
    label: 'Reports',
    href: '/user/reports',
    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
  },
};

// Add to categories
export const USER_CATEGORIES = {
  // ... existing categories ...
  'Analytics': ['USER_REPORTS'],  // NEW
};
```

### 3.2. `src/lib/constants/routeModuleMap.ts`

Map routes to modules:

```typescript
export const USER_ROUTE_MODULE_MAP: Record<string, RouteModuleConfig> = {
  // ... existing routes ...
  
  // === NEW ROUTES ===
  '/user/reports': {
    module: 'USER_REPORTS',
    defaultAction: 'VIEW',
    description: 'Reports list'
  },
  '/user/reports/new': {
    module: 'USER_REPORTS',
    defaultAction: 'CREATE',
    description: 'Create report'
  },
  '/user/reports/[id]': {
    module: 'USER_REPORTS',
    defaultAction: 'VIEW',
    description: 'View report'
  },
  '/user/reports/[id]/edit': {
    module: 'USER_REPORTS',
    defaultAction: 'EDIT',
    description: 'Edit report'
  },
};
```

### 3.3. Sidebar Component (Menu Filtering)

Update `UserSidebar.svelte` or `AdminSidebar.svelte`:

```svelte
// 1. Add to menuModuleMap
const menuModuleMap: Record<string, string> = {
    '/user/controllers/radar': 'USER_CONTROLLERS_RADAR',
    '/user/reports': 'USER_REPORTS',  // NEW
};

// 2. Add module to menu item
const allMenuItems: MenuItem[] = [
    {
        label: "Analytics",
        icon: Chart,
        subItems: [
            { 
                href: "/user/reports", 
                label: "Reports", 
                module: 'USER_REPORTS'  // Specify module
            }
        ]
    }
];
```

Menu will automatically filter based on the `hasModuleAccess()` function.

---

## 4. Backend Protection

### 4.1. Real Examples from Current Implementation

#### Example 1: Admin Accounts List (ACCOUNTS module)

```typescript
// src/routes/admin/accounts/accounts/+page.server.ts
export const load = restrictModule(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // ... load logic ...
        
        // Fetch permissions for frontend
        let modulePermissions = (locals as any).modulePermissions || {};
        const accountId = (locals as any).currentAccount?.account?.id;
        if (Object.keys(modulePermissions).length === 0 && accountId && locals.user?.id) {
            modulePermissions = await getUserModulePermissions(locals.user.id, accountId);
        }
        
        return {
            accounts: result.records,
            modulePermissions,  // Pass to frontend
            user: locals.user
        };
    },
    'ACCOUNTS',           // Module name
    { action: 'VIEW' }     // Required action
);

export const actions: Actions = {
    deleteAccount: restrictModule(
        async (event: ModuleAuthenticatedEvent) => {
            // Delete logic
        },
        'ACCOUNTS',
        { action: 'DELETE' }  // Different action for delete
    )
};
```

#### Example 2: Admin Radar Controller (ADMIN_CONTROLLERS_RADAR module)

```typescript
// src/routes/admin/controllers/radar/+page.server.ts
export const load = restrictModule(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // ... load logic ...
        return {
            radarSensors: sensors,
            modulePermissions,
            user: locals.user
        };
    },
    'ADMIN_CONTROLLERS_RADAR',
    { action: 'VIEW' }
);
```

#### Example 3: User Radar Controller (USER_CONTROLLERS_RADAR module)

```typescript
// src/routes/user/controllers/radar/+page.server.ts
export const load = restrictModule(
    async ({ url, locals, cookies }: AuthenticatedLoadEvent) => {
        // ... load logic ...
        return {
            radarSensors: sensors,
            modulePermissions,
            user: locals.user
        };
    },
    'USER_CONTROLLERS_RADAR',
    { action: 'VIEW' }
) satisfies PageServerLoad;
```

### 4.2. Basic Usage - restrictModule

```typescript
// +page.server.ts
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load = restrictModule(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // Your load logic here
        const data = await locals.prisma.report.findMany({ ... });
        
        // Fetch permissions for frontend
        let modulePermissions = (locals as any).modulePermissions || {};
        const accountId = (locals as any).currentAccount?.account?.id;
        if (Object.keys(modulePermissions).length === 0 && accountId && locals.user?.id) {
            modulePermissions = await getUserModulePermissions(locals.user.id, accountId);
        }
        
        return {
            reports: data,
            modulePermissions,
            user: locals.user
        };
    },
    'USER_REPORTS',      // Module name
    { action: 'VIEW' }   // Required action
);
```

### 4.3. Actions with Different Permissions

```typescript
export const actions: Actions = {
    // CREATE action
    create: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            // Create logic
        },
        'USER_REPORTS',
        { action: 'CREATE' }
    ),
    
    // EDIT action
    update: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            // Update logic
        },
        'USER_REPORTS',
        { action: 'EDIT' }
    ),
    
    // DELETE action
    delete: restrictModule(
        async ({ request, locals }: ModuleAuthenticatedEvent) => {
            // Delete logic
        },
        'USER_REPORTS',
        { action: 'DELETE' }
    )
};
```

### 4.4. Options

```typescript
restrictModule(handler, 'MODULE_NAME', {
    action: 'VIEW',              // Required action: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE'
    bypassRoles: ['SUPER_ADMIN'], // Additional roles that bypass (ADMIN does NOT bypass by default)
    skipCheck: false,            // Skip permission check entirely
    errorMessage: 'Custom error' // Custom 403 error message
});
```

**⚠️ Important:** `systemRole: ADMIN` does NOT bypass module checks. All users (including ADMIN) must have group permissions to access modules.

---

## 5. Frontend Permission Checking

### 5.1. Menu Filtering (Sidebar)

To filter menu items by permissions, update `UserSidebar.svelte` or `AdminSidebar.svelte`:

```svelte
<script lang="ts">
    // Module permissions from layout
    export let modulePermissions: Record<string, string[]> = {};
    export let userSystemRole: string = "USER";

    // Mapping from menu paths to modules
    const menuModuleMap: Record<string, string> = {
        '/user/controllers/radar': 'USER_CONTROLLERS_RADAR',
        '/user/reports': 'USER_REPORTS',  // NEW MODULE
        // Add other modules when implementing
    };

    // Check permission to display menu item
    function hasModuleAccess(module: string | undefined): boolean {
        if (!module) return true; // No requirement = always show
        
        // ADMIN users still need to check permissions (no bypass in ACL)
        // But for menu filtering, we can show all items to ADMIN for better UX
        // Backend will still enforce permissions via restrictModule()
        if (userSystemRole === 'ADMIN') return true;
        
        // Check VIEW permission
        const permissions = modulePermissions[module];
        return permissions && permissions.includes('VIEW');
    }

    // Filter sub-items
    function filterSubItems(subItems: SubMenuItem[] | undefined): SubMenuItem[] {
        if (!subItems) return [];
        return subItems.filter(item => {
            const module = menuModuleMap[item.href] || item.module;
            return hasModuleAccess(module);
        });
    }

    // Menu items definition
    const allMenuItems: MenuItem[] = [
        {
            label: "Controllers",
            icon: Radio,
            subItems: [
                { 
                    href: "/user/controllers/radar", 
                    label: "Radar", 
                    module: 'USER_CONTROLLERS_RADAR'  // Specify module
                }
            ]
        },
        {
            label: "Analytics",
            icon: Chart,
            subItems: [
                { 
                    href: "/user/reports", 
                    label: "Reports", 
                    module: 'USER_REPORTS'  // NEW MODULE
                }
            ]
        }
    ];

    // Reactive: Filter menu based on permissions
    $: filteredMenuItems = allMenuItems
        .map(item => {
            if (item.subItems && item.subItems.length > 0) {
                const filteredSubs = filterSubItems(item.subItems);
                if (filteredSubs.length === 0) return null; // Hide parent if no children
                return { ...item, subItems: filteredSubs };
            }
            
            if (item.href) {
                const module = menuModuleMap[item.href] || item.module;
                if (!hasModuleAccess(module)) return null;
            }
            
            return item;
        })
        .filter((item): item is MenuItem => item !== null);
</script>

<SimpleSidebar items={filteredMenuItems} />
```

**Note:**
- Only filter modules that have implemented ACL (in scope)
- Modules not yet implemented → always show (no ACL check)
- ADMIN systemRole → bypass check (always show)

### 5.2. Using Utility Functions

**Real Example from Admin Radar:**

```svelte
<!-- src/routes/admin/controllers/radar/+page.svelte -->
<script lang="ts">
    import { canCreate, canDelete } from "$lib/utils/permissions";
    
    export let data: PageData;
    
    // Check permissions
    $: showCreateButton = canCreate(
        data.modulePermissions,
        'ADMIN_CONTROLLERS_RADAR',
        data.user?.systemRole
    );
    
    $: showDeleteButton = canDelete(
        data.modulePermissions,
        'ADMIN_CONTROLLERS_RADAR',
        data.user?.systemRole
    );
    
    // Conditional action buttons
    $: actionButtons = showCreateButton ? [
        {
            label: "Register Controller",
            icon: Plus,
            onClick: () => goto("/admin/controllers/radar/new"),
        }
    ] : [];
</script>

{#if showCreateButton}
    <Button on:click={() => goto("/admin/controllers/radar/new")}>
        Register Controller
    </Button>
{/if}
```

**Generic Example:**

```svelte
<script lang="ts">
    import { canCreate, canEdit, canDelete, canView } from "$lib/utils/permissions";
    import type { PageData } from "./$types";
    
    export let data: PageData;
    
    // Check individual permissions
    $: showCreateBtn = canCreate(data.modulePermissions, 'USER_REPORTS', data.user?.systemRole);
    $: showEditBtn = canEdit(data.modulePermissions, 'USER_REPORTS', data.user?.systemRole);
    $: showDeleteBtn = canDelete(data.modulePermissions, 'USER_REPORTS', data.user?.systemRole);
</script>

<!-- Conditional button rendering -->
{#if showCreateBtn}
    <Button on:click={handleCreate}>Create Report</Button>
{/if}
```

### 5.3. Using PermissionGuard Component

```svelte
<script lang="ts">
    import { PermissionGuard } from "$lib/components/permissions";
</script>

<!-- Single action -->
<PermissionGuard 
    module="USER_REPORTS" 
    action="CREATE"
    permissions={data.modulePermissions}
    userSystemRole={data.user?.systemRole}
>
    <Button>Create Report</Button>
</PermissionGuard>

<!-- Multiple actions (all required) -->
<PermissionGuard 
    module="USER_REPORTS" 
    action={['EDIT', 'DELETE']}
    mode="all"
    permissions={data.modulePermissions}
    userSystemRole={data.user?.systemRole}
>
    <Button>Advanced Settings</Button>
</PermissionGuard>

<!-- Multiple actions (any one) -->
<PermissionGuard 
    module="USER_REPORTS" 
    action={['EDIT', 'DELETE']}
    mode="any"
    permissions={data.modulePermissions}
    userSystemRole={data.user?.systemRole}
>
    <Button>Modify</Button>
</PermissionGuard>
```

### 5.4. Using ActionButtons Component

```svelte
<script lang="ts">
    import { ActionButtons } from "$lib/components/permissions";
</script>

<ActionButtons
    module="USER_REPORTS"
    permissions={data.modulePermissions}
    userSystemRole={data.user?.systemRole}
    onCreate={() => goto('/user/reports/new')}
    onEdit={() => handleEdit()}
    onDelete={() => handleDelete()}
/>
```

### 5.5. Conditional Action Buttons Array

```svelte
<script lang="ts">
    import { canCreate, canDelete } from "$lib/utils/permissions";
    
    // Build action buttons based on permissions
    $: actionButtons = [
        ...(canCreate(data.modulePermissions, 'USER_REPORTS', data.user?.systemRole) ? [{
            label: "Create Report",
            icon: Plus,
            onClick: () => goto("/user/reports/new"),
        }] : []),
        ...(canDelete(data.modulePermissions, 'USER_REPORTS', data.user?.systemRole) ? [{
            label: "Bulk Delete",
            icon: Trash,
            variant: "destructive",
            onClick: handleBulkDelete,
        }] : []),
    ];
</script>

<AdminPageLayout {actionButtons} />
```

---

## 6. Testing Permissions

### 6.1. Test Checklist

| Test Case | Expected |
|-----------|----------|
| User has VIEW | Can access list page |
| User doesn't have VIEW | 403 + menu item hidden |
| User has VIEW, doesn't have CREATE | Create button hidden |
| User accesses /new without CREATE | 403 |
| ADMIN user | Always has full access |
| User Override GRANT | Override group permission |
| User Override DENY | Block even if group allows |

### 6.2. Manual Testing Steps

1. **Create Test User** (systemRole: USER)
2. **Create Group** with limited permissions
3. **Add User to Group**
4. **Login as User** and test routes
5. **Add User Override** and verify

### 6.3. Console Debug

```javascript
// In browser console
console.log('Module Permissions:', data.modulePermissions);
console.log('User Role:', data.user?.systemRole);
```

---

## 7. Best Practices

### 7.1. Naming Conventions

```
Admin modules: ADMIN_*, DEVICES, BUNDLES, etc.
User modules:  USER_*, USER_DEVICES, USER_BUNDLES, etc.
```

### 7.2. Permission Granularity

```typescript
// ✅ Good - Specific permissions per action
{ action: 'CREATE' }  // for /new routes
{ action: 'EDIT' }    // for /edit routes
{ action: 'DELETE' }  // for delete actions
{ action: 'VIEW' }    // for list/detail pages

// ❌ Bad - Same permission for all
{ action: 'VIEW' }  // for everything
```

### 7.3. Always Pass Permissions to Frontend

```typescript
// ✅ Always include in return
return {
    data: myData,
    modulePermissions,  // For button visibility
    user: locals.user   // For systemRole check
};
```

### 7.4. Double Protection

```
Backend: restrictModule() blocks unauthorized access
Frontend: canCreate() hides buttons from unauthorized users
```

---

## 8. Troubleshooting

### Issue: "You do not have permission to access this module"

**Causes:**
1. User doesn't have permission in Group
2. Module name doesn't match between route and permissions.ts
3. User hasn't been added to Group

**Fix:**
1. Check Group permissions in Admin
2. Verify module name in permissions.ts and routeModuleMap.ts
3. Check GroupMembership

### Issue: Button doesn't hide even without permission

**Causes:**
1. modulePermissions not passed from server
2. Module name incorrect in frontend

**Fix:**
1. Ensure `return { modulePermissions, user }` in load
2. Check module name in canCreate() call

### Issue: ADMIN still gets blocked

**Causes:**
1. User doesn't have group permissions (ADMIN no longer bypasses)
2. restrictModule not called correctly

**Fix:**
1. **ADMIN users must have group permissions** - No longer bypasses
2. Ensure using restrictModule instead of restrict
3. Check GroupMembership for ADMIN user

### Issue: Admin granted permission (override) but user still gets 403

**Causes:**
1. **Account mismatch** – Overrides are stored per (user, **account**). When you add an override in Admin → Users → [user] → Permissions, you choose an account in the dropdown ("View permissions for account: …"). The user must be **using that same account** when they log in (their "current account" cookie). If the user’s current account is different, the override is not applied and they get 403.
2. **Wrong access level** – You must grant the **User**-side module (e.g. **Radar Controllers** under "User Access"), not the Admin-side one. For `/user/controllers/radar` the module is `USER_CONTROLLERS_RADAR`.
3. **Cache** – After adding/removing overrides, cache is invalidated. If you still see 403, have the user refresh or log out and back in so their next request uses fresh permissions.

**Fix:**
1. In Permissions page, select the **same account** the user uses when they open the app (their default or selected account).
2. Under **User Access**, grant **Radar Controllers** (VIEW at minimum) for that account.
3. If the user is **Account OWNER**, they get full access to all user-side modules in that account automatically; no override needed.

---

## Quick Reference

### Import Statements

```typescript
// Backend
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

// Frontend
import { canCreate, canEdit, canDelete, canView } from "$lib/utils/permissions";
import { PermissionGuard, ActionButtons } from "$lib/components/permissions";
```

### Module Action Types

```typescript
type PermissionAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE';
```

---

*Last updated: December 2024*


